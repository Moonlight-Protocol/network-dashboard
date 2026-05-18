import type {
  CouncilTopologyEntry,
  NetworkEvent,
} from "../lib/network-events.ts";

/**
 * Zone 2 — topology. Yellow MOONLIGHT center with councils on a fixed ring,
 * PP satellites around each council. Tx pulses animate along edges on
 * each event (~1s fade).
 *
 * SVG-based, no physics; positions are recomputed only when the topology
 * frame changes (snapshot or hourly re-sync). PP satellites are placed
 * on an arc outside each council node, pointing radially away from
 * Moonlight.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

const VIEW_W = 800;
const VIEW_H = 600;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2;

const MOON_RX = 70;
const MOON_RY = 36;
const COUNCIL_BASE_R = 22;
const PP_R = 8;
const COUNCIL_ORBIT = 200;
const PP_ORBIT_OFFSET = 50;

const PULSE_FADE_MS = 1_000;

const KIND_PULSE_COLOR: Record<string, string> = {
  council_formed: "#9775fa", // purple
  provider_added: "#2f9e44", // green
  provider_removed: "#868e96", // gray
  asset_registered: "#f59f00", // amber
  channel_deposit: "#e8590c", // orange
  channel_settlement: "#1c7ed6", // blue
  channel_bundle: "#15aabf", // teal
};

const DEFAULT_PULSE_COLOR = "#f03e3e"; // red

type Layout = {
  councils: Map<string, { x: number; y: number; r: number }>;
  pps: Map<string, { x: number; y: number; councilId: string }>;
};

export class Topology {
  private root: HTMLElement;
  private svg: SVGSVGElement;
  private edgesLayer: SVGGElement;
  private nodesLayer: SVGGElement;
  private pulsesLayer: SVGGElement;
  private layout: Layout = { councils: new Map(), pps: new Map() };

  constructor() {
    this.root = document.createElement("section");
    this.root.className = "zone topology";

    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.setAttribute("viewBox", `0 0 ${VIEW_W} ${VIEW_H}`);
    this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    this.svg.classList.add("topology-svg");

    this.edgesLayer = this.makeGroup("edges");
    this.nodesLayer = this.makeGroup("nodes");
    this.pulsesLayer = this.makeGroup("pulses");

    this.svg.append(this.edgesLayer, this.nodesLayer, this.pulsesLayer);
    this.root.appendChild(this.svg);
  }

  element(): HTMLElement {
    return this.root;
  }

  render(topology: CouncilTopologyEntry[]): void {
    this.edgesLayer.textContent = "";
    this.nodesLayer.textContent = "";
    this.layout = { councils: new Map(), pps: new Map() };

    // Moonlight center
    const center = document.createElementNS(SVG_NS, "ellipse");
    center.setAttribute("cx", `${CX}`);
    center.setAttribute("cy", `${CY}`);
    center.setAttribute("rx", `${MOON_RX}`);
    center.setAttribute("ry", `${MOON_RY}`);
    center.setAttribute("fill", "#fff3bf");
    center.setAttribute("stroke", "#000");
    center.setAttribute("stroke-width", "3");
    this.nodesLayer.appendChild(center);

    const centerLabel = document.createElementNS(SVG_NS, "text");
    centerLabel.setAttribute("x", `${CX}`);
    centerLabel.setAttribute("y", `${CY + 5}`);
    centerLabel.setAttribute("text-anchor", "middle");
    centerLabel.classList.add("topology-label-center");
    centerLabel.textContent = "MOONLIGHT";
    this.nodesLayer.appendChild(centerLabel);

    if (topology.length === 0) return;

    const angleStep = (Math.PI * 2) / topology.length;
    for (let i = 0; i < topology.length; i++) {
      const council = topology[i];
      const angle = -Math.PI / 2 + i * angleStep;
      const cx = CX + Math.cos(angle) * COUNCIL_ORBIT;
      const cy = CY + Math.sin(angle) * COUNCIL_ORBIT;
      const r = Math.min(COUNCIL_BASE_R + council.providers.length, 40);
      this.layout.councils.set(council.id, { x: cx, y: cy, r });

      // edge: moonlight → council
      this.drawEdge(CX, CY, cx, cy);

      // council node
      const node = document.createElementNS(SVG_NS, "circle");
      node.setAttribute("cx", `${cx}`);
      node.setAttribute("cy", `${cy}`);
      node.setAttribute("r", `${r}`);
      node.setAttribute("fill", "#d3f9d8");
      node.setAttribute("stroke", "#2f9e44");
      node.setAttribute("stroke-width", "2");
      // Native SVG tooltip on hover — full public council info.
      const tooltip = document.createElementNS(SVG_NS, "title");
      const ppList = council.providers
        .map((p) => `  ${p.label ?? "(unlabelled)"} — ${p.publicKey}`)
        .join("\n");
      const jurList = council.jurisdictions.length
        ? council.jurisdictions.join(", ")
        : "(none declared)";
      tooltip.textContent = `${council.name ?? "Council"}
Council ID: ${council.id}
Jurisdictions: ${jurList}
Providers (${council.providers.length}):
${ppList || "  (none)"}`;
      node.appendChild(tooltip);
      this.nodesLayer.appendChild(node);

      const label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("x", `${cx}`);
      label.setAttribute("y", `${cy + r + 16}`);
      label.setAttribute("text-anchor", "middle");
      label.classList.add("topology-label-council");
      label.textContent = council.name ?? "Council";
      this.nodesLayer.appendChild(label);

      // Jurisdiction badges below the name.
      if (council.jurisdictions.length > 0) {
        const juris = document.createElementNS(SVG_NS, "text");
        juris.setAttribute("x", `${cx}`);
        juris.setAttribute("y", `${cy + r + 30}`);
        juris.setAttribute("text-anchor", "middle");
        juris.classList.add("topology-jurisdictions");
        juris.textContent = council.jurisdictions.join(" · ");
        this.nodesLayer.appendChild(juris);
      }

      const ppCountLabel = document.createElementNS(SVG_NS, "text");
      ppCountLabel.setAttribute("x", `${cx}`);
      ppCountLabel.setAttribute("y", `${cy + 4}`);
      ppCountLabel.setAttribute("text-anchor", "middle");
      ppCountLabel.classList.add("topology-pp-count");
      ppCountLabel.textContent = `${council.providers.length} PP${
        council.providers.length === 1 ? "" : "s"
      }`;
      this.nodesLayer.appendChild(ppCountLabel);

      // PP satellites
      const ppCount = council.providers.length;
      if (ppCount === 0) continue;
      const fanSpan = Math.PI / 2; // 90° fan outward
      const fanStep = ppCount === 1 ? 0 : fanSpan / (ppCount - 1);
      const baseAngle = angle - fanSpan / 2;
      for (let j = 0; j < ppCount; j++) {
        const pp = council.providers[j];
        const ppAngle = baseAngle + j * fanStep;
        const px = cx + Math.cos(ppAngle) * PP_ORBIT_OFFSET;
        const py = cy + Math.sin(ppAngle) * PP_ORBIT_OFFSET;

        this.drawEdge(cx, cy, px, py, 0.5);

        const ppNode = document.createElementNS(SVG_NS, "circle");
        ppNode.setAttribute("cx", `${px}`);
        ppNode.setAttribute("cy", `${py}`);
        ppNode.setAttribute("r", `${PP_R}`);
        ppNode.setAttribute("fill", "#ffe8cc");
        ppNode.setAttribute("stroke", "#e8590c");
        ppNode.setAttribute("stroke-width", "2");
        const ppTip = document.createElementNS(SVG_NS, "title");
        ppTip.textContent = `${pp.label ?? "(unlabelled PP)"}
${pp.publicKey}
on ${council.name ?? "Council"}`;
        ppNode.appendChild(ppTip);
        this.nodesLayer.appendChild(ppNode);

        this.layout.pps.set(pp.publicKey, {
          x: px,
          y: py,
          councilId: council.id,
        });
      }
    }
  }

  /**
   * Spawn a tx pulse for the given event. Placement depends on event kind:
   *  - council-scoped events pulse the moonlight↔council edge midpoint
   *  - PP-scoped events pulse the council↔PP edge midpoint
   *  - asset / deposit / settlement pulse the moonlight↔council edge
   *
   * Missing-target events (council not in current layout) are silently
   * dropped — the next snapshot will reconcile and the event remains in
   * the activity feed regardless.
   */
  pulse(event: NetworkEvent): void {
    const council = this.layout.councils.get(event.councilId);
    if (!council) return;
    const colour = KIND_PULSE_COLOR[event.kind] ?? DEFAULT_PULSE_COLOR;

    // PP events pulse on the council↔PP edge if we can resolve the PP.
    if (
      (event.kind === "provider_added" || event.kind === "provider_removed") &&
      typeof event.payload.providerPublicKey === "string"
    ) {
      const pp = this.layout.pps.get(event.payload.providerPublicKey);
      if (pp && pp.councilId === event.councilId) {
        this.spawnPulse((council.x + pp.x) / 2, (council.y + pp.y) / 2, colour);
        return;
      }
    }
    // Default: pulse the moonlight↔council edge midpoint.
    this.spawnPulse((CX + council.x) / 2, (CY + council.y) / 2, colour);
  }

  private spawnPulse(x: number, y: number, colour: string): void {
    const pulse = document.createElementNS(SVG_NS, "circle");
    pulse.setAttribute("cx", `${x}`);
    pulse.setAttribute("cy", `${y}`);
    pulse.setAttribute("r", "7");
    pulse.setAttribute("fill", colour);
    pulse.setAttribute("stroke", colour);
    pulse.setAttribute("stroke-width", "2");
    pulse.classList.add("topology-pulse");
    this.pulsesLayer.appendChild(pulse);
    setTimeout(() => pulse.remove(), PULSE_FADE_MS);
  }

  private drawEdge(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    opacity = 0.35,
  ): void {
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", `${x1}`);
    line.setAttribute("y1", `${y1}`);
    line.setAttribute("x2", `${x2}`);
    line.setAttribute("y2", `${y2}`);
    line.setAttribute("stroke", "#adb5bd");
    line.setAttribute("stroke-width", "1");
    line.setAttribute("opacity", `${opacity}`);
    this.edgesLayer.appendChild(line);
  }

  private makeGroup(name: string): SVGGElement {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("data-layer", name);
    return g as SVGGElement;
  }
}
