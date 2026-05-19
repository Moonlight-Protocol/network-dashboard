import type { Sparklines } from "../lib/network-events.ts";

/**
 * §4 (left) — Three sparkline charts. 60 buckets per series, one bucket
 * per minute (oldest left, newest right).
 *
 * SVG polyline rendered per series. The Y-axis scales independently per
 * chart so a tiny volume series doesn't squash the throughput chart.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const CHART_W = 320;
const CHART_H = 80;
const PAD_X = 8;
const PAD_Y = 10;

type Series = {
  key: keyof Sparklines;
  title: string;
  unit: string;
  stroke: string;
};

const SERIES: Series[] = [
  {
    key: "throughput",
    title: "Throughput",
    unit: "events/min",
    stroke: "#1c7ed6",
  },
  { key: "latency", title: "Latency", unit: "ms (avg)", stroke: "#9775fa" },
  { key: "volume", title: "Volume", unit: "asset units", stroke: "#2f9e44" },
];

export class SparklineGroup {
  private root: HTMLElement;
  private charts = new Map<keyof Sparklines, {
    svg: SVGSVGElement;
    line: SVGPolylineElement;
    valueEl: HTMLSpanElement;
  }>();

  constructor() {
    this.root = document.createElement("section");
    this.root.className = "section sparklines";
    this.root.setAttribute("aria-label", "60-minute rolling sparklines");

    for (const s of SERIES) {
      const card = document.createElement("article");
      card.className = "sparkline-card";

      const header = document.createElement("header");
      header.className = "sparkline-header";
      const title = document.createElement("span");
      title.className = "sparkline-title";
      title.textContent = s.title;
      const value = document.createElement("span");
      value.className = "sparkline-value";
      value.textContent = "—";
      header.append(title, value);

      const svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("viewBox", `0 0 ${CHART_W} ${CHART_H}`);
      svg.setAttribute("preserveAspectRatio", "none");
      svg.classList.add("sparkline-svg");

      const baseline = document.createElementNS(SVG_NS, "line");
      baseline.setAttribute("x1", String(PAD_X));
      baseline.setAttribute("y1", String(CHART_H - PAD_Y));
      baseline.setAttribute("x2", String(CHART_W - PAD_X));
      baseline.setAttribute("y2", String(CHART_H - PAD_Y));
      baseline.setAttribute("stroke", "#dee2e6");
      baseline.setAttribute("stroke-width", "1");

      const line = document.createElementNS(SVG_NS, "polyline");
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", s.stroke);
      line.setAttribute("stroke-width", "2");
      line.setAttribute("stroke-linejoin", "round");
      line.setAttribute("stroke-linecap", "round");

      svg.append(baseline, line);

      const unit = document.createElement("span");
      unit.className = "sparkline-unit";
      unit.textContent = s.unit;

      card.append(header, svg, unit);
      this.root.appendChild(card);
      this.charts.set(s.key, { svg, line, valueEl: value });
    }
  }

  element(): HTMLElement {
    return this.root;
  }

  render(sparklines: Sparklines): void {
    this.paintSeries("throughput", sparklines.throughput);
    this.paintLatency(sparklines.latency);
    this.paintSeries("volume", sparklines.volume);
  }

  private paintSeries(
    key: "throughput" | "volume",
    series: number[],
  ): void {
    const chart = this.charts.get(key);
    if (!chart) return;
    if (series.length === 0) {
      chart.line.setAttribute("points", "");
      chart.valueEl.textContent = "—";
      return;
    }
    const max = Math.max(...series, 1);
    const points = series.map((v, i) => {
      const x = projectX(i, series.length);
      const y = projectY(v, max);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    chart.line.setAttribute("points", points);
    const latest = series[series.length - 1];
    chart.valueEl.textContent = formatTrend(latest);
  }

  private paintLatency(series: Array<number | null>): void {
    const chart = this.charts.get("latency");
    if (!chart) return;
    if (series.length === 0) {
      chart.line.setAttribute("points", "");
      chart.valueEl.textContent = "—";
      return;
    }
    const numeric = series.filter((v): v is number => v !== null);
    const max = Math.max(...numeric, 1);
    // Bridge nulls with the last seen value so the line stays continuous;
    // if there's no seen value yet, anchor at zero so the chart doesn't
    // start with a spike.
    let lastSeen = 0;
    const points = series.map((v, i) => {
      if (v !== null) lastSeen = v;
      const x = projectX(i, series.length);
      const y = projectY(lastSeen, max);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    chart.line.setAttribute("points", points);
    const latest = numeric.length > 0 ? numeric[numeric.length - 1] : null;
    chart.valueEl.textContent = latest === null ? "—" : `${latest} ms`;
  }
}

function projectX(i: number, count: number): number {
  if (count <= 1) return CHART_W / 2;
  const span = CHART_W - PAD_X * 2;
  return PAD_X + (span * i) / (count - 1);
}

function projectY(value: number, max: number): number {
  if (!Number.isFinite(value) || value < 0) value = 0;
  if (max <= 0) max = 1;
  const span = CHART_H - PAD_Y * 2;
  return CHART_H - PAD_Y - (span * Math.min(value, max)) / max;
}

function formatTrend(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}
