/**
 * Map view — world map with councils plotted by jurisdiction.
 * Uses a static SVG map (simple-world-map, CC BY-SA 3.0).
 */
import { renderNav } from "../components/nav.ts";
import { COUNCILS } from "../lib/config.ts";
import { fetchWorldSvg, projectCountry, getCountryName } from "../lib/world-map.ts";
import { escapeHtml, truncateAddress } from "../lib/dom.ts";
import { onCleanup } from "../lib/router.ts";

export async function mapView(): Promise<HTMLElement> {
  const el = document.createElement("div");
  el.appendChild(renderNav());

  const main = document.createElement("main");
  main.className = "container";
  main.innerHTML = `
    <h2>Network Map</h2>
    <p class="text-muted">Councils by declared jurisdiction. Dot size reflects number of channels.</p>
    <div class="map-container">
      <div id="map-loading" class="loading" style="text-align:center;padding:4rem 0">Loading map...</div>
    </div>
    <h3>Councils by Jurisdiction</h3>
    <div class="council-grid">
      ${COUNCILS.map(c => `
        <a href="#/council/${encodeURIComponent(c.channelAuthId)}" class="council-card">
          <div class="council-card-header">
            <span class="council-name">${escapeHtml(c.name)}</span>
            <span class="badge badge-active">${c.channels.length} channel${c.channels.length !== 1 ? "s" : ""}</span>
          </div>
          <div class="council-card-meta">
            <span>${c.jurisdictions.map(j => escapeHtml(getCountryName(j))).join(", ")}</span>
          </div>
          <div class="council-card-id mono">${truncateAddress(c.channelAuthId)}</div>
        </a>
      `).join("")}
    </div>
  `;
  el.appendChild(main);

  const ctx = { cancelled: false };
  onCleanup(() => { ctx.cancelled = true; });

  try {
    const svgText = await fetchWorldSvg();
    if (ctx.cancelled) return el;

    const mapContainer = main.querySelector(".map-container")!;

    // Parse the SVG to extract paths, then wrap in our styled SVG
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
    const origSvg = svgDoc.querySelector("svg");
    if (!origSvg) throw new Error("Invalid SVG");

    const viewBox = origSvg.getAttribute("viewBox") || "0 0 800 500";

    // Extract all path elements
    const pathElements = svgDoc.querySelectorAll("path");
    const pathStrings: string[] = [];
    pathElements.forEach(p => {
      const d = p.getAttribute("d");
      if (d) pathStrings.push(d);
    });

    const dots = buildCouncilMarkers();

    mapContainer.innerHTML = `
      <svg viewBox="${viewBox}" class="world-map" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
        <!-- Background -->
        <rect x="${viewBox.split(" ")[0]}" y="${viewBox.split(" ")[1]}"
              width="${viewBox.split(" ")[2]}" height="${viewBox.split(" ")[3]}"
              fill="var(--surface)" />

        <!-- Land masses -->
        <g fill="#1e2130" stroke="var(--border)" stroke-width="0.3">
          ${pathStrings.map(d => `<path d="${d}" />`).join("\n          ")}
        </g>

        <!-- Council markers -->
        ${dots}
      </svg>
    `;
  } catch (err) {
    console.warn("[map] Failed to load world map:", err);
    if (!ctx.cancelled) {
      const mapContainer = main.querySelector(".map-container")!;
      mapContainer.innerHTML = `<div class="empty-state"><p>Failed to load map. Please try again later.</p></div>`;
    }
  }

  return el;
}

function buildCouncilMarkers(): string {
  const markers: string[] = [];

  for (const council of COUNCILS) {
    for (const code of council.jurisdictions) {
      const pos = projectCountry(code, 0, 0);
      if (!pos) continue;

      const channels = council.channels.length;
      const r = Math.min(4 + channels * 2, 10);

      markers.push(
        `<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="${r + 6}" fill="var(--primary)" opacity="0.15" />`,
      );
      markers.push(
        `<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="${r + 2}" fill="none" stroke="var(--primary)" stroke-width="1" opacity="0.5" />`,
      );
      markers.push(
        `<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="${r}" class="council-dot">` +
        `<title>${escapeHtml(council.name)} — ${escapeHtml(getCountryName(code))}</title></circle>`,
      );
      markers.push(
        `<text x="${pos.x.toFixed(1)}" y="${(pos.y - r - 6).toFixed(1)}" class="council-label">${escapeHtml(council.name)}</text>`,
      );
    }
  }

  return markers.join("\n        ");
}
