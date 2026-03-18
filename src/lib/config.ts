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

declare global {
  interface Window {
    __DASHBOARD_CONFIG__?: {
      environment?: string;
      rpcUrl?: string;
      horizonUrl?: string;
      councils?: CouncilConfig[];
    };
  }
}

const config = window.__DASHBOARD_CONFIG__ ?? {};

export const ENVIRONMENT = config.environment ?? "development";
export const IS_PRODUCTION = ENVIRONMENT === "production";
export const RPC_URL = config.rpcUrl ?? "https://soroban-testnet.stellar.org";
export const HORIZON_URL = config.horizonUrl ?? "https://horizon-testnet.stellar.org";
export const COUNCILS: CouncilConfig[] = config.councils ?? [];
