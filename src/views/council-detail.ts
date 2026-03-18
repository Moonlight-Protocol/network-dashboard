/**
 * Council detail view — drill into a council's channels, PPs, and activity.
 */
import { renderNav } from "../components/nav.ts";
import { COUNCILS } from "../lib/config.ts";
import { getChannelSupply, getContractEvents } from "../lib/stellar.ts";
import { escapeHtml, truncateAddress, formatAmount, timeAgo } from "../lib/dom.ts";
import { getCountryName } from "../lib/geo.ts";
import { onCleanup } from "../lib/router.ts";
import type { CouncilConfig } from "../lib/config.ts";
import type { ContractEvent } from "../lib/stellar.ts";

export async function councilDetailView(params?: Record<string, string>): Promise<HTMLElement> {
  const el = document.createElement("div");
  el.appendChild(renderNav());

  const main = document.createElement("main");
  main.className = "container";

  const councilId = params?.id ? decodeURIComponent(params.id) : "";
  const council = COUNCILS.find(c => c.channelAuthId === councilId);

  if (!council) {
    main.innerHTML = `
      <h2>Council Not Found</h2>
      <p class="error-text">No council registered with ID ${escapeHtml(truncateAddress(councilId))}</p>
      <a href="#/councils" class="btn-link">Back to councils</a>
    `;
    el.appendChild(main);
    return el;
  }

  main.innerHTML = `
    <div style="margin-bottom:1rem">
      <a href="#/councils" class="btn-link">&larr; All Councils</a>
    </div>
    <h2>${escapeHtml(council.name)}</h2>
    <p class="mono text-muted" style="font-size:0.8rem;margin-bottom:0.5rem">${escapeHtml(council.channelAuthId)}</p>
    <p class="text-muted">${council.jurisdictions.map(j => getCountryName(j)).join(", ")}${council.website ? ` &middot; <a href="${escapeHtml(council.website)}" target="_blank" rel="noopener">${escapeHtml(council.website)}</a>` : ""}</p>
    <div id="council-detail-content"><div class="loading">Loading council data...</div></div>
  `;
  el.appendChild(main);

  let cancelled = false;
  onCleanup(() => { cancelled = true; });

  loadCouncilDetail(main, council, cancelled);

  return el;
}

async function loadCouncilDetail(main: HTMLElement, council: CouncilConfig, cancelled: boolean): Promise<void> {
  // Fetch all data in parallel
  const channelData: { id: string; asset: string; supply: bigint }[] = [];
  const allEvents: ContractEvent[] = [];
  const providers: string[] = [];

  const promises: Promise<void>[] = [];

  // Channel supplies
  for (const ch of council.channels) {
    promises.push(
      getChannelSupply(ch.privacyChannelId).then(supply => {
        channelData.push({ id: ch.privacyChannelId, asset: ch.assetCode, supply });
      }),
    );
  }

  // Channel Auth events
  promises.push(
    getContractEvents(council.channelAuthId, undefined, 100).then(events => {
      for (const e of events) {
        allEvents.push(e);
        if (e.type === "ProviderAdded" && e.value) {
          providers.push(String(e.value));
        }
      }
    }),
  );

  // Privacy Channel events
  for (const ch of council.channels) {
    promises.push(
      getContractEvents(ch.privacyChannelId, undefined, 100).then(events => {
        allEvents.push(...events);
      }),
    );
  }

  await Promise.allSettled(promises);
  if (cancelled) return;

  allEvents.sort((a, b) => b.ledger - a.ledger);

  const content = main.querySelector("#council-detail-content");
  if (!content) return;

  const totalSupply = channelData.reduce((sum, c) => sum + c.supply, 0n);
  const txEvents = allEvents.filter(e =>
    !["ProviderAdded", "ProviderRemoved", "ContractInitialized"].includes(e.type)
  );
  const uniqueProviders = [...new Set(providers)];

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card active">
        <span class="stat-value">${channelData.length}</span>
        <span class="stat-label">Channels</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${uniqueProviders.length}</span>
        <span class="stat-label">Providers</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${formatAmount(totalSupply)}</span>
        <span class="stat-label">Total Supply</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${txEvents.length}</span>
        <span class="stat-label">Recent Txns</span>
      </div>
    </div>

    <h3>Channels</h3>
    <table>
      <thead>
        <tr>
          <th>Channel ID</th>
          <th>Asset</th>
          <th>Supply</th>
        </tr>
      </thead>
      <tbody>
        ${channelData.map(ch => `
          <tr>
            <td class="mono">${truncateAddress(ch.id)}</td>
            <td>${escapeHtml(ch.asset)}</td>
            <td>${formatAmount(ch.supply)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    ${uniqueProviders.length > 0 ? `
      <h3>Registered Providers</h3>
      <table>
        <thead>
          <tr>
            <th>Provider Address</th>
          </tr>
        </thead>
        <tbody>
          ${uniqueProviders.map(p => `
            <tr>
              <td class="mono">${escapeHtml(p)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    ` : `
      <h3>Registered Providers</h3>
      <div class="empty-state"><p>No providers discovered from on-chain events yet.</p></div>
    `}

    <h3>Recent Activity</h3>
    ${allEvents.length > 0 ? `
      <div class="feed-list">
        ${allEvents.slice(0, 50).map(e => `
          <div class="feed-item">
            <div class="feed-item-header">
              <span class="badge ${e.type === "ProviderAdded" ? "badge-active" : e.type === "ProviderRemoved" ? "badge-inactive" : "badge-pending"}">${escapeHtml(e.type)}</span>
              <span class="text-muted">${e.timestamp ? timeAgo(e.timestamp) : `Ledger ${e.ledger}`}</span>
            </div>
            <div class="feed-item-id mono">${truncateAddress(e.contractId)}</div>
          </div>
        `).join("")}
      </div>
    ` : `
      <div class="empty-state"><p>No recent activity found.</p></div>
    `}
  `;
}
