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
  councilPlatformUrl?: string;
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
export const COUNCIL_PLATFORM_URL = c.councilPlatformUrl ?? "";

export function getNetworkPassphrase(): string {
  switch (STELLAR_NETWORK) {
    case "mainnet": return "Public Global Stellar Network ; September 2015";
    case "standalone": return "Standalone Network ; February 2017";
    default: return "Test SDF Network ; September 2015";
  }
}

interface PlatformCouncilEntry {
  council?: { name?: string; channelAuthId?: string } | null;
  jurisdictions?: { countryCode?: string }[];
  channels?: { channelContractId?: string; assetCode?: string }[];
}

function mapPlatformCouncils(entries: PlatformCouncilEntry[]): CouncilConfig[] {
  return entries
    .filter((e): e is PlatformCouncilEntry & { council: { channelAuthId: string } } =>
      !!e.council?.channelAuthId
    )
    .map((e) => ({
      name: e.council.name ?? "Unnamed council",
      channelAuthId: e.council.channelAuthId,
      jurisdictions: (e.jurisdictions ?? [])
        .map((j) => j.countryCode)
        .filter((code): code is string => !!code),
      channels: (e.channels ?? [])
        .filter((ch): ch is { channelContractId: string; assetCode?: string } =>
          !!ch.channelContractId
        )
        .map((ch) => ({
          privacyChannelId: ch.channelContractId,
          assetCode: ch.assetCode ?? "",
        })),
    }));
}

let councilsCache: Promise<CouncilConfig[]> | null = null;

/**
 * Returns the list of councils registered with council-platform.
 * Cached for the lifetime of the page — refresh the tab to repoll.
 * Returns an empty array if COUNCIL_PLATFORM_URL is not configured or the
 * fetch fails; views fall back to their own empty-state UI in that case.
 */
export function getCouncils(): Promise<CouncilConfig[]> {
  if (councilsCache) return councilsCache;

  if (!COUNCIL_PLATFORM_URL) {
    console.warn("councilPlatformUrl not configured — council list will be empty.");
    councilsCache = Promise.resolve([]);
    return councilsCache;
  }

  const url = `${COUNCIL_PLATFORM_URL.replace(/\/+$/, "")}/api/v1/public/councils`;
  councilsCache = fetch(url)
    .then(async (res) => {
      if (!res.ok) throw new Error(`council-platform returned HTTP ${res.status}`);
      const body = await res.json();
      const data = Array.isArray(body?.data) ? body.data : [];
      return mapPlatformCouncils(data);
    })
    .catch((err) => {
      console.warn("Failed to load councils from council-platform:", err);
      return [];
    });

  return councilsCache;
}
