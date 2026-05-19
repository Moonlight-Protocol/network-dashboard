import type { AssetBreakdownRow } from "../lib/network-events.ts";
import { formatPercent, formatStroops } from "../lib/format.ts";

/**
 * §4 (right) — Asset breakdown. Horizontal bar per asset showing share
 * of total volume settled (deposits + settlements) over the trailing 24h.
 * Rows sorted by percent descending.
 */

export class AssetBreakdown {
  private root: HTMLElement;
  private list: HTMLElement;

  constructor() {
    this.root = document.createElement("section");
    this.root.className = "section asset-breakdown";
    this.root.setAttribute("aria-label", "24h asset volume breakdown");

    const header = document.createElement("header");
    header.className = "asset-breakdown-header";
    const title = document.createElement("span");
    title.className = "asset-breakdown-title";
    title.textContent = "Asset volume — last 24h";
    header.appendChild(title);

    this.list = document.createElement("div");
    this.list.className = "asset-breakdown-list";

    this.root.append(header, this.list);
  }

  element(): HTMLElement {
    return this.root;
  }

  render(rows: AssetBreakdownRow[]): void {
    this.list.textContent = "";
    if (rows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "asset-breakdown-empty";
      empty.textContent = "No volume settled yet in the last 24h.";
      this.list.appendChild(empty);
      return;
    }
    for (const row of rows) {
      const r = document.createElement("article");
      r.className = "asset-row";

      const code = document.createElement("span");
      code.className = "asset-code";
      code.textContent = row.assetCode;

      const barBox = document.createElement("div");
      barBox.className = "asset-bar-box";
      const bar = document.createElement("div");
      bar.className = "asset-bar";
      const pct = Math.max(0, Math.min(100, row.percent));
      bar.style.width = `${pct}%`;
      barBox.appendChild(bar);

      const percent = document.createElement("span");
      percent.className = "asset-percent";
      percent.textContent = formatPercent(row.percent);

      const amount = document.createElement("span");
      amount.className = "asset-amount";
      amount.textContent = formatStroops(row.amountStroops);

      r.append(code, barBox, percent, amount);
      this.list.appendChild(r);
    }
  }
}
