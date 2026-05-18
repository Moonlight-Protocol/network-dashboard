/**
 * Wire-frame types for the public network-dashboard WebSocket stream.
 *
 * Must stay in sync with
 * council-platform/src/core/service/network-events/types.ts. Keep the union
 * narrow — the dashboard renders only the kinds it ships card / pulse
 * support for, and falls back to logging for unknown kinds so a backend
 * deploy that introduces a new kind doesn't break older SPA builds.
 */

export type NetworkEventKind =
  | "council_formed"
  | "provider_added"
  | "provider_removed"
  | "asset_registered"
  | "channel_deposit"
  | "channel_settlement";

export type NetworkEventFrame = {
  id: string;
  kind: NetworkEventKind;
  councilId: string;
  ledger: number | null;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export type ServerFrame =
  | { type: "hello"; events: NetworkEventFrame[] }
  | { type: "event"; event: NetworkEventFrame };

/**
 * Subprotocol clients negotiate when opening the WS. Echo behaviour on
 * the server: present in the response if the client offered it, dropped
 * otherwise. Versioning anchor for protocol-incompatible changes.
 */
export const NETWORK_WS_SUBPROTOCOL = "moonlight.network.v1";
