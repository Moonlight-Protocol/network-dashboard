/**
 * Council detail view — drill into a council's channels, PPs, and activity.
 */
import { renderNav } from "../components/nav.ts";
import { COUNCILS } from "../lib/config.ts";
import { getChannelSupply, getContractEvents, getProviderCount, queryErrors, clearQueryErrors } from "../lib/stellar.ts";
import { escapeHtml, truncateAddress, formatAmount, timeAgo, sanitizeUrl } from "../lib/dom.ts";
import { getCountryName } from "../lib/world-map.ts";
import { onCleanup } from "../lib/router.ts";
import type { CouncilConfig } from "../lib/config.ts";
import type { ContractEvent } from "../lib/stellar.ts";

export async function councilDetailView(params?: Record<string, string>): Promise<HTMLElement> {
  const el = document.createElement("div");
  el.appendChild(renderNav());

  const main = document.createElement("main");
  main.className = "container";

  let councilId = "";
  try {
    councilId = params?.id ? decodeURIComponent(params.id) : "";
  } catch {
    // Malformed percent-encoding in URL
  }
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

  const safeWebsite = council.website ? sanitizeUrl(council.website) : null;

  main.innerHTML = `
    <div style="margin-bottom:1rem">
      <a href="#/councils" class="btn-link">&larr; All Councils</a>
    </div>
    <h2>${escapeHtml(council.name)}</h2>
    <p class="mono text-muted" style="font-size:0.8rem;margin-bottom:0.5rem">${escapeHtml(council.channelAuthId)}</p>
    <p class="text-muted">${council.jurisdictions.map(j => escapeHtml(getCountryName(j))).join(", ")}${safeWebsite ? ` &middot; <a href="${escapeHtml(safeWebsite)}" target="_blank" rel="noopener">${escapeHtml(council.website!)}</a>` : ""}</p>
    <div id="council-detail-content"><div class="loading">Loading council data...</div></div>
  `;
  el.appendChild(main);

  const ctx = { cancelled: false };
  onCleanup(() => { ctx.cancelled = true; });

  loadCouncilDetail(main, council, ctx);

  return el;
}

async function loadCouncilDetail(main: HTMLElement, council: CouncilConfig, ctx: { cancelled: boolean }): Promise<void> {
  clearQueryErrors();
  const channelData: { id: string; asset: string; supply: bigint }[] = [];
  const allEvents: ContractEvent[] = [];

  const promises: Promise<void>[] = [];

  for (const ch of council.channels) {
    promises.push(
      getChannelSupply(ch.privacyChannelId).then(supply => {
        channelData.push({ id: ch.privacyChannelId, asset: ch.assetCode, supply });
      }),
    );
  }

  let providerResult = { count: 0, fromEvents: true };
  promises.push(
    getProviderCount(council.channelAuthId).then(r => { providerResult = r; }),
  );

  promises.push(
    getContractEvents(council.channelAuthId, undefined, 100).then(events => {
      allEvents.push(...events);
    }),
  );

  for (const ch of council.channels) {
    promises.push(
      getContractEvents(ch.privacyChannelId, undefined, 100).then(events => {
        allEvents.push(...events);
      }),
    );
  }

  await Promise.allSettled(promises);
  if (ctx.cancelled) return;

  allEvents.sort((a, b) => b.ledger - a.ledger);

  const content = main.querySelector("#council-detail-content");
  if (!content) return;

  const totalSupply = channelData.reduce((sum, c) => sum + c.supply, 0n);
  const txEvents = allEvents.filter(e =>
    !["ProviderAdded", "ProviderRemoved", "ContractInitialized"].includes(e.type)
  );

  // Extract provider addresses from events
  const providerAddrs: string[] = [];
  for (const e of allEvents) {
    if (e.type === "ProviderAdded" && e.value) providerAddrs.push(String(e.value));
  }
  const removedAddrs = new Set(
    allEvents.filter(e => e.type === "ProviderRemoved" && e.value).map(e => String(e.value)),
  );
  const activeProviders = [...new Set(providerAddrs)].filter(a => !removedAddrs.has(a));

  const hasErrors = queryErrors.length > 0;
  const providerNote = providerResult.fromEvents
    ? ' <span class="text-muted" title="Based on recent on-chain events">(recent)</span>'
    : "";

  content.innerHTML = `
    ${hasErrors ? `<div class="error-banner">Some data may be incomplete — network queries failed.</div>` : ""}

    <div class="stats-row">
      <div class="stat-card active">
        <span class="stat-value">${channelData.length}</span>
        <span class="stat-label">Channels</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${providerResult.count}</span>
        <span class="stat-label">Providers${providerNote}</span>
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

    ${activeProviders.length > 0 ? `
      <h3>Registered Providers</h3>
      <table>
        <thead>
          <tr>
            <th>Provider Address</th>
          </tr>
        </thead>
        <tbody>
          ${activeProviders.map(p => `
            <tr>
              <td class="mono">${escapeHtml(p)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    ` : `
      <h3>Registered Providers</h3>
      <div class="empty-state"><p>No providers discovered from recent on-chain events.</p></div>
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
