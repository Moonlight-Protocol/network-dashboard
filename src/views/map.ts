/**
 * Map view — world map with councils plotted by jurisdiction.
 */
import { renderNav } from "../components/nav.ts";
import { COUNCILS } from "../lib/config.ts";
import { fetchWorldPaths, projectCountry, getCountryName } from "../lib/world-map.ts";
import { escapeHtml, truncateAddress } from "../lib/dom.ts";
import { onCleanup } from "../lib/router.ts";

const MAP_W = 1000;
const MAP_H = 500;

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

  // Load the map async
  try {
    const paths = await fetchWorldPaths(MAP_W, MAP_H);
    if (ctx.cancelled) return el;

    const dots = buildCouncilMarkers();
    const mapContainer = main.querySelector(".map-container")!;

    mapContainer.innerHTML = `
      <svg viewBox="0 0 ${MAP_W} ${MAP_H}" class="world-map" xmlns="http://www.w3.org/2000/svg">
        <!-- Background -->
        <rect width="${MAP_W}" height="${MAP_H}" fill="var(--surface)" rx="8" />

        <!-- Graticule -->
        <g stroke="var(--border)" stroke-width="0.3" opacity="0.3">
          ${Array.from({ length: 11 }, (_, i) => {
            const x = (i + 1) * (MAP_W / 12);
            return `<line x1="${x}" y1="0" x2="${x}" y2="${MAP_H}" />`;
          }).join("")}
          ${Array.from({ length: 5 }, (_, i) => {
            const y = (i + 1) * (MAP_H / 6);
            return `<line x1="0" y1="${y}" x2="${MAP_W}" y2="${y}" />`;
          }).join("")}
        </g>

        <!-- Equator -->
        <line x1="0" y1="${MAP_H / 2}" x2="${MAP_W}" y2="${MAP_H / 2}"
              stroke="var(--border)" stroke-width="0.4" opacity="0.5" stroke-dasharray="4,4" />

        <!-- Land masses -->
        <g fill="#1e2130" stroke="var(--border)" stroke-width="0.4">
          ${paths.map(d => `<path d="${d}" />`).join("\n          ")}
        </g>

        <!-- Council markers -->
        ${dots}
      </svg>
    `;
  } catch (err) {
    console.warn("[map] Failed to load world map:", err);
    if (!ctx.cancelled) {
      const mapContainer = main.querySelector(".map-container")!;
      mapContainer.innerHTML = `<div class="empty-state"><p>Failed to load map data. Please try again later.</p></div>`;
    }
  }

  return el;
}

function buildCouncilMarkers(): string {
  const markers: string[] = [];

  for (const council of COUNCILS) {
    for (const code of council.jurisdictions) {
      const pos = projectCountry(code, MAP_W, MAP_H);
      if (!pos) continue;

      const channels = council.channels.length;
      const r = Math.min(4 + channels * 2, 10);

      // Glow ring
      markers.push(
        `<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="${r + 6}" fill="var(--primary)" opacity="0.15" />`,
      );
      // Outer ring
      markers.push(
        `<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="${r + 2}" fill="none" stroke="var(--primary)" stroke-width="1" opacity="0.5" />`,
      );
      // Main dot
      markers.push(
        `<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="${r}" class="council-dot">` +
        `<title>${escapeHtml(council.name)} — ${escapeHtml(getCountryName(code))}</title></circle>`,
      );
      // Label
      markers.push(
        `<text x="${pos.x.toFixed(1)}" y="${(pos.y - r - 6).toFixed(1)}" class="council-label">${escapeHtml(council.name)}</text>`,
      );
    }
  }

  return markers.join("\n        ");
}
