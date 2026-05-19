import type {
  CouncilTopologyEntry,
  NetworkEvent,
  NetworkEventKind,
} from "../lib/network-events.ts";

/**
 * §2 (left) — Topology. Yellow MOONLIGHT center, council ring, PP-pubkey
 * satellites, edges from MOONLIGHT to each council (thickness = recent
 * throughput), red pulses on edges for every observed event.
 *
 * SVG-based; no physics. Positions are recomputed only when the topology
 * frame changes (snapshot or hourly re-sync).
 */

const SVG_NS = "http://www.w3.org/2000/svg";

const VIEW_W = 880;
const VIEW_H = 620;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2;

const MOON_RX = 70;
const MOON_RY = 36;
const COUNCIL_BASE_R = 24;
const PP_R = 5;
const COUNCIL_ORBIT = 210;
const PP_ORBIT_OFFSET = 28;
const PULSE_FADE_MS = 1_000;

const KIND_PULSE_COLOR: Record<NetworkEventKind, string> = {
  council_formed: "#9775fa",
  provider_added: "#2f9e44",
  provider_removed: "#868e96",
  asset_registered: "#f59f00",
  channel_deposit: "#e8590c",
  channel_settlement: "#1c7ed6",
  channel_bundle: "#15aabf",
};

const DEFAULT_PULSE_COLOR = "#f03e3e";

type CouncilLayout = {
  x: number;
  y: number;
  r: number;
  throughput: number;
};

export type CouncilClickHandler = (councilId: string) => void;

export class Topology {
  private root: HTMLElement;
  private svg: SVGSVGElement;
  private edgesLayer: SVGGElement;
  private nodesLayer: SVGGElement;
  private pulsesLayer: SVGGElement;
  private councilLayouts = new Map<string, CouncilLayout>();
  /** Recent-event count per council, decays linearly via a periodic timer. */
  private recentCounts = new Map<string, number>();
  private decayTimer: number | null = null;
  private onCouncilClick: CouncilClickHandler | null = null;
  private selectedCouncilId: string | null = null;

  constructor() {
    this.root = document.createElement("section");
    this.root.className = "section topology";

    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.setAttribute("viewBox", `0 0 ${VIEW_W} ${VIEW_H}`);
    this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    this.svg.classList.add("topology-svg");

    this.edgesLayer = this.makeGroup("edges");
    this.nodesLayer = this.makeGroup("nodes");
    this.pulsesLayer = this.makeGroup("pulses");
    this.svg.append(this.edgesLayer, this.nodesLayer, this.pulsesLayer);
    this.root.appendChild(this.svg);

    this.decayTimer = globalThis.setInterval(
      () => this.decayThroughput(),
      5_000,
    );
  }

  element(): HTMLElement {
    return this.root;
  }

  setCouncilClickHandler(handler: CouncilClickHandler): void {
    this.onCouncilClick = handler;
  }

  /**
   * Redraw the static layers (edges + council/PP nodes) from a topology
   * frame. Pulses remain — they are short-lived overlays.
   */
  render(topology: CouncilTopologyEntry[]): void {
    this.edgesLayer.textContent = "";
    this.nodesLayer.textContent = "";
    this.councilLayouts.clear();
    this.drawCenter();
    if (topology.length === 0) {
      this.drawEmptyState();
      return;
    }
    const angleStep = (Math.PI * 2) / topology.length;
    for (let i = 0; i < topology.length; i++) {
      const council = topology[i];
      const angle = -Math.PI / 2 + i * angleStep;
      const cx = CX + Math.cos(angle) * COUNCIL_ORBIT;
      const cy = CY + Math.sin(angle) * COUNCIL_ORBIT;
      const r = Math.min(
        COUNCIL_BASE_R + council.providers.length * 1.5,
        46,
      );
      const layout: CouncilLayout = { x: cx, y: cy, r, throughput: 0 };
      this.councilLayouts.set(council.id, layout);

      const throughput = this.recentCounts.get(council.id) ?? 0;
      layout.throughput = throughput;
      this.drawEdge(council.id, throughput);
      this.drawCouncilNode(council, layout);
    }
  }

