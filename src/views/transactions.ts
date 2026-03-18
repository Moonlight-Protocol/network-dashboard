/**
 * Transaction feed — recent transactions across all channels.
 */
import { renderNav } from "../components/nav.ts";
import { COUNCILS } from "../lib/config.ts";
import { getContractEvents, queryErrors } from "../lib/stellar.ts";
import { escapeHtml, truncateAddress, timeAgo } from "../lib/dom.ts";
import { onCleanup } from "../lib/router.ts";
import type { ContractEvent } from "../lib/stellar.ts";

interface FeedEntry {
  event: ContractEvent;
  councilName: string;
  channelAsset: string;
  channelId: string;
}

export async function transactionsView(): Promise<HTMLElement> {
  const el = document.createElement("div");
  el.appendChild(renderNav());

  const main = document.createElement("main");
  main.className = "container";
  main.innerHTML = `
    <h2>Transaction Feed</h2>
    <p class="text-muted">Recent on-chain activity across all channels.</p>
    <div id="tx-content"><div class="loading">Loading transactions...</div></div>
  `;
  el.appendChild(main);

  const ctx = { cancelled: false };
  onCleanup(() => { ctx.cancelled = true; });

  loadTransactions(main, ctx);

  return el;
}

async function loadTransactions(main: HTMLElement, ctx: { cancelled: boolean }): Promise<void> {
  const feed: FeedEntry[] = [];
  const promises: Promise<void>[] = [];

  for (const council of COUNCILS) {
    promises.push(
      getContractEvents(council.channelAuthId, undefined, 50).then(events => {
        for (const event of events) {
          feed.push({
            event,
            councilName: council.name,
            channelAsset: "\u2014",
            channelId: council.channelAuthId,
          });
        }
      }),
    );

    for (const ch of council.channels) {
      promises.push(
        getContractEvents(ch.privacyChannelId, undefined, 50).then(events => {
          for (const event of events) {
            feed.push({
              event,
              councilName: council.name,
              channelAsset: ch.assetCode,
              channelId: ch.privacyChannelId,
            });
          }
        }),
      );
    }
  }

  await Promise.allSettled(promises);

  if (ctx.cancelled) return;

  feed.sort((a, b) => b.event.ledger - a.event.ledger);

  renderFeed(main, feed);
}

function eventIcon(type: string): string {
  switch (type) {
    case "ProviderAdded": return "+PP";
    case "ProviderRemoved": return "-PP";
    case "ContractInitialized": return "INIT";
    default: return "TX";
  }
}

function eventBadgeClass(type: string): string {
  switch (type) {
    case "ProviderAdded": return "badge-active";
    case "ProviderRemoved": return "badge-inactive";
    case "ContractInitialized": return "badge-pending";
    default: return "badge-active";
  }
}

function renderFeed(main: HTMLElement, feed: FeedEntry[]): void {
  const content = main.querySelector("#tx-content");
  if (!content) return;

  if (feed.length === 0) {
    const hasErrors = queryErrors.length > 0;
    content.innerHTML = `
      <div class="empty-state">
        <p>No recent transactions found.</p>
        ${hasErrors
          ? `<p class="error-text">Network queries encountered errors. The RPC may be unreachable.</p>`
          : `<p class="text-muted">Transactions will appear here as channels process bundles.</p>`}
      </div>
    `;
    return;
  }

  const txCount = feed.filter(f => !["ProviderAdded", "ProviderRemoved", "ContractInitialized"].includes(f.event.type)).length;
  const providerEvents = feed.filter(f => f.event.type === "ProviderAdded" || f.event.type === "ProviderRemoved").length;

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card">
        <span class="stat-value">${feed.length}</span>
        <span class="stat-label">Total Events</span>
      </div>
      <div class="stat-card active">
        <span class="stat-value">${txCount}</span>
        <span class="stat-label">Transactions</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${providerEvents}</span>
        <span class="stat-label">Provider Events</span>
      </div>
    </div>

    <div class="feed-list">
      ${feed.slice(0, 100).map(entry => `
        <div class="feed-item">
          <div class="feed-item-header">
            <span class="badge ${eventBadgeClass(entry.event.type)}">${escapeHtml(eventIcon(entry.event.type))}</span>
            <span class="feed-event-type">${escapeHtml(entry.event.type)}</span>
            <span class="text-muted">${entry.event.timestamp ? timeAgo(entry.event.timestamp) : `Ledger ${entry.event.ledger}`}</span>
          </div>
          <div class="feed-item-details">
            <span class="text-muted">Council:</span> ${escapeHtml(entry.councilName)}
            ${entry.channelAsset !== "\u2014" ? `<span class="text-muted" style="margin-left:1rem">Asset:</span> ${escapeHtml(entry.channelAsset)}` : ""}
          </div>
          <div class="feed-item-id mono">${truncateAddress(entry.channelId)}</div>
        </div>
      `).join("")}
    </div>
  `;
}
