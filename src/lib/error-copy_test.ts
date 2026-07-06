import { assertEquals } from "@std/assert";
import {
  errorCopy,
  GENERIC_ERROR_COPY,
  TRANSPORT_ERROR_CODES,
} from "./error-copy.ts";

Deno.test("errorCopy maps a known backend code to operator copy", () => {
  assertEquals(
    errorCopy({
      code: "TOPOLOGY_REFRESH_FAILED",
      message: "Failed to refresh network topology from council-platform",
    }),
    "Network data may be out of date — the council directory is temporarily unreachable.",
  );
});

Deno.test("errorCopy maps a synthesised transport code", () => {
  assertEquals(
    errorCopy({ code: TRANSPORT_ERROR_CODES.DISCONNECTED }),
    "Lost connection to the live feed — reconnecting…",
  );
});

Deno.test("errorCopy accepts a bare code string (shape-agnostic)", () => {
  assertEquals(
    errorCopy("COUNCIL_PLATFORM_UNREACHABLE"),
    "Network data may be out of date — the council directory is temporarily unreachable.",
  );
});

Deno.test("errorCopy falls back to a safe server message on an unknown code", () => {
  assertEquals(
    errorCopy({
      code: "SOME_FUTURE_CODE",
      message: "The council registry is being migrated right now.",
    }),
    "The council registry is being migrated right now.",
  );
});

Deno.test("errorCopy rejects an unsafe server message and uses the generic fallback", () => {
  // ALLCAPS token + underscore + no leading capital sentence → not shown.
  assertEquals(
    errorCopy({ code: "UNKNOWN", message: "ECONNREFUSED core_svc 127.0.0.1" }),
    GENERIC_ERROR_COPY,
  );
});

Deno.test("errorCopy returns the generic fallback for undefined / empty input", () => {
  assertEquals(errorCopy(undefined), GENERIC_ERROR_COPY);
  assertEquals(errorCopy({}), GENERIC_ERROR_COPY);
  assertEquals(errorCopy(""), GENERIC_ERROR_COPY);
});

Deno.test("errorCopy prefers the code even when a message is present", () => {
  // A known code wins over the (also-present) raw message.
  assertEquals(
    errorCopy({
      code: "WS_DISCONNECTED",
      message: "Some other sentence that would otherwise pass.",
    }),
    "Lost connection to the live feed — reconnecting…",
  );
});
