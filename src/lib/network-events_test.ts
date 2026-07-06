import { assert, assertEquals } from "@std/assert";
import { parseServerFrame } from "./network-events.ts";

Deno.test("parseServerFrame accepts a well-formed error frame", () => {
  const frame = parseServerFrame({
    type: "error",
    error: {
      code: "TOPOLOGY_REFRESH_FAILED",
      source: "network-dashboard-platform/topology-refresh",
      message: "Failed to refresh network topology from council-platform",
    },
  });
  assert(frame !== null);
  assertEquals(frame.type, "error");
  if (frame.type === "error") {
    assertEquals(frame.error.code, "TOPOLOGY_REFRESH_FAILED");
  }
});

Deno.test("parseServerFrame rejects an error frame missing code/message", () => {
  assertEquals(parseServerFrame({ type: "error" }), null);
  assertEquals(parseServerFrame({ type: "error", error: null }), null);
  assertEquals(
    parseServerFrame({ type: "error", error: { code: "X" } }),
    null,
  );
  assertEquals(
    parseServerFrame({ type: "error", error: { message: "hi there" } }),
    null,
  );
});

Deno.test("parseServerFrame still rejects unknown frame types", () => {
  assertEquals(parseServerFrame({ type: "nope" }), null);
  assertEquals(parseServerFrame(null), null);
  assertEquals(parseServerFrame("string"), null);
});
