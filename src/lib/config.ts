/**
 * Public-config surface for the network-dashboard SPA.
 *
 * Values are read from `globalThis.__DASHBOARD_CONFIG__` (set by
 * `public/config.js`, which the static server includes ahead of the
 * bundled SPA). Production envs ship a substituted `config.js`; local-dev
 * uses the committed default that points at the loopback stack.
 */

interface DashboardConfig {
  environment?: string;
  stellarNetwork?: "testnet" | "mainnet" | "standalone";
  networkDashboardPlatformUrl?: string;
  explorerBaseUrl?: string;
  posthogKey?: string;
  posthogHost?: string;
}

declare global {
  interface Window {
    __DASHBOARD_CONFIG__?: DashboardConfig;
  }
}

const config: DashboardConfig | undefined = "__DASHBOARD_CONFIG__" in globalThis
  ? (globalThis as Record<string, unknown>)
    .__DASHBOARD_CONFIG__ as DashboardConfig
  : undefined;
if (!config && typeof document !== "undefined") {
  console.warn(
    "Dashboard config not found — using testnet defaults. Ensure config.js loads before app.js.",
  );
}

const c = config ?? {};

export const ENVIRONMENT = c.environment ?? "development";
export const IS_PRODUCTION = ENVIRONMENT === "production";
export const STELLAR_NETWORK = c.stellarNetwork ?? "testnet";

/**
 * Base URL for the network-dashboard-platform WebSocket. The SPA appends
 * `/api/v1/network/ws` to form the final URL. Empty means "no WS configured"
 * — the SPA paints an idle layout with a connection-status banner instead
 * of throwing.
 */
export const NETWORK_DASHBOARD_PLATFORM_URL: string =
  (c.networkDashboardPlatformUrl ?? "").trim();

/**
 * Base URL of the chain explorer's network-scoped page (e.g.
 * "https://stellar.expert/explorer/testnet"). Empty means "no explorer
 * configured": views render explorer links only when a base is set.
 */
export const EXPLORER_BASE_URL: string = (c.explorerBaseUrl ?? "").trim();

/**
 * Explorer URL for a transaction, or null when no explorer base is
 * configured (e.g. standalone networks Stellar Expert can't resolve).
 */
export function explorerTxUrl(txHash: string): string | null {
  if (!EXPLORER_BASE_URL) return null;
  return `${EXPLORER_BASE_URL.replace(/\/+$/, "")}/tx/${txHash}`;
}

export const POSTHOG_KEY = c.posthogKey ?? "";
export const POSTHOG_HOST = c.posthogHost ?? "https://us.i.posthog.com";
