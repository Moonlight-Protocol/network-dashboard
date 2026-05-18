/**
 * Wire-frame types for the network-dashboard-platform WebSocket stream.
 * Must stay in sync with `network-dashboard-platform/src/core/events/types.ts`.
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
};

export type SnapshotFrame = {
  type: "snapshot";
  counters: Counters;
  topology: CouncilTopologyEntry[];
  recent: NetworkEvent[];
  generatedAt: string;
};

export type LiveFrame = {
  type: "event";
  event: NetworkEvent;
};

export type ServerFrame = SnapshotFrame | LiveFrame;

export const NETWORK_WS_SUBPROTOCOL = "moonlight.network.v1";