  /**
   * Animate a tx pulse from MOONLIGHT to the council associated with the
   * event. Also nudges the council's "recent activity" counter so the
   * edge thickness grows for a few seconds before decaying.
   */
  pulse(event: NetworkEvent): void {
    const layout = this.councilLayouts.get(event.councilId);
    if (!layout) return;
    this.recentCounts.set(
      event.councilId,
      (this.recentCounts.get(event.councilId) ?? 0) + 1,
    );
    this.refreshEdge(event.councilId);
    const color = KIND_PULSE_COLOR[event.kind] ?? DEFAULT_PULSE_COLOR;
    const pulse = document.createElementNS(SVG_NS, "circle");
    pulse.setAttribute("cx", String(CX));
    pulse.setAttribute("cy", String(CY));
    pulse.setAttribute("r", "8");
    pulse.setAttribute("fill", color);
    pulse.setAttribute("opacity", "0.95");
    pulse.classList.add("topology-pulse");
    this.pulsesLayer.appendChild(pulse);

    const animate = pulse.animate(
      [
        { cx: `${CX}`, cy: `${CY}`, opacity: 0.95, r: 8 },
        {
          cx: `${layout.x}`,
          cy: `${layout.y}`,
          opacity: 0,
          r: 14,
        },
      ],
      { duration: PULSE_FADE_MS, easing: "ease-out", fill: "forwards" },
    );
    animate.onfinish = () => pulse.remove();
  }

  setSelectedCouncil(councilId: string | null): void {
    this.selectedCouncilId = councilId;
    for (const [id, _layout] of this.councilLayouts) {
      const node = this.nodesLayer.querySelector(
        `[data-council-id="${escapeAttrSelector(id)}"]`,
      );
      if (node) {
        node.classList.toggle("selected", id === councilId);
      }
    }
  }

  destroy(): void {
    if (this.decayTimer !== null) {
      clearInterval(this.decayTimer);
      this.decayTimer = null;
    }
  }

  // ── internals ──────────────────────────────────────────────────────

  private makeGroup(className: string): SVGGElement {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", className);
    return g;
  }

  private drawCenter(): void {
    const ellipse = document.createElementNS(SVG_NS, "ellipse");
    ellipse.setAttribute("cx", String(CX));
    ellipse.setAttribute("cy", String(CY));
    ellipse.setAttribute("rx", String(MOON_RX));
    ellipse.setAttribute("ry", String(MOON_RY));
    ellipse.setAttribute("fill", "#fff3bf");
    ellipse.setAttribute("stroke", "#000");
    ellipse.setAttribute("stroke-width", "3");
    ellipse.classList.add("topology-center");
    this.nodesLayer.appendChild(ellipse);

    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", String(CX));
    label.setAttribute("y", String(CY + 5));
    label.setAttribute("text-anchor", "middle");
    label.classList.add("topology-label-center");
    label.textContent = "MOONLIGHT";
    this.nodesLayer.appendChild(label);
  }

  private drawEmptyState(): void {
    const hint = document.createElementNS(SVG_NS, "text");
    hint.setAttribute("x", String(CX));
    hint.setAttribute("y", String(CY + 80));
    hint.setAttribute("text-anchor", "middle");
    hint.classList.add("topology-hint");
    hint.textContent =
      "Waiting for councils to register with network-dashboard-platform…";
    this.nodesLayer.appendChild(hint);
  }

  private drawEdge(councilId: string, throughput: number): void {
    const layout = this.councilLayouts.get(councilId);
    if (!layout) return;
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", String(CX));
    line.setAttribute("y1", String(CY));
    line.setAttribute("x2", String(layout.x));
    line.setAttribute("y2", String(layout.y));
    line.setAttribute("stroke", "#adb5bd");
    line.setAttribute("stroke-width", String(edgeWidth(throughput)));
    line.setAttribute("stroke-linecap", "round");
    line.dataset.councilEdge = councilId;
    this.edgesLayer.appendChild(line);
  }

