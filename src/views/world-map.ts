import type { CouncilTopologyEntry } from "../lib/network-events.ts";
import {
  COUNTRIES,
  fetchWorldSvg,
  getCountryName,
  projectCountry,
  sanitizeSvgPath,
} from "../lib/world-map.ts";

/**
 * §5 — World map. Bottom strip showing jurisdictions of registered
 * councils as small markers on the SVG world atlas. Unknown / unresolvable
 * jurisdiction codes are silently dropped; the layout doesn't depend on
 * complete coverage.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

export class WorldMap {
  private root: HTMLElement;
  private mapHost: HTMLDivElement;
  private status: HTMLElement;
  private pendingTopology: CouncilTopologyEntry[] = [];
  private svgRoot: SVGSVGElement | null = null;
  private markerLayer: SVGGElement | null = null;
  private loading = false;
  private failed = false;

  constructor() {
    this.root = document.createElement("section");
    this.root.className = "section world-map";
    this.root.setAttribute("aria-label", "Council jurisdictions");

    const header = document.createElement("header");
    header.className = "world-map-header";
    const title = document.createElement("span");
    title.className = "world-map-title";
    title.textContent = "Council jurisdictions";
    const status = document.createElement("span");
    status.className = "world-map-status";
    status.textContent = "loading…";
    this.status = status;
    header.append(title, status);

    this.mapHost = document.createElement("div");
    this.mapHost.className = "world-map-host";

    this.root.append(header, this.mapHost);
  }

  element(): HTMLElement {
    return this.root;
  }

  render(topology: CouncilTopologyEntry[]): void {
    this.pendingTopology = topology;
    if (this.failed) {
      this.status.textContent = "map unavailable";
      return;
    }
    if (!this.svgRoot && !this.loading) {
      this.loadSvg();
      return;
    }
    if (this.svgRoot && this.markerLayer) this.repaintMarkers();
  }

  // ── internals ──────────────────────────────────────────────────────

  private async loadSvg(): Promise<void> {
    this.loading = true;
    try {
      const raw = await fetchWorldSvg();
      const parsed = new DOMParser().parseFromString(raw, "image/svg+xml");
      const svgEl = parsed.documentElement;
      if (svgEl.nodeName !== "svg") {
        throw new Error("world-map.svg did not parse as <svg>");
      }
      // Re-create an SVG in our namespace; copying nodes wholesale fails
      // some browsers' namespace checks when later querying.
      const svg = document.createElementNS(
        SVG_NS,
        "svg",
      ) as SVGSVGElement;
      const viewBox = svgEl.getAttribute("viewBox") ??
        "30.767 241.591 784.077 458.627";
      svg.setAttribute("viewBox", viewBox);
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.classList.add("world-map-svg");

      const paths = svgEl.querySelectorAll("path");
      const land = document.createElementNS(SVG_NS, "g") as SVGGElement;
      land.setAttribute("class", "world-map-land");
      for (const path of Array.from(paths)) {
        const d = sanitizeSvgPath(path.getAttribute("d") ?? "");
        if (!d) continue;
        const id = path.getAttribute("id");
        const newPath = document.createElementNS(SVG_NS, "path");
        newPath.setAttribute("d", d);
        newPath.setAttribute("fill", "#f1f3f5");
        newPath.setAttribute("stroke", "#dee2e6");
        newPath.setAttribute("stroke-width", "0.5");
        if (id) newPath.setAttribute("data-iso", id.toUpperCase());
        land.appendChild(newPath);
      }

      const markers = document.createElementNS(SVG_NS, "g") as SVGGElement;
      markers.setAttribute("class", "world-map-markers");

      svg.append(land, markers);
      this.mapHost.textContent = "";
      this.mapHost.appendChild(svg);

      this.svgRoot = svg;
      this.markerLayer = markers;
      this.repaintMarkers();
      this.status.textContent = "ready";
    } catch (err) {
      this.failed = true;
      console.warn("World map failed to load", err);
      this.status.textContent = "map unavailable";
      this.mapHost.textContent = "";
    } finally {
      this.loading = false;
    }
  }

  private repaintMarkers(): void {
    if (!this.markerLayer) return;
    this.markerLayer.textContent = "";

    const seen = new Map<string, string[]>();
    for (const c of this.pendingTopology) {
      for (const code of c.jurisdictions) {
        const upper = code.toUpperCase();
        if (!COUNTRIES[upper]) continue;
        const bucket = seen.get(upper) ?? [];
        bucket.push(c.name ?? c.id);
        seen.set(upper, bucket);
      }
    }

    if (seen.size === 0) {
      const hint = document.createElementNS(SVG_NS, "text");
      hint.setAttribute("x", "400");
      hint.setAttribute("y", "470");
      hint.setAttribute("text-anchor", "middle");
      hint.classList.add("world-map-hint");
      hint.textContent = "No council jurisdictions resolved yet.";
      this.markerLayer.appendChild(hint);
      this.status.textContent = "no jurisdictions";
      return;
    }

    for (const [code, councils] of seen) {
      const projected = projectCountry(code, 0, 0);
      if (!projected) continue;
      const group = document.createElementNS(SVG_NS, "g");
      group.classList.add("world-map-marker");
      group.dataset.iso = code;

      const dot = document.createElementNS(SVG_NS, "circle");
      dot.setAttribute("cx", String(projected.x));
      dot.setAttribute("cy", String(projected.y));
      dot.setAttribute("r", "6");
      dot.setAttribute("fill", "#e8590c");
      dot.setAttribute("stroke", "#ffe8cc");
      dot.setAttribute("stroke-width", "2");

      const title = document.createElementNS(SVG_NS, "title");
      title.textContent = `${getCountryName(code)} — ${councils.join(", ")}`;
      group.append(dot, title);
      this.markerLayer.appendChild(group);
    }
    this.status.textContent = `${seen.size} jurisdictions`;
  }
}
