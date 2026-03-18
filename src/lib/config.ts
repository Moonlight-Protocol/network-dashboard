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
  horizonUrl?: string;
  councils?: CouncilConfig[];
}

declare global {
  interface Window {
    __DASHBOARD_CONFIG__?: DashboardConfig;
  }
}

// Use globalThis to work in both browser and Deno test environments
const g = globalThis as unknown as { __DASHBOARD_CONFIG__?: DashboardConfig };
const config = g.__DASHBOARD_CONFIG__;
if (!config && typeof document !== "undefined") {
  console.warn("Dashboard config not found — using testnet defaults. Ensure config.js loads before app.js.");
}

const c = config ?? {};

export const ENVIRONMENT = c.environment ?? "development";
export const IS_PRODUCTION = ENVIRONMENT === "production";
export const STELLAR_NETWORK = c.stellarNetwork ?? "testnet";
export const RPC_URL = c.rpcUrl ?? "https://soroban-testnet.stellar.org";
export const HORIZON_URL = c.horizonUrl ?? "https://horizon-testnet.stellar.org";
export const COUNCILS: CouncilConfig[] = c.councils ?? [];

export function getNetworkPassphrase(): string {
  switch (STELLAR_NETWORK) {
    case "mainnet": return "Public Global Stellar Network ; September 2015";
    case "standalone": return "Standalone Network ; February 2017";
    default: return "Test SDF Network ; September 2015";
  }
}
