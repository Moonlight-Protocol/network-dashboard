/**
 * Dashboard configuration.
 * Reads from global config object set in index.html or defaults.
 */

export interface ChannelConfig {
  privacyChannelId: string;
  assetCode: string;
}

export interface CouncilConfig {
  name: string;
  channelAuthId: string;
  channels: ChannelConfig[];
  jurisdictions: string[];
  website?: string;
}

interface DashboardConfig {
  environment?: string;
  stellarNetwork?: "testnet" | "mainnet" | "standalone";
  rpcUrl?: string;
  councils?: CouncilConfig[];
}

declare global {
  interface Window {
    __DASHBOARD_CONFIG__?: DashboardConfig;
  }
}

// Read config from globalThis to work in both browser and Deno test environments.
// window.__DASHBOARD_CONFIG__ is set by config.js which loads before app.js.
const config: DashboardConfig | undefined =
  "__DASHBOARD_CONFIG__" in globalThis
    ? (globalThis as Record<string, unknown>).__DASHBOARD_CONFIG__ as DashboardConfig
    : undefined;
if (!config && typeof document !== "undefined") {
  console.warn("Dashboard config not found — using testnet defaults. Ensure config.js loads before app.js.");
}

const c = config ?? {};

export const ENVIRONMENT = c.environment ?? "development";
export const IS_PRODUCTION = ENVIRONMENT === "production";
export const STELLAR_NETWORK = c.stellarNetwork ?? "testnet";
export const RPC_URL = c.rpcUrl ?? "https://soroban-testnet.stellar.org";
export const COUNCILS: CouncilConfig[] = c.councils ?? [];

export function getNetworkPassphrase(): string {
  switch (STELLAR_NETWORK) {
    case "mainnet": return "Public Global Stellar Network ; September 2015";
    case "standalone": return "Standalone Network ; February 2017";
    default: return "Test SDF Network ; September 2015";
  }
}
