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

Deno.test("parseServerFrame accepts event frames with and without txHash", () => {
  const counters = {
    councils: 1,
    activePPs: 1,
    eventsLast24h: 1,
    assetsRegistered: 0,
    throughputPerMin: 0,
    latencyMs: null,
  };
  const base = {
    id: "e1",
    kind: "provider_added",
    councilId: "C",
    councilName: null,
    ledger: 1,
    occurredAt: new Date(0).toISOString(),
    payload: {},
  };

  // Old backend: no txHash on the event. Must still narrow.
  const withoutHash = parseServerFrame({
    type: "event",
    event: base,
    counters,
  });
  assert(withoutHash !== null);
  if (withoutHash.type === "event") {
    assertEquals(withoutHash.event.txHash, undefined);
  }

  // New backend: txHash passes through.
  const withHash = parseServerFrame({
    type: "event",
    event: { ...base, txHash: "deadbeef" },
    counters,
  });
  assert(withHash !== null);
  if (withHash.type === "event") {
    assertEquals(withHash.event.txHash, "deadbeef");
  }
});

Deno.test("parseServerFrame still rejects unknown frame types", () => {
  assertEquals(parseServerFrame({ type: "nope" }), null);
  assertEquals(parseServerFrame(null), null);
  assertEquals(parseServerFrame("string"), null);
});
