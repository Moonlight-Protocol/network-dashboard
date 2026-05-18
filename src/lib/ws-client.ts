import {
  NETWORK_WS_SUBPROTOCOL,
  type NetworkEvent,
  type ServerFrame,
  type SnapshotFrame,
} from "./network-events.ts";

export type WsHandlers = {
  onSnapshot: (frame: SnapshotFrame) => void;
  onEvent: (event: NetworkEvent) => void;
  onStatusChange?: (status: "connecting" | "open" | "closed") => void;
};

export type WsHandle = { close: () => void };

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseFrame(raw: string): ServerFrame | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.type === "snapshot" && Array.isArray(parsed.topology)) {
    return parsed as ServerFrame;
  }
  if (parsed.type === "event" && isRecord(parsed.event)) {
    return parsed as ServerFrame;
  }
  return null;
}

export function connectNetworkPlatform(
  baseUrl: string,
  handlers: WsHandlers,
): WsHandle {
  const url = baseUrl.replace(/^http/, "ws").replace(/\/+$/, "") +
    "/api/v1/network/ws";
  let socket: WebSocket | null = null;
  let backoff = INITIAL_BACKOFF_MS;
  let reconnectTimer: number | null = null;
  let stopped = false;

  const setStatus = (s: "connecting" | "open" | "closed") => {
    handlers.onStatusChange?.(s);
  };

  const open = () => {
    if (stopped) return;
    setStatus("connecting");
    try {
      socket = new WebSocket(url, [NETWORK_WS_SUBPROTOCOL]);
    } catch (err) {
      console.warn("[network-ws] WebSocket constructor threw:", err);
      scheduleReconnect();
      return;
    }
    socket.onopen = () => {
      backoff = INITIAL_BACKOFF_MS;
      setStatus("open");
    };
    socket.onmessage = (ev) => {
      const frame = parseFrame(typeof ev.data === "string" ? ev.data : "");
      if (!frame) {
        console.warn("[network-ws] dropping unparseable frame");
        return;
      }
      if (frame.type === "snapshot") {
        handlers.onSnapshot(frame);
      } else {
        handlers.onEvent(frame.event);
      }
    };
    socket.onerror = () => {
      // onclose handles reconnect
    };
    socket.onclose = () => {
      setStatus("closed");
      socket = null;
      scheduleReconnect();
    };
  };

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer !== null) return;
    const delay = backoff;
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      open();
    }, delay) as unknown as number;
  };

  open();

  return {
    close: () => {
      stopped = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socket) {
        try {
          socket.close();
        } catch { /* best effort */ }
        socket = null;
      }
    },
  };
}

/** Exported for tests. */
export const __testing = { parseFrame };
