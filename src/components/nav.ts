import { escapeHtml } from "../lib/dom.ts";

declare const __APP_VERSION__: string;
const appVersion: string = __APP_VERSION__;

export function renderNav(): HTMLElement {
  const nav = document.createElement("nav");
  nav.innerHTML = `
    <div class="nav-inner">
      <a href="#/" class="nav-brand">Moonlight Network <span class="version-badge">v${escapeHtml(appVersion)}</span></a>
      <div class="nav-links">
        <a href="#/map">Map</a>
        <a href="#/councils">Councils</a>
        <a href="#/transactions">Transactions</a>
      </div>
    </div>
  `;
  return nav;
}
