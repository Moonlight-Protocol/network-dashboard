import type { NetworkEvent, NetworkEventKind } from "../lib/network-events.ts";
import { truncateAddress } from "../lib/dom.ts";
import { formatAmount } from "../lib/dom.ts";
import type { WsStatus } from "../lib/ws-client.ts";

/**
 * §2 (right) — Activity feed. Newest card on top; fade-out after 8s.
 * Up to 5 visible. One card kind per NetworkEventKind, colour-coded per
 * the sketch palette.
 */

const CARD_TTL_MS = 8_000;
const MAX_VISIBLE = 5;

const KIND_GLYPH: Record<NetworkEventKind, string> = {
  council_formed: "★",
  provider_added: "✓",
  provider_removed: "✗",
  asset_registered: "+",
  channel_deposit: "↙",
  channel_settlement: "↗",
  channel_bundle: "•",
};

const KIND_TITLE: Record<NetworkEventKind, string> = {
  council_formed: "New council formed",
  provider_added: "PP joined",
  provider_removed: "PP left",
  asset_registered: "Asset registered",
  channel_deposit: "Deposit",
  channel_settlement: "Settlement",
  channel_bundle: "Bundle",
};

const STATUS_COPY: Record<WsStatus, string> = {
  idle: "idle",
  connecting: "connecting…",
  open: "live",
  closed: "disconnected",
};

function councilLabel(event: NetworkEvent): string {
  if (event.councilName?.trim()) return event.councilName;
  return `Council ${truncateAddress(event.councilId)}`;
}

function detailFor(event: NetworkEvent): string {
  const p = event.payload;
  switch (event.kind) {
    case "provider_added":
    case "provider_removed":
      return typeof p.providerPublicKey === "string"
        ? truncateAddress(p.providerPublicKey)
        : "";
    case "channel_deposit":
    case "channel_settlement":
      if (typeof p.amount !== "string") return "";
      try {
        return `${formatAmount(p.amount)}`;
      } catch {
        return "";
      }
    case "council_formed":
      return truncateAddress(event.councilId);
    case "asset_registered":
      return typeof p.assetContractId === "string"
        ? truncateAddress(p.assetContractId)
        : "";
    case "channel_bundle":
      return typeof p.providerPublicKey === "string"
        ? `via ${truncateAddress(p.providerPublicKey)}`
        : "";
  }
}

export class ActivityFeed {
  private root: HTMLElement;
  private list: HTMLDivElement;
  private statusEl: HTMLSpanElement;
  private seen = new Set<string>();
  private timers = new Map<string, number>();

  constructor() {
    this.root = document.createElement("aside");
    this.root.className = "section activity-feed";
    this.root.setAttribute("aria-label", "Activity feed");
    this.root.setAttribute("aria-live", "polite");

    const header = document.createElement("header");
    header.className = "activity-feed-header";
    const title = document.createElement("span");
    title.className = "activity-feed-title";
    title.textContent = "Activity";
    const status = document.createElement("span");
    status.className = "activity-feed-status";
    status.textContent = STATUS_COPY.idle;
    this.statusEl = status;
    header.append(title, status);

    this.list = document.createElement("div");
    this.list.className = "activity-feed-list";

    this.root.append(header, this.list);
  }

  element(): HTMLElement {
    return this.root;
  }

  setStatus(status: WsStatus): void {
    this.statusEl.textContent = STATUS_COPY[status];
    this.statusEl.dataset.state = status;
  }

  /**
   * Replace the feed with the snapshot's recent ring buffer. Used on
   * connect + reconnect.
   */
  seed(events: NetworkEvent[]): void {
    this.clear();
    for (const e of events) this.prepend(e);
  }

  /** Add a single live event to the top. */
  append(event: NetworkEvent): void {
    this.prepend(event);
  }

  // ── internals ──────────────────────────────────────────────────────

  private clear(): void {
    this.list.textContent = "";
    this.seen.clear();
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  private prepend(event: NetworkEvent): void {
    if (this.seen.has(event.id)) return;
    this.seen.add(event.id);

    const card = document.createElement("article");
    card.className = `activity-card kind-${event.kind}`;
    card.dataset.eventId = event.id;
    card.style.setProperty("--ttl-ms", `${CARD_TTL_MS}ms`);

    const glyph = document.createElement("span");
    glyph.className = "activity-glyph";
    glyph.textContent = KIND_GLYPH[event.kind];

    const body = document.createElement("div");
    body.className = "activity-body";

    const titleRow = document.createElement("div");
    titleRow.className = "activity-title";
    titleRow.textContent = KIND_TITLE[event.kind];

    const councilRow = document.createElement("div");
    councilRow.className = "activity-council";
    councilRow.textContent = councilLabel(event);

    body.append(titleRow, councilRow);

    const detail = detailFor(event);
    if (detail) {
      const d = document.createElement("div");
      d.className = "activity-detail";
      d.textContent = detail;
      body.appendChild(d);
    }

    card.append(glyph, body);
    this.list.prepend(card);

    while (this.list.childElementCount > MAX_VISIBLE) {
      const last = this.list.lastElementChild;
      if (!last) break;
      const eventId = (last as HTMLElement).dataset.eventId;
      if (eventId) this.dropTimer(eventId);
      last.remove();
    }

    const timer = globalThis.setTimeout(() => {
      card.classList.add("fading");
      const finalizer = globalThis.setTimeout(() => {
        card.remove();
        this.timers.delete(event.id);
      }, 600);
      this.timers.set(event.id, finalizer);
    }, CARD_TTL_MS);
    this.timers.set(event.id, timer);
  }

  private dropTimer(eventId: string): void {
    const t = this.timers.get(eventId);
    if (t !== undefined) {
      clearTimeout(t);
      this.timers.delete(eventId);
    }
  }
}
