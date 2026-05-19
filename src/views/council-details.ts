import type {
  CouncilRollingMetrics,
  CouncilTopologyEntry,
} from "../lib/network-events.ts";
import { truncateAddress } from "../lib/dom.ts";
import { formatStroops } from "../lib/format.ts";

/**
 * §3 — Council details. Collapsed by default with a "click a council
 * node for details" hint. When a council is selected, paints:
 *   - Council name + deployed-age (when available)
 *   - Jurisdiction
 *   - Channels count + total supply (sum of deposit minus settlement
 *     volume across council channels in the trailing hour)
 *   - Member PPs with full pubkey list
 *   - Assets registered (count + SAC symbols)
 *   - Recent activity (bundles last hour, rolling rate, deposit + settlement
 *     volume)
 *
 * The sketch deliberately omits a channels table — channels = assets, so
 * the asset list covers it.
 */

const EMPTY_METRICS: CouncilRollingMetrics = {
  bundlesLastHour: 0,
  eventsLastHour: 0,
  ratePerMin: 0,
  depositVolumeStroops: "0",
  settlementVolumeStroops: "0",
};

export class CouncilDetails {
  private root: HTMLElement;
  private hint: HTMLElement;
  private panel: HTMLElement;
  private councilsById = new Map<string, CouncilTopologyEntry>();
  private rolling: Record<string, CouncilRollingMetrics> = {};
  private selectedCouncilId: string | null = null;

  constructor() {
    this.root = document.createElement("section");
    this.root.className = "section council-details";

    this.hint = document.createElement("div");
    this.hint.className = "council-details-hint";
    this.hint.textContent = "Click a council node for details.";

    this.panel = document.createElement("div");
    this.panel.className = "council-details-panel hidden";

    this.root.append(this.hint, this.panel);
  }

  element(): HTMLElement {
    return this.root;
  }

  setTopology(topology: CouncilTopologyEntry[]): void {
    this.councilsById.clear();
    for (const c of topology) this.councilsById.set(c.id, c);
    if (
      this.selectedCouncilId && !this.councilsById.has(this.selectedCouncilId)
    ) {
      this.clear();
      return;
    }
    if (this.selectedCouncilId) this.paint();
  }

  setRollingMetrics(rolling: Record<string, CouncilRollingMetrics>): void {
    this.rolling = rolling;
    if (this.selectedCouncilId) this.paint();
  }

  select(councilId: string): void {
    if (!this.councilsById.has(councilId)) return;
    this.selectedCouncilId = councilId;
    this.paint();
  }

  clear(): void {
    this.selectedCouncilId = null;
    this.panel.classList.add("hidden");
    this.hint.classList.remove("hidden");
    this.panel.textContent = "";
  }

  // ── internals ──────────────────────────────────────────────────────

  private paint(): void {
    if (!this.selectedCouncilId) return;
    const council = this.councilsById.get(this.selectedCouncilId);
    if (!council) {
      this.clear();
      return;
    }
    const metrics = this.rolling[council.id] ?? EMPTY_METRICS;

    this.panel.textContent = "";
    this.panel.classList.remove("hidden");
    this.hint.classList.add("hidden");

    const headerRow = document.createElement("header");
    headerRow.className = "council-details-header";
    const nameEl = document.createElement("h2");
    nameEl.className = "council-details-name";
    nameEl.textContent = council.name ??
      `Council ${truncateAddress(council.id)}`;
    headerRow.appendChild(nameEl);
    if (council.jurisdictions.length > 0) {
      const j = document.createElement("span");
      j.className = "council-details-jurisdiction";
      j.textContent = council.jurisdictions.join(" · ");
      headerRow.appendChild(j);
    }
    this.panel.appendChild(headerRow);

    const grid = document.createElement("div");
    grid.className = "council-details-grid";

    const channelCount = council.channels.length;
    const totalSupply = formatStroops(
      this.computeTotalSupply(metrics),
    );

    grid.appendChild(
      kvBlock("Channels", String(channelCount)),
    );
    grid.appendChild(
      kvBlock("Net supply (1h)", totalSupply, "deposits − settlements"),
    );
    grid.appendChild(
      kvBlock(
        "Member PPs",
        String(council.providers.length),
      ),
    );
    grid.appendChild(
      kvBlock(
        "Assets",
        String(
          new Set(
            council.channels
              .map((c) => c.assetContractId)
              .filter((id): id is string => !!id),
          ).size,
        ),
        council.channels.map((c) => c.assetCode).join(", "),
      ),
    );
    grid.appendChild(
      kvBlock("Bundles (1h)", String(metrics.bundlesLastHour)),
    );
    grid.appendChild(
      kvBlock("Events / min", metrics.ratePerMin.toFixed(1)),
    );
    grid.appendChild(
      kvBlock(
        "Deposits (1h)",
        formatStroops(metrics.depositVolumeStroops),
      ),
    );
    grid.appendChild(
      kvBlock(
        "Settlements (1h)",
        formatStroops(metrics.settlementVolumeStroops),
      ),
    );
    this.panel.appendChild(grid);

    if (council.providers.length > 0) {
      const ppHeader = document.createElement("h3");
      ppHeader.className = "council-details-subheader";
      ppHeader.textContent = "Member PPs";
      this.panel.appendChild(ppHeader);

      const ppList = document.createElement("ul");
      ppList.className = "council-details-pp-list";
      for (const pp of council.providers) {
        const li = document.createElement("li");
        li.textContent = pp.publicKey;
        ppList.appendChild(li);
      }
      this.panel.appendChild(ppList);
    }
  }

  /**
   * Net supply over the last hour: deposits − settlements. The sketch
   * asks for "Total supply: N" across the council's channels; the backend
   * doesn't read live SAC balances (no application chain reads beyond
   * watcher events), so the best proxy is the trailing-hour net flow.
   * Labelled "Net supply (1h)" to be honest about the window.
   */
  private computeTotalSupply(metrics: CouncilRollingMetrics): string {
    try {
      const deposits = BigInt(metrics.depositVolumeStroops || "0");
      const settlements = BigInt(metrics.settlementVolumeStroops || "0");
      return (deposits - settlements).toString();
    } catch {
      return "0";
    }
  }
}

function kvBlock(label: string, value: string, sub?: string): HTMLElement {
  const block = document.createElement("div");
  block.className = "kv-block";
  const labelEl = document.createElement("span");
  labelEl.className = "kv-label";
  labelEl.textContent = label;
  const valueEl = document.createElement("span");
  valueEl.className = "kv-value";
  valueEl.textContent = value;
  block.append(labelEl, valueEl);
  if (sub) {
    const subEl = document.createElement("span");
    subEl.className = "kv-sub";
    subEl.textContent = sub;
    block.appendChild(subEl);
  }
  return block;
}
