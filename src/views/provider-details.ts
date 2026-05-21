import { truncateAddress } from "../lib/dom.ts";
import type {
  CouncilTopologyEntry,
  NetworkEvent,
} from "../lib/network-events.ts";

/**
 * Provider info column in the §3 detail trio. Sibling of CountryDetails
 * and CouncilDetails — collapsed-with-hint until a PP is selected, then
 * shows that PP's full pubkey, label, the set of councils they're a
 * member of, and a recent-bundle count derived from the activity ring
 * buffer.
 *
 * Drilldown path: country click → country-details lists councils →
 * council click → council-details lists PPs → PP click → this panel.
 */
export class ProviderDetails {
  private root: HTMLElement;
  private hint: HTMLElement;
  private panel: HTMLElement;
  private topology: CouncilTopologyEntry[] = [];
  private recent: NetworkEvent[] = [];
  private selectedPubKey: string | null = null;

  constructor() {
    this.root = document.createElement("section");
    this.root.className = "section provider-details";
    this.root.setAttribute("aria-label", "Provider details");

    this.hint = document.createElement("div");
    this.hint.className = "provider-details-hint";
    this.hint.textContent = "Click a PP to see details.";

    this.panel = document.createElement("div");
    this.panel.className = "provider-details-panel hidden";

    this.root.append(this.hint, this.panel);
  }

  element(): HTMLElement {
    return this.root;
  }

  setTopology(topology: CouncilTopologyEntry[]): void {
    this.topology = topology;
    if (this.selectedPubKey) this.paint();
  }

  setRecent(events: NetworkEvent[]): void {
    this.recent = events;
    if (this.selectedPubKey) this.paint();
  }

  select(pubKey: string): void {
    this.selectedPubKey = pubKey;
    this.paint();
  }

  clear(): void {
    this.selectedPubKey = null;
    this.panel.classList.add("hidden");
    this.hint.classList.remove("hidden");
    this.panel.textContent = "";
  }

  private paint(): void {
    if (!this.selectedPubKey) return;
    const pubKey = this.selectedPubKey;

    // Council memberships — derived from the topology each snapshot.
    const councils = this.topology.filter((c) =>
      c.providers.some((p) => p.publicKey === pubKey)
    );
    if (councils.length === 0) {
      // PP no longer in any council (just removed) — clear panel.
      this.clear();
      return;
    }

    const label = councils
      .flatMap((c) => c.providers)
      .find((p) => p.publicKey === pubKey)?.label?.trim() ?? "";

    const bundleCount = this.recent.reduce((n, ev) => {
      if (ev.kind !== "channel_bundle") return n;
      const p = ev.payload;
      return typeof p.providerPublicKey === "string" &&
          p.providerPublicKey === pubKey
        ? n + 1
        : n;
    }, 0);

    this.panel.textContent = "";
    this.panel.classList.remove("hidden");
    this.hint.classList.add("hidden");

    const header = document.createElement("header");
    header.className = "provider-details-header";
    const title = document.createElement("h2");
    title.className = "provider-details-title";
    title.textContent = label || truncateAddress(pubKey);
    header.appendChild(title);
    this.panel.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "provider-details-grid";
    grid.appendChild(kvBlock("Councils", String(councils.length)));
    grid.appendChild(kvBlock("Bundles (recent)", String(bundleCount)));
    this.panel.appendChild(grid);

    const pkHeader = document.createElement("div");
    pkHeader.className = "provider-details-subheader";
    pkHeader.textContent = "Public key";
    this.panel.appendChild(pkHeader);

    const pk = document.createElement("div");
    pk.className = "provider-details-pubkey";
    pk.textContent = pubKey;
    this.panel.appendChild(pk);

    const cHeader = document.createElement("div");
    cHeader.className = "provider-details-subheader";
    cHeader.textContent = "Member of";
    this.panel.appendChild(cHeader);

    const list = document.createElement("ul");
    list.className = "provider-details-council-list";
    for (const c of councils) {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.className = "provider-details-council-name";
      name.textContent = c.name?.trim() || truncateAddress(c.id);
      const juris = document.createElement("span");
      juris.className = "provider-details-council-juris";
      juris.textContent = c.jurisdictions.length > 0
        ? c.jurisdictions.map((j) => j.toUpperCase()).join(", ")
        : "—";
      li.append(name, juris);
      list.appendChild(li);
    }
    this.panel.appendChild(list);
  }
}

function kvBlock(label: string, value: string): HTMLElement {
  const block = document.createElement("div");
  block.className = "provider-details-kv";
  const l = document.createElement("span");
  l.className = "provider-details-kv-label";
  l.textContent = label;
  const v = document.createElement("span");
  v.className = "provider-details-kv-value";
  v.textContent = value;
  block.append(l, v);
  return block;
}
