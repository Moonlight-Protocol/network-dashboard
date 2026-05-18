/**
 * Runtime config for the SPA. Populated at build time by
 * `.github/workflows/deploy.yml` (testnet vs mainnet) and rewritten by
 * `local-dev`'s `infra-up.sh` for the local stack. The browser reads
 * `globalThis.__DASHBOARD_CONFIG__` set in `public/config.js` (loaded
 * before `app.js`).
 */

interface DashboardConfig {
  environment?: "development" | "production";
  /** Base URL of the network-dashboard-platform service (no trailing slash). */
  networkDashboardPlatformUrl?: string;
}

declare global {
  interface Window {
    __DASHBOARD_CONFIG__?: DashboardConfig;
  }
}

const cfg = "__DASHBOARD_CONFIG__" in globalThis
  ? (globalThis as Record<string, unknown>)
    .__DASHBOARD_CONFIG__ as DashboardConfig
  : undefined;

export const ENVIRONMENT = cfg?.environment ?? "development";
export const IS_PRODUCTION = ENVIRONMENT === "production";

/**
 * Network-dashboard-platform URL. In production this is set by the deploy
 * pipeline. In local-dev it falls back to `http://localhost:8080` so a
 * developer running `deno task serve` on the canonical port still works.
 */
export const NETWORK_DASHBOARD_PLATFORM_URL: string =
  cfg?.networkDashboardPlatformUrl?.replace(/\/+$/, "") ??
    (IS_PRODUCTION ? "" : "http://localhost:8080");

if (!NETWORK_DASHBOARD_PLATFORM_URL && typeof document !== "undefined") {
  console.warn(
    "networkDashboardPlatformUrl not configured — dashboard will not connect to the network feed.",
  );
}
