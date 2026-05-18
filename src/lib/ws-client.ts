/**
 * Public network-dashboard WebSocket client.
 *
 * Connects to council-platform's `/api/v1/public/events/ws`, parses server
 * frames, dispatches to handler callbacks, and reconnects with exponential
 * backoff on close/error. No auth — this stream is public, anonymous.
 */
import {
  NETWORK_WS_SUBPROTOCOL,
  type NetworkEventFrame,
  type ServerFrame,
} from "./network-events.ts";

export type WsClientHandlers = {
  /** Fired once per (re)connect after the server delivers its hello frame. */
  onHello: (events: NetworkEventFrame[]) => void;
  /** Fired for each live event frame after hello. */
  onEvent: (event: NetworkEventFrame) => void;
  /** Optional connection-state observer for UI affordances. */
  onStatusChange?: (status: "connecting" | "open" | "closed") => void;
};

export type WsClientHandle = {
  close: () => void;
};

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseFrame(raw: string): ServerFrame | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  if (parsed.type === "hello" && Array.isArray(parsed.events)) {
    return parsed as ServerFrame;
  }
  if (parsed.type === "event" && isRecord(parsed.event)) {
    return parsed as ServerFrame;
  }
  return null;
}

export function connectNetworkEvents(
  url: string,
  handlers: WsClientHandlers,
): WsClientHandle {
  let socket: WebSocket | null = null;
  let backoffMs = INITIAL_BACKOFF_MS;
  let reconnectTimer: number | null = null;
  let stopped = false;

  const setStatus = (s: "connecting" | "open" | "closed") => {
    handlers.onStatusChange?.(s);
  };

  const scheduleReconnect = () => {
    if (stopped) return;
    if (reconnectTimer !== null) return;
    const delay = backoffMs;
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      open();
    }, delay) as unknown as number;
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
      backoffMs = INITIAL_BACKOFF_MS;
      setStatus("open");
    };

    socket.onmessage = (ev) => {
      const frame = parseFrame(typeof ev.data === "string" ? ev.data : "");
      if (!frame) {
        console.warn("[network-ws] dropping unparseable frame");
        return;
      }
      if (frame.type === "hello") {
        handlers.onHello(frame.events);
      } else {
        handlers.onEvent(frame.event);
      }
    };

    socket.onerror = () => {
      // onclose will fire after this — backoff handled there.
    };

    socket.onclose = () => {
      setStatus("closed");
      socket = null;
      scheduleReconnect();
    };
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

/**
 * Derive the WS URL from the configured council-platform HTTP URL. Strips a
 * trailing slash and swaps http(s) → ws(s).
 */
export function deriveWsUrl(councilPlatformUrl: string): string {
  const trimmed = councilPlatformUrl.replace(/\/+$/, "");
  const wsBase = trimmed.replace(/^http/, "ws");
  return `${wsBase}/api/v1/public/events/ws`;
}

/** Exported only for tests. */
export const __testing = { parseFrame };
