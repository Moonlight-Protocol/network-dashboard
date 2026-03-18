/**
 * Council list view — all registered councils with on-chain state.
 */
import { renderNav } from "../components/nav.ts";
import { COUNCILS } from "../lib/config.ts";
import { getChannelSupply } from "../lib/stellar.ts";
import { getContractEvents } from "../lib/stellar.ts";
import { escapeHtml, truncateAddress, formatAmount } from "../lib/dom.ts";
import { getCountryName } from "../lib/geo.ts";
import { onCleanup } from "../lib/router.ts";

interface CouncilState {
  name: string;
  channelAuthId: string;
  jurisdictions: string[];
  website?: string;
  channels: {
    privacyChannelId: string;
    assetCode: string;
    supply: bigint;
  }[];
  providerCount: number;
  loading: boolean;
}

export async function councilsView(): Promise<HTMLElement> {
  const el = document.createElement("div");
  el.appendChild(renderNav());

  const main = document.createElement("main");
  main.className = "container";
  main.innerHTML = `
    <h2>Councils</h2>
    <p class="text-muted">All registered councils and their on-chain state.</p>
    <div id="councils-content"><div class="loading">Loading council data...</div></div>
  `;
  el.appendChild(main);

  let cancelled = false;
  onCleanup(() => { cancelled = true; });

  // Load data async
  loadCouncilData(main, cancelled);

  return el;
}

async function loadCouncilData(main: HTMLElement, cancelled: boolean): Promise<void> {
  const states: CouncilState[] = [];

  for (const council of COUNCILS) {
    const state: CouncilState = {
      name: council.name,
      channelAuthId: council.channelAuthId,
      jurisdictions: council.jurisdictions,
      website: council.website,
      channels: [],
      providerCount: 0,
      loading: true,
    };
    states.push(state);
  }

  // Render loading state
  renderCouncilTable(main, states);

  // Fetch all data in parallel
  const promises: Promise<void>[] = [];

  for (const state of states) {
    const council = COUNCILS.find(c => c.channelAuthId === state.channelAuthId)!;

    // Fetch supply for each channel
    for (const ch of council.channels) {
      promises.push(
        getChannelSupply(ch.privacyChannelId).then(supply => {
          state.channels.push({
            privacyChannelId: ch.privacyChannelId,
            assetCode: ch.assetCode,
            supply,
          });
        }),
      );
    }

    // Count providers from events
    promises.push(
      getContractEvents(state.channelAuthId).then(events => {
        let count = 0;
        for (const e of events) {
          if (e.type === "ProviderAdded") count++;
          if (e.type === "ProviderRemoved") count--;
        }
        state.providerCount = Math.max(0, count);
      }),
    );
  }

  await Promise.allSettled(promises);

  if (cancelled) return;

  for (const state of states) {
    state.loading = false;
  }
  renderCouncilTable(main, states);
}

function renderCouncilTable(main: HTMLElement, states: CouncilState[]): void {
  const content = main.querySelector("#councils-content");
  if (!content) return;

  if (states.length === 0) {
    content.innerHTML = `<div class="empty-state"><p>No councils registered yet.</p></div>`;
    return;
  }

  // Stats row
  const totalChannels = states.reduce((sum, s) => sum + s.channels.length, 0);
  const totalProviders = states.reduce((sum, s) => sum + s.providerCount, 0);
  const totalSupply = states.reduce((sum, s) =>
    sum + s.channels.reduce((cs, c) => cs + c.supply, 0n), 0n);

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card active">
        <span class="stat-value">${states.length}</span>
        <span class="stat-label">Councils</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${totalChannels}</span>
        <span class="stat-label">Channels</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${totalProviders}</span>
        <span class="stat-label">Providers</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${formatAmount(totalSupply)}</span>
        <span class="stat-label">Total Supply</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Council</th>
          <th>Jurisdiction</th>
          <th>Channels</th>
          <th>Providers</th>
          <th>Total Supply</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${states.map(s => {
          const supply = s.channels.reduce((sum, c) => sum + c.supply, 0n);
          return `
            <tr class="clickable-row" data-href="#/council/${encodeURIComponent(s.channelAuthId)}">
              <td>
                <div>${escapeHtml(s.name)}</div>
                <div class="mono text-muted" style="font-size:0.7rem">${truncateAddress(s.channelAuthId)}</div>
              </td>
              <td>${s.jurisdictions.map(j => escapeHtml(getCountryName(j))).join(", ")}</td>
              <td>${s.channels.length}</td>
              <td>${s.loading ? '<span class="text-muted">...</span>' : s.providerCount}</td>
              <td>${s.loading ? '<span class="text-muted">...</span>' : formatAmount(supply)}</td>
              <td><span class="badge badge-active">Active</span></td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  // Add click handlers for rows
  content.querySelectorAll(".clickable-row").forEach(row => {
    row.addEventListener("click", () => {
      const href = row.getAttribute("data-href");
      if (href) window.location.hash = href;
    });
  });
}
