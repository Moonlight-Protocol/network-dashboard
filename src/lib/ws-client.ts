import {
  type Counters,
  NETWORK_WS_SUBPROTOCOL,
  type NetworkEvent,
  parseServerFrame,
  type SnapshotFrame,
  type StructuredError,
} from "./network-events.ts";

/**
 * Persistent WebSocket client for the network-dashboard backend.
 *
 * - Auto-reconnects with exponential backoff (capped at 30s).
 * - Exposes `onSnapshot` for the initial frame, `onEvent` per live frame,
 *   and `onStatusChange` for the UI banner ("connecting" / "open" /
 *   "closed").
 * - Status events fire on the next animation frame to avoid render
 *   loops; data events fire synchronously so the topology + feed update
 *   together.
 */

export type WsStatus = "idle" | "connecting" | "open" | "closed";

export type WsHandlers = {
  onSnapshot: (frame: SnapshotFrame) => void;
  /** Live event + the counters snapshot the backend emitted alongside it. */
  onEvent: (event: NetworkEvent, counters: Counters) => void;
  onStatusChange: (status: WsStatus) => void;
  /**
   * A structured error frame the backend pushed over the socket (e.g. a
   * failed council-platform topology refresh). Distinct from transport
   * status: the connection is still live, but some backend data may be
   * degraded. Optional so existing callers keep compiling.
   */
  onError?: (error: StructuredError) => void;
};

const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30_000;

/**
 * Build the full WS URL from the configured base. The backend exposes its
 * endpoint at `/api/v1/network/ws`; passing in just the host base keeps
 * the config surface narrow.
 */
export function buildWsUrl(baseUrl: string): string | null {
  const trimmed = baseUrl.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol === "http:") parsed.protocol = "ws:";
  else if (parsed.protocol === "https:") parsed.protocol = "wss:";
  // Path may already be present in the configured base; append only when missing.
  if (!parsed.pathname.endsWith("/network/ws")) {
    parsed.pathname = `${
      parsed.pathname.replace(/\/+$/, "")
    }/api/v1/network/ws`;
  }
  return parsed.toString();
}

export type WsHandle = {
  close(): void;
};

export function connectNetworkPlatform(
  baseUrl: string,
  handlers: WsHandlers,
): WsHandle {
  const url = buildWsUrl(baseUrl);
  if (url === null) {
    handlers.onStatusChange("closed");
    return { close() {} };
  }

  let socket: WebSocket | null = null;
  let backoffMs = INITIAL_BACKOFF_MS;
  let reconnectTimer: number | null = null;
  let closed = false;

  const setStatus = (status: WsStatus) => {
    handlers.onStatusChange(status);
  };

  const connect = () => {
    if (closed) return;
    setStatus("connecting");
    try {
      socket = new WebSocket(url, NETWORK_WS_SUBPROTOCOL);
    } catch (err) {
      console.warn("WebSocket constructor failed", err);
      scheduleReconnect();
      return;
    }
    socket.onopen = () => {
      setStatus("open");
      backoffMs = INITIAL_BACKOFF_MS;
    };
    socket.onmessage = (ev) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(ev.data);
      } catch {
        return;
      }
      const frame = parseServerFrame(parsed);
      if (frame === null) return;
      switch (frame.type) {
        case "snapshot":
          handlers.onSnapshot(frame);
          break;
        case "event":
          handlers.onEvent(frame.event, frame.counters);
          break;
        case "error":
          handlers.onError?.(frame.error);
          break;
      }
    };
    socket.onclose = () => {
      socket = null;
      setStatus("closed");
      scheduleReconnect();
    };
    socket.onerror = () => {
      // onclose follows; let it drive the reconnect path.
    };
  };

  const scheduleReconnect = () => {
    if (closed) return;
    if (reconnectTimer !== null) return;
    const wait = backoffMs;
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    reconnectTimer = globalThis.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, wait);
  };

  connect();

  return {
    close() {
      closed = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socket) {
        socket.close();
        socket = null;
      }
      setStatus("closed");
    },
  };
}
