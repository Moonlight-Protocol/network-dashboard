/**
 * Map view — world map with councils plotted by jurisdiction.
 */
import { renderNav } from "../components/nav.ts";
import { COUNCILS } from "../lib/config.ts";
import { COUNTRY_COORDS, getCountryName } from "../lib/geo.ts";
import { escapeHtml, truncateAddress } from "../lib/dom.ts";

export function mapView(): HTMLElement {
  const el = document.createElement("div");

  const nav = renderNav();
  el.appendChild(nav);

  const main = document.createElement("main");
  main.className = "container";

  // Build council dots
  const dots: string[] = [];
  const labels: string[] = [];

  for (const council of COUNCILS) {
    for (const code of council.jurisdictions) {
      const coord = COUNTRY_COORDS[code];
      if (!coord) continue;

      const channels = council.channels.length;
      const radius = Math.min(6 + channels * 2, 14);

      dots.push(
        `<circle cx="${coord.x}" cy="${coord.y}" r="${radius}" class="council-dot" data-council="${escapeHtml(council.name)}" data-country="${code}">` +
        `<title>${escapeHtml(council.name)} — ${escapeHtml(coord.name)}</title></circle>`
      );

      labels.push(
        `<text x="${coord.x}" y="${coord.y + radius + 12}" class="council-label">${escapeHtml(council.name)}</text>`
      );
    }
  }

  main.innerHTML = `
    <h2>Network Map</h2>
    <p class="text-muted">Councils by declared jurisdiction. Dot size reflects number of channels.</p>

    <div class="map-container">
      <svg viewBox="0 0 1000 500" class="world-map">
        <!-- Simple world map outline -->
        <rect width="1000" height="500" fill="var(--bg)" rx="8" />

        <!-- Grid lines -->
        <g stroke="var(--border)" stroke-width="0.5" opacity="0.3">
          ${Array.from({ length: 9 }, (_, i) => `<line x1="${(i + 1) * 100}" y1="0" x2="${(i + 1) * 100}" y2="500" />`).join("")}
          ${Array.from({ length: 4 }, (_, i) => `<line x1="0" y1="${(i + 1) * 100}" x2="1000" y2="${(i + 1) * 100}" />`).join("")}
        </g>

        <!-- Continent outlines (simplified) -->
        <g fill="none" stroke="var(--border)" stroke-width="1" opacity="0.4">
          <!-- North America -->
          <path d="M120,80 L280,80 L300,140 L280,180 L240,250 L200,260 L160,240 L130,200 L100,160 L120,80Z" />
          <!-- South America -->
          <path d="M240,260 L320,260 L350,300 L360,350 L340,400 L310,430 L280,420 L260,380 L250,320 L240,260Z" />
          <!-- Europe -->
          <path d="M450,100 L570,100 L580,130 L560,170 L530,190 L480,190 L460,170 L450,140Z" />
          <!-- Africa -->
          <path d="M460,200 L580,200 L600,260 L590,340 L570,400 L540,420 L500,400 L470,340 L460,280Z" />
          <!-- Asia -->
          <path d="M580,80 L830,80 L850,150 L830,220 L780,260 L700,280 L640,260 L600,220 L580,160Z" />
          <!-- Australia -->
          <path d="M770,340 L860,340 L880,380 L860,430 L800,440 L770,410 L760,370Z" />
        </g>

        <!-- Council dots -->
        <g>
          ${dots.join("\n          ")}
        </g>

        <!-- Labels -->
        <g>
          ${labels.join("\n          ")}
        </g>
      </svg>
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
            <span>${c.jurisdictions.map(j => getCountryName(j)).join(", ")}</span>
          </div>
          <div class="council-card-id mono">${truncateAddress(c.channelAuthId)}</div>
        </a>
      `).join("")}
    </div>
  `;

  el.appendChild(main);
  return el;
}
