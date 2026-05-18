/**
 * Network-dashboard landing view — v1 single-zone scaffold.
 *
 * Right-rail activity feed with one card kind for now (PP joined Council X,
 * green). Future vertical slices add the counter strip (Zone 1) and the
 * topology (Zone 2) to the left of this rail, plus more card kinds.
 *
 * Connects to council-platform's public WS for hello-snapshot + live events.
 * Reconnects on close.
 */
import { getNav } from "../lib/nav.ts";
import { COUNCIL_PLATFORM_URL } from "../lib/config.ts";
import {
  connectNetworkEvents,
  deriveWsUrl,
  type WsClientHandle,
} from "../lib/ws-client.ts";
import type {
  NetworkEventFrame,
  NetworkEventKind,
} from "../lib/network-events.ts";
import { escapeHtml, truncateAddress } from "../lib/dom.ts";
import { onCleanup } from "../lib/router.ts";

/** Newest card stays visible at the top for this many ms before fading out. */
const CARD_TTL_MS = 8_000;

/** Soft cap on visible cards. Oldest are removed when the cap is exceeded. */
const MAX_VISIBLE = 5;

type CardSpec = {
  id: string;
  kind: NetworkEventKind;
  council: string;
  detail: string;
};

function frameToCard(frame: NetworkEventFrame): CardSpec | null {
  if (frame.kind !== "provider_added") {
    return null;
  }
  const payload = frame.payload as {
    councilName?: string | null;
    providerPublicKey?: string;
  };
  const council = payload.councilName?.trim() ||
    `Council ${truncateAddress(frame.councilId)}`;
  const pp = payload.providerPublicKey
    ? truncateAddress(payload.providerPublicKey)
    : "Unknown PP";
  return { id: frame.id, kind: frame.kind, council, detail: pp };
}

function renderCard(spec: CardSpec): HTMLElement {
  const el = document.createElement("article");
  el.className = `activity-card activity-card--${spec.kind}`;
  el.dataset.id = spec.id;
  el.innerHTML = `
    <div class="activity-card-row">
      <span class="activity-icon">✓</span>
      <span class="activity-title">PP joined</span>
    </div>
    <div class="activity-council">${escapeHtml(spec.council)}</div>
    <div class="activity-detail mono">${escapeHtml(spec.detail)}</div>
  `;
  return el;
}

// deno-lint-ignore require-await -- view fn satisfies router's Promise<HTMLElement> contract
export async function dashboardView(): Promise<HTMLElement> {
  const root = document.createElement("div");
  root.appendChild(getNav());

  const layout = document.createElement("div");
  layout.className = "dashboard-layout";
  layout.innerHTML = `
    <main class="dashboard-stage">
      <p class="dashboard-placeholder text-muted">
        The Moonlight network. Live activity appears on the right.
      </p>
    </main>
    <aside class="activity-feed" aria-live="polite" aria-label="Activity feed">
      <header class="activity-feed-header">
        <span class="activity-feed-title">Activity</span>
        <span class="activity-feed-status" data-status="connecting">Connecting…</span>
      </header>
      <div class="activity-feed-list" id="activity-feed-list"></div>
    </aside>
  `;
  root.appendChild(layout);

  const list = layout.querySelector("#activity-feed-list") as HTMLDivElement;
  const status = layout.querySelector(
    ".activity-feed-status",
  ) as HTMLSpanElement;

  const seen = new Set<string>();
  const timers = new Map<string, number>();

  const removeCard = (id: string): void => {
    const node = list.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (!node) return;
    node.classList.add("activity-card--leaving");
    setTimeout(() => node.remove(), 600);
    const timer = timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.delete(id);
    }
  };

  const showCard = (spec: CardSpec): void => {
    if (seen.has(spec.id)) return;
    seen.add(spec.id);
    const node = renderCard(spec);
    list.prepend(node);
    while (list.children.length > MAX_VISIBLE) {
      const oldest = list.lastElementChild;
      if (!oldest) break;
      const oldId = (oldest as HTMLElement).dataset.id;
      if (oldId) removeCard(oldId);
      else oldest.remove();
    }
    const timer = setTimeout(() => removeCard(spec.id), CARD_TTL_MS);
    timers.set(spec.id, timer as unknown as number);
  };

  let handle: WsClientHandle | null = null;
  if (!COUNCIL_PLATFORM_URL) {
    status.dataset.status = "closed";
    status.textContent = "Offline — councilPlatformUrl not configured";
  } else {
    handle = connectNetworkEvents(deriveWsUrl(COUNCIL_PLATFORM_URL), {
      onStatusChange: (s) => {
        status.dataset.status = s;
        status.textContent = s === "open"
          ? "Live"
          : s === "connecting"
          ? "Connecting…"
          : "Reconnecting…";
      },
      onHello: (events) => {
        for (const f of events) {
          const card = frameToCard(f);
          if (card) showCard(card);
        }
      },
      onEvent: (f) => {
        const card = frameToCard(f);
        if (card) showCard(card);
      },
    });
  }

  onCleanup(() => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    handle?.close();
  });

  return root;
}
