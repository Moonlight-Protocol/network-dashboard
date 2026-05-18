import type { NetworkEvent, NetworkEventKind } from "../lib/network-events.ts";
import { truncateAddress } from "../lib/dom.ts";

/**
 * Zone 3 — right-rail activity feed. ~280px wide, newest card on top,
 * each card fades out after ~8s (CSS animation). One card kind per
 * NetworkEventKind; the design sketch fixes the colour palette.
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
};

const KIND_TITLE: Record<NetworkEventKind, string> = {
  council_formed: "New council formed",
  provider_added: "PP joined",
  provider_removed: "PP left",
  asset_registered: "New asset",
  channel_deposit: "Deposit",
  channel_settlement: "Settlement",
};

function detailFor(event: NetworkEvent): string {
  const p = event.payload as Record<string, unknown>;
  switch (event.kind) {
    case "provider_added":
    case "provider_removed":
      return typeof p.providerPublicKey === "string"
        ? truncateAddress(p.providerPublicKey)
        : "";
    case "channel_deposit":
    case "channel_settlement":
      return typeof p.amount === "string" ? `${p.amount} stroops` : "";
    case "council_formed":
      return truncateAddress(event.councilId);
    case "asset_registered":
      return typeof p.assetContractId === "string"
        ? truncateAddress(p.assetContractId)
        : "";
  }
}

function councilLabel(event: NetworkEvent): string {
  const name = event.councilName?.trim();
  if (name) return name;
  return `Council ${truncateAddress(event.councilId)}`;
}

export class ActivityFeed {
  private root: HTMLElement;
  private list: HTMLDivElement;
  private statusEl: HTMLSpanElement;
  private seen = new Set<string>();
  private timers = new Map<string, number>();

  constructor() {
    this.root = document.createElement("aside");
    this.root.className = "zone activity-feed";
    this.root.setAttribute("aria-label", "Activity feed");
    this.root.setAttribute("aria-live", "polite");

    const header = document.createElement("header");
    header.className = "activity-feed-header";
    const title = document.createElement("span");
    title.className = "activity-feed-title";
    title.textContent = "Activity";
    this.statusEl = document.createElement("span");
    this.statusEl.className = "activity-feed-status";
    this.statusEl.dataset.status = "connecting";
    this.statusEl.textContent = "Connecting…";
    header.append(title, this.statusEl);
    this.root.appendChild(header);

    this.list = document.createElement("div");
    this.list.className = "activity-feed-list";
    this.root.appendChild(this.list);
  }

  element(): HTMLElement {
    return this.root;
  }

  setStatus(status: "connecting" | "open" | "closed"): void {
    this.statusEl.dataset.status = status;
    this.statusEl.textContent = status === "open"
      ? "Live"
      : status === "connecting"
      ? "Connecting…"
      : "Reconnecting…";
  }

  /** Seed from the snapshot frame. Replaces any existing cards. */
  seed(events: NetworkEvent[]): void {
    for (const id of this.timers.values()) clearTimeout(id);
    this.timers.clear();
    this.seen.clear();
    this.list.textContent = "";
    // Snapshot's `recent` is newest-first; we want the newest at the top
    // of the list, so iterate oldest-first and `prepend` each.
    for (const e of [...events].reverse()) {
      this.append(e);
    }
  }

  append(event: NetworkEvent): void {
    if (this.seen.has(event.id)) return;
    this.seen.add(event.id);

    const card = document.createElement("article");
    card.className = `activity-card activity-card--${event.kind}`;
    card.dataset.id = event.id;

    const row = document.createElement("div");
    row.className = "activity-card-row";
    const icon = document.createElement("span");
    icon.className = "activity-icon";
    icon.textContent = KIND_GLYPH[event.kind];
    const titleSpan = document.createElement("span");
    titleSpan.className = "activity-title";
    titleSpan.textContent = KIND_TITLE[event.kind];
    row.append(icon, titleSpan);
    card.appendChild(row);

    const council = document.createElement("div");
    council.className = "activity-council";
    council.textContent = councilLabel(event);
    card.appendChild(council);

    const detail = document.createElement("div");
    detail.className = "activity-detail mono";
    const detailText = detailFor(event);
    if (detailText) detail.textContent = detailText;
    card.appendChild(detail);

    this.list.prepend(card);

    while (this.list.children.length > MAX_VISIBLE) {
      const oldest = this.list.lastElementChild as HTMLElement | null;
      if (!oldest) break;
      this.removeCard(oldest.dataset.id ?? "");
    }

    const timer = setTimeout(() => this.removeCard(event.id), CARD_TTL_MS);
    this.timers.set(event.id, timer as unknown as number);
  }

  private removeCard(id: string): void {
    if (!id) return;
    const node = this.list.querySelector(
      `[data-id="${CSS.escape(id)}"]`,
    ) as HTMLElement | null;
    if (node) {
      node.classList.add("activity-card--leaving");
      setTimeout(() => node.remove(), 500);
    }
    const t = this.timers.get(id);
    if (t !== undefined) {
      clearTimeout(t);
      this.timers.delete(id);
    }
  }

  destroy(): void {
    for (const id of this.timers.values()) clearTimeout(id);
    this.timers.clear();
  }
}
