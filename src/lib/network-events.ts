/**
 * Mirror of the network-dashboard-platform's v2 frame shape. Kept here so
 * the SPA can type-check incoming WS frames without depending on the
 * backend's source tree. When the backend bumps NETWORK_WS_SUBPROTOCOL the
 * SPA must update this file in lockstep.
 */

export const NETWORK_EVENT_KINDS = [
  "council_formed",
  "provider_added",
  "provider_removed",
  "asset_registered",
  "channel_deposit",
  "channel_settlement",
  "channel_bundle",
] as const;

export type NetworkEventKind = typeof NETWORK_EVENT_KINDS[number];

export type NetworkEvent = {
  id: string;
  kind: NetworkEventKind;
  councilId: string;
  councilName: string | null;
  ledger: number;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export type CouncilTopologyEntry = {
  id: string;
  name: string | null;
  providers: Array<{ publicKey: string; label: string | null }>;
  channels: Array<{
    contractId: string;
    assetCode: string;
    assetContractId: string | null;
  }>;
  jurisdictions: string[];
};

export type Counters = {
  councils: number;
  activePPs: number;
  eventsLast24h: number;
  assetsRegistered: number;
  throughputPerMin: number;
  latencyMs: number | null;
};

export type Sparklines = {
  throughput: number[];
  latency: Array<number | null>;
  volume: number[];
};

export type AssetBreakdownRow = {
  assetContractId: string;
  assetCode: string;
  amountStroops: string;
  percent: number;
};

export type CouncilRollingMetrics = {
  bundlesLastHour: number;
  eventsLastHour: number;
  ratePerMin: number;
  depositVolumeStroops: string;
  settlementVolumeStroops: string;
};

export type SnapshotFrame = {
  type: "snapshot";
  counters: Counters;
  topology: CouncilTopologyEntry[];
  recent: NetworkEvent[];
  sparklines: Sparklines;
  assetBreakdown: AssetBreakdownRow[];
  councilRolling: Record<string, CouncilRollingMetrics>;
  generatedAt: string;
};

export type LiveFrame = {
  type: "event";
  event: NetworkEvent;
};

export type ServerFrame = SnapshotFrame | LiveFrame;

export const NETWORK_WS_SUBPROTOCOL = "moonlight.network.v2";

/**
 * Defensive narrowing of an untrusted JSON payload to a ServerFrame.
 * Returns null if the frame doesn't smell right — the WS client treats
 * that as a protocol-mismatch and logs without raising.
 */
export function parseServerFrame(value: unknown): ServerFrame | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.type === "snapshot") {
    if (
      typeof v.counters !== "object" || v.counters === null ||
      !Array.isArray(v.topology) ||
      !Array.isArray(v.recent) ||
      typeof v.sparklines !== "object" || v.sparklines === null ||
      !Array.isArray(v.assetBreakdown) ||
      typeof v.councilRolling !== "object" || v.councilRolling === null
    ) {
      return null;
    }
    return value as SnapshotFrame;
  }
  if (v.type === "event") {
    if (typeof v.event !== "object" || v.event === null) return null;
    return value as LiveFrame;
  }
  return null;
}
