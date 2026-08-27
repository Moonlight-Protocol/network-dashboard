import type { NetworkEvent, NetworkEventKind } from "../lib/network-events.ts";
import { truncateAddress } from "../lib/dom.ts";
import { formatAmount } from "../lib/dom.ts";
import { explorerTxUrl } from "../lib/config.ts";
import { formatIsoTimestamp } from "../lib/format.ts";
import type { WsStatus } from "../lib/ws-client.ts";

/**
 * §2 (right) — Activity feed. Newest card on top; fade-out after 8s.
 * Up to 5 visible. One card kind per NetworkEventKind, colour-coded per
 * the sketch palette.
 */

const CARD_TTL_MS = 5 * 60 * 1000;
const MAX_VISIBLE = 10;

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

const MONEY_KINDS = new Set<NetworkEventKind>([
  "channel_deposit",
  "channel_bundle",
  "channel_settlement",
]);

type OpCounts = { deposits: number; sends: number; withdraws: number };

function opField(kind: NetworkEventKind): keyof OpCounts {
  if (kind === "channel_deposit") return "deposits";
  if (kind === "channel_settlement") return "withdraws";
  return "sends";
}

const OP_META: Array<[keyof OpCounts, string, string]> = [
  ["deposits", "op-deposit", "deposit"],
  ["sends", "op-send", "send"],
  ["withdraws", "op-withdraw", "withdraw"],
];

function renderOps(row: HTMLElement, counts: OpCounts): void {
  row.textContent = "";
  let first = true;
  for (const [field, cls, noun] of OP_META) {
    const n = counts[field];
    if (n === 0) continue;
    if (!first) {
      const sep = document.createElement("span");
      sep.className = "op-sep";
      sep.textContent = ", ";
      row.appendChild(sep);
    }
    first = false;
    const span = document.createElement("span");
    span.className = cls;
    span.textContent = `${n} ${noun}${n === 1 ? "" : "s"}`;
    row.appendChild(span);
  }
}

function renderOpBar(bar: HTMLElement, counts: OpCounts): void {
  bar.textContent = "";
  for (const [field, cls] of OP_META) {
    const seg = document.createElement("span");
    seg.className = cls;
    seg.style.flexGrow = String(counts[field]);
    bar.appendChild(seg);
  }
}

/**
 * Card footer: timestamp, ledger, and a transaction link when the event
 * carries a txHash and an explorer base is configured.
 */
function buildFooter(event: NetworkEvent): HTMLElement {
  const footer = document.createElement("footer");

  const timeRow = document.createElement("div");
  timeRow.textContent = formatIsoTimestamp(event.occurredAt);

  const ledgerRow = document.createElement("div");
  ledgerRow.textContent = `Ledger ${event.ledger}`;

  footer.append(timeRow, ledgerRow);

  const url = event.txHash !== undefined ? explorerTxUrl(event.txHash) : null;
  if (url !== null) {
    const linkEl = document.createElement("a");
    linkEl.href = url;
    linkEl.target = "_blank";
    linkEl.rel = "noopener noreferrer";
    linkEl.textContent = "View transaction ↗";
    footer.append(linkEl);
  }

  return footer;
}

export class ActivityFeed {
  private root: HTMLElement;
  private list: HTMLDivElement;
  private statusEl: HTMLSpanElement;
  private seen = new Set<string>();
  private timers = new Map<string, number>();
  private groups = new Map<
    string,
    {
      card: HTMLElement;
      counts: OpCounts;
      ops: HTMLElement;
      bar: HTMLElement;
      title: HTMLElement;
    }
  >();

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
    this.groups.clear();
  }

  private prepend(event: NetworkEvent): void {
    if (this.seen.has(event.id)) return;
    this.seen.add(event.id);

    if (MONEY_KINDS.has(event.kind) && event.txHash) {
      this.upsertBundleCard(event);
      return;
    }

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

    card.append(glyph, body, buildFooter(event));
    this.list.prepend(card);

    this.trimAndExpire(card, event.id);
  }

  /**
   * One card per bundle execution: deposit, bundle, and settlement events
   * sharing a txHash merge into a single card that shows the operation
   * counts and a proportional bottom bar. The bundle event's payer names
   * the card; the council row and footer come from the first event seen.
   */
  private upsertBundleCard(event: NetworkEvent): void {
    const key = event.txHash as string;
    const existing = this.groups.get(key);
    if (existing) {
      existing.counts[opField(event.kind)] += 1;
      if (
        event.kind === "channel_bundle" &&
        typeof event.payload.providerPublicKey === "string"
      ) {
        existing.title.textContent = `via ${
          truncateAddress(event.payload.providerPublicKey)
        }`;
      }
      renderOps(existing.ops, existing.counts);
      renderOpBar(existing.bar, existing.counts);
      return;
    }

    const counts: OpCounts = { deposits: 0, sends: 0, withdraws: 0 };
    counts[opField(event.kind)] += 1;

    const card = document.createElement("article");
    card.className = "activity-card kind-channel_bundle bundle-group";
    card.dataset.eventId = event.id;
    card.style.setProperty("--ttl-ms", `${CARD_TTL_MS}ms`);

    const glyph = document.createElement("span");
    glyph.className = "activity-glyph";
    glyph.textContent = KIND_GLYPH.channel_bundle;

    const body = document.createElement("div");
    body.className = "activity-body";

    const titleRow = document.createElement("div");
    titleRow.className = "activity-title";
    titleRow.textContent = event.kind === "channel_bundle" &&
        typeof event.payload.providerPublicKey === "string"
      ? `via ${truncateAddress(event.payload.providerPublicKey)}`
      : "Bundle";

    const councilRow = document.createElement("div");
    councilRow.className = "activity-council";
    councilRow.textContent = councilLabel(event);

    const opsRow = document.createElement("div");
    opsRow.className = "activity-ops";
    renderOps(opsRow, counts);

    body.append(titleRow, councilRow, opsRow);

    const bar = document.createElement("div");
    bar.className = "activity-opbar";
    renderOpBar(bar, counts);

    card.append(glyph, body, buildFooter(event), bar);
    this.list.prepend(card);
    this.groups.set(key, { card, counts, ops: opsRow, bar, title: titleRow });
    this.trimAndExpire(card, event.id, key);
  }

  private trimAndExpire(
    card: HTMLElement,
    eventId: string,
    groupKey?: string,
  ): void {
    while (this.list.childElementCount > MAX_VISIBLE) {
      const last = this.list.lastElementChild;
      if (!last) break;
      const lastId = (last as HTMLElement).dataset.eventId;
      if (lastId) this.dropTimer(lastId);
      this.dropGroupByCard(last as HTMLElement);
      last.remove();
    }

    const timer = globalThis.setTimeout(() => {
      card.classList.add("fading");
      const finalizer = globalThis.setTimeout(() => {
        card.remove();
        if (groupKey) this.groups.delete(groupKey);
        this.timers.delete(eventId);
      }, 600);
      this.timers.set(eventId, finalizer);
    }, CARD_TTL_MS);
    this.timers.set(eventId, timer);
  }

  private dropGroupByCard(card: HTMLElement): void {
    for (const [key, group] of this.groups) {
      if (group.card === card) {
        this.groups.delete(key);
        return;
      }
    }
  }

  private dropTimer(eventId: string): void {
    const t = this.timers.get(eventId);
    if (t !== undefined) {
      clearTimeout(t);
      this.timers.delete(eventId);
    }
  }
}
