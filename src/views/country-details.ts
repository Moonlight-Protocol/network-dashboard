import { COUNTRIES } from "@moonlight/ui/world-map";
import type { CouncilTopologyEntry } from "../lib/network-events.ts";

/**
 * Right-rail panel paired with §5's world map. Clicking a country on the
 * map updates this panel with the list of councils whose jurisdictions
 * include that country: name, providers, channels, and the full
 * jurisdictions list each council operates in.
 *
 * Defaults to a "click a country" hint while no country is selected.
 */
export type CouncilClickHandler = (councilId: string) => void;

export class CountryDetails {
  private root: HTMLElement;
  private hint: HTMLElement;
  private panel: HTMLElement;
  private councils: CouncilTopologyEntry[] = [];
  private selectedCountry: string | null = null;
  private onCouncilClick: CouncilClickHandler | null = null;

  constructor() {
    this.root = document.createElement("section");
    this.root.className = "section country-details";
    this.root.setAttribute("aria-label", "Country council details");

    this.hint = document.createElement("div");
    this.hint.className = "country-details-hint";
    this.hint.textContent = "Click a country on the map to see its councils.";

    this.panel = document.createElement("div");
    this.panel.className = "country-details-panel hidden";

    this.root.append(this.hint, this.panel);
  }

  element(): HTMLElement {
    return this.root;
  }

  setTopology(topology: CouncilTopologyEntry[]): void {
    this.councils = topology;
    if (this.selectedCountry) this.paint();
  }

  setOnCouncilClick(handler: CouncilClickHandler | null): void {
    this.onCouncilClick = handler;
  }

  select(code: string): void {
    this.selectedCountry = code.toUpperCase();
    this.paint();
  }

  clear(): void {
    this.selectedCountry = null;
    this.panel.classList.add("hidden");
    this.hint.classList.remove("hidden");
    this.panel.textContent = "";
  }

  private paint(): void {
    if (!this.selectedCountry) return;
    const code = this.selectedCountry;
    const match = this.councils.filter((c) =>
      c.jurisdictions.some((j) => j.toUpperCase() === code)
    );

    this.panel.textContent = "";
    this.panel.classList.remove("hidden");
    this.hint.classList.add("hidden");

    const header = document.createElement("header");
    header.className = "country-details-header";
    const title = document.createElement("h2");
    title.className = "country-details-title";
    title.textContent = COUNTRIES[code]?.name ?? code;
    const codeBadge = document.createElement("span");
    codeBadge.className = "country-details-code";
    codeBadge.textContent = code;
    header.append(title, codeBadge);
    this.panel.appendChild(header);

    if (match.length === 0) {
      const empty = document.createElement("div");
      empty.className = "country-details-empty";
      empty.textContent = "No councils operate in this jurisdiction.";
      this.panel.appendChild(empty);
      return;
    }

    const list = document.createElement("ul");
    list.className = "country-details-list";
    for (const c of match) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "country-details-council";
      btn.addEventListener("click", () => this.onCouncilClick?.(c.id));

      const name = document.createElement("div");
      name.className = "country-details-council-name";
      name.textContent = c.name ?? c.id.slice(0, 12);
      btn.appendChild(name);

      const meta = document.createElement("div");
      meta.className = "country-details-council-meta";
      const ppCount = c.providers.length;
      const chCount = c.channels.length;
      const ppText = `${ppCount} PP${ppCount === 1 ? "" : "s"}`;
      const chText = `${chCount} channel${chCount === 1 ? "" : "s"}`;
      meta.textContent = `${ppText} · ${chText}`;
      btn.appendChild(meta);

      if (c.jurisdictions.length > 1) {
        const juris = document.createElement("div");
        juris.className = "country-details-council-juris";
        const others = c.jurisdictions
          .map((j) => j.toUpperCase())
          .filter((j) => j !== code);
        juris.textContent = `Also: ${others.join(", ")}`;
        btn.appendChild(juris);
      }

      li.appendChild(btn);
      list.appendChild(li);
    }
    this.panel.appendChild(list);
  }
}
