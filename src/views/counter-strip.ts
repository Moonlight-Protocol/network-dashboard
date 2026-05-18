import type { Counters } from "../lib/network-events.ts";

/**
 * Zone 1 — top counter strip. Four boxes per the design sketch (blue
 * outline `#1971c2` / fill `#e7f5ff`), labels: COUNCILS / ACTIVE PPs /
 * EVENTS / 24H / ASSETS REGISTERED.
 */

const LABELS = {
  councils: "COUNCILS",
  activePPs: "ACTIVE PPs",
  eventsLast24h: "EVENTS / 24H",
  assetsRegistered: "ASSETS REGISTERED",
} as const;

const KEYS: ReadonlyArray<keyof Counters> = [
  "councils",
  "activePPs",
  "eventsLast24h",
  "assetsRegistered",
];

export class CounterStrip {
  private root: HTMLElement;
  private values: Record<keyof Counters, HTMLElement>;

  constructor() {
    this.root = document.createElement("section");
    this.root.className = "zone counter-strip";
    const cells: Partial<Record<keyof Counters, HTMLElement>> = {};
    for (const key of KEYS) {
      const cell = document.createElement("div");
      cell.className = "counter-cell";
      const value = document.createElement("div");
      value.className = "counter-value";
      value.textContent = "—";
      const label = document.createElement("div");
      label.className = "counter-label";
      label.textContent = LABELS[key];
      cell.append(value, label);
      this.root.appendChild(cell);
      cells[key] = value;
    }
    this.values = cells as Record<keyof Counters, HTMLElement>;
  }

  element(): HTMLElement {
    return this.root;
  }

  render(counters: Counters): void {
    for (const key of KEYS) {
      this.values[key].textContent = counters[key].toLocaleString();
    }
  }
}
