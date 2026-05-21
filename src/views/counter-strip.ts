import type { Counters } from "../lib/network-events.ts";
import { formatCount, formatLatencyMs } from "../lib/format.ts";

/**
 * §1 — Counter strip. Six full-width tiles. Order matches the locked
 * sketch and the SnapshotFrame.counters field order.
 */

type TileKey = keyof Counters;

const TILE_ORDER: Array<{ key: TileKey; label: string }> = [
  { key: "councils", label: "COUNCILS" },
  { key: "activePPs", label: "ACTIVE PPs" },
  { key: "eventsLast24h", label: "EVENTS / 24H" },
  { key: "assetsRegistered", label: "ASSETS" },
  { key: "throughputPerMin", label: "THROUGHPUT" },
  { key: "latencyMs", label: "LATENCY" },
];

const ZERO_COUNTERS: Counters = {
  councils: 0,
  activePPs: 0,
  eventsLast24h: 0,
  assetsRegistered: 0,
  throughputPerMin: 0,
  latencyMs: null,
};

export class CounterStrip {
  private root: HTMLElement;
  private tiles = new Map<TileKey, HTMLElement>();
  private state: Counters = { ...ZERO_COUNTERS };

  constructor() {
    this.root = document.createElement("section");
    this.root.className = "section counter-strip";
    this.root.setAttribute("aria-label", "Network counters");
    for (const { key, label } of TILE_ORDER) {
      const tile = document.createElement("article");
      tile.className = "counter-tile";
      tile.dataset.counter = String(key);

      const labelEl = document.createElement("div");
      labelEl.className = "counter-label";
      labelEl.textContent = label;

      const valueEl = document.createElement("div");
      valueEl.className = "counter-value";
      valueEl.textContent = "—";

      tile.append(labelEl, valueEl);
      this.tiles.set(key, valueEl);
      this.root.appendChild(tile);
    }
    this.paint();
  }

  element(): HTMLElement {
    return this.root;
  }

  render(counters: Counters): void {
    this.state = { ...counters };
    this.paint();
  }

  /**
   * Per-event ticker for EVENTS / 24H. The snapshot is the source of
   * truth; this gives the user a "something happened" tick between
   * snapshot updates so the layout doesn't feel frozen.
   */
  bumpFromLiveEvent(): void {
    this.state = {
      ...this.state,
      eventsLast24h: this.state.eventsLast24h + 1,
    };
    const el = this.tiles.get("eventsLast24h");
    if (el) el.textContent = formatCount(this.state.eventsLast24h);
  }

  private paint(): void {
    for (const { key } of TILE_ORDER) {
      const el = this.tiles.get(key);
      if (!el) continue;
      el.textContent = this.formatValue(key, this.state);
    }
  }

  private formatValue(key: TileKey, counters: Counters): string {
    if (key === "latencyMs") return formatLatencyMs(counters.latencyMs);
    return formatCount(counters[key] as number);
  }
}
