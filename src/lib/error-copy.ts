/**
 * Code → operator-copy mapper for the network dashboard.
 *
 * Mirrors moonlight-pay's `friendlyError`: the dashboard consumes structured
 * errors from two channels — WebSocket transport failures (synthesised
 * locally) and `{ type: "error" }` frames the backend emits over the same
 * socket — and both are turned into a human sentence here.
 *
 * Shape-agnostic: it reads `.code` off whatever it's handed, so a code
 * originating in council-platform (bubbled through network-dashboard-platform)
 * maps the same as one minted by network-dashboard-platform itself. Unknown
 * code → a safe server message if present → generic last-resort fallback.
 */

export type StructuredErrorLike = {
  code?: string;
  message?: string;
};

/** Synthetic codes the SPA mints for WS transport states (no backend body). */
export const TRANSPORT_ERROR_CODES = {
  DISCONNECTED: "WS_DISCONNECTED",
  NOT_CONFIGURED: "WS_NOT_CONFIGURED",
} as const;

const CODE_COPY: Record<string, string> = {
  // Transport (client-synthesised).
  WS_DISCONNECTED: "Lost connection to the live feed — reconnecting…",
  WS_NOT_CONFIGURED: "Live feed is not configured for this environment.",
  // Backend structured errors (network-dashboard-platform / council-platform).
  TOPOLOGY_REFRESH_FAILED:
    "Network data may be out of date — the council directory is temporarily unreachable.",
  COUNCIL_PLATFORM_HTTP_ERROR:
    "Network data may be out of date — the council directory is temporarily unreachable.",
  COUNCIL_PLATFORM_UNREACHABLE:
    "Network data may be out of date — the council directory is temporarily unreachable.",
  WS_UPGRADE_REQUIRED: "Couldn't open the live feed. Please refresh the page.",
};

const GENERIC =
  "Something went wrong loading network data. Please try again shortly.";

/**
 * Guard the raw server message before showing it verbatim — only pass through
 * something that reads like a human sentence, never a stack frame, error code,
 * or transport token. Mirrors moonlight-pay's `isSafeSentence`.
 */
function isSafeSentence(msg: string): boolean {
  return (
    msg.length > 10 &&
    msg.length < 200 &&
    /^[A-Z]/.test(msg) &&
    msg.includes(" ") &&
    !/\d+\.\d+\.\d+/.test(msg) &&
    !/\b[A-Z]{4,}\b/.test(msg) &&
    !msg.includes("_") &&
    !msg.includes("ECONN") &&
    !msg.includes("ENOENT")
  );
}

function codeOf(
  input: StructuredErrorLike | string | undefined,
): string | undefined {
  if (typeof input === "string") return input || undefined;
  const code = input?.code;
  return typeof code === "string" && code.length > 0 ? code : undefined;
}

/**
 * Map a structured error (or a bare code) to display copy.
 *   1. known code → its mapped sentence
 *   2. else a safe server message, if one rode along
 *   3. else the generic fallback
 */
export function errorCopy(
  input: StructuredErrorLike | string | undefined,
): string {
  const code = codeOf(input);
  if (code && code in CODE_COPY) return CODE_COPY[code];

  const msg = typeof input === "object" && input?.message
    ? input.message
    : undefined;
  if (msg && isSafeSentence(msg)) return msg;

  return GENERIC;
}

export const GENERIC_ERROR_COPY = GENERIC;