  private refreshEdge(councilId: string): void {
    const line = this.edgesLayer.querySelector(
      `line[data-council-edge="${escapeAttrSelector(councilId)}"]`,
    ) as SVGLineElement | null;
    if (!line) return;
    const throughput = this.recentCounts.get(councilId) ?? 0;
    line.setAttribute("stroke-width", String(edgeWidth(throughput)));
  }

  private drawCouncilNode(
    council: CouncilTopologyEntry,
    layout: CouncilLayout,
  ): void {
    const group = document.createElementNS(SVG_NS, "g");
    group.dataset.councilId = council.id;
    group.classList.add("topology-council");
    if (council.id === this.selectedCouncilId) group.classList.add("selected");
    group.style.cursor = "pointer";
    group.addEventListener("click", () => this.onCouncilClick?.(council.id));

    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("cx", String(layout.x));
    circle.setAttribute("cy", String(layout.y));
    circle.setAttribute("r", String(layout.r));
    circle.setAttribute("fill", "#d3f9d8");
    circle.setAttribute("stroke", "#2f9e44");
    circle.setAttribute("stroke-width", "2");
    group.appendChild(circle);

    const name = document.createElementNS(SVG_NS, "text");
    name.setAttribute("x", String(layout.x));
    name.setAttribute("y", String(layout.y - 4));
    name.setAttribute("text-anchor", "middle");
    name.classList.add("topology-label-council");
    name.textContent = council.name ?? truncate(council.id, 10);
    group.appendChild(name);

    if (council.jurisdictions.length > 0) {
      const j = document.createElementNS(SVG_NS, "text");
      j.setAttribute("x", String(layout.x));
      j.setAttribute("y", String(layout.y + 10));
      j.setAttribute("text-anchor", "middle");
      j.classList.add("topology-label-jurisdiction");
      j.textContent = council.jurisdictions.join(" · ");
      group.appendChild(j);
    }

    // PP satellite dots: arranged on a small arc just outside the
    // council circle, pointing radially away from MOONLIGHT.
    const ppCount = council.providers.length;
    if (ppCount > 0) {
      const baseAngle = Math.atan2(layout.y - CY, layout.x - CX);
      const arcSpread = Math.min(Math.PI * 0.6, 0.25 + ppCount * 0.15);
      const startAngle = baseAngle - arcSpread / 2;
      const angleStep = ppCount === 1 ? 0 : arcSpread / (ppCount - 1);
      for (let i = 0; i < ppCount; i++) {
        const a = startAngle + angleStep * i;
        const px = layout.x + Math.cos(a) * (layout.r + PP_ORBIT_OFFSET);
        const py = layout.y + Math.sin(a) * (layout.r + PP_ORBIT_OFFSET);
        const dot = document.createElementNS(SVG_NS, "circle");
        dot.setAttribute("cx", String(px));
        dot.setAttribute("cy", String(py));
        dot.setAttribute("r", String(PP_R));
        dot.setAttribute("fill", "#ffe8cc");
        dot.setAttribute("stroke", "#e8590c");
        dot.setAttribute("stroke-width", "1.5");
        group.appendChild(dot);
      }
    }

    this.nodesLayer.appendChild(group);
  }

  /**
   * Each tick (every 5s) we subtract 1 from each council's recent count
   * so the edge thickness fades back when activity dies down.
   */
  private decayThroughput(): void {
    let changed = false;
    for (const [id, count] of this.recentCounts) {
      const next = Math.max(0, count - 1);
      if (next !== count) {
        this.recentCounts.set(id, next);
        changed = true;
      }
    }
    if (!changed) return;
    for (const id of this.councilLayouts.keys()) this.refreshEdge(id);
  }
}

function edgeWidth(throughput: number): number {
  // Linear ramp clamped between idle (1.2) and saturated (6).
  const w = 1.2 + throughput * 0.6;
  return Math.min(6, w);
}

function truncate(value: string, n: number): string {
  if (value.length <= n) return value;
  return `${value.slice(0, n - 1)}…`;
}

/**
 * CSS attribute selectors don't accept arbitrary strings; the contract
 * IDs we receive are alphanumeric, but escape just-in-case to keep
 * future inputs safe.
 */
function escapeAttrSelector(value: string): string {
  return value.replace(/(["\\])/g, "\\$1");
}
