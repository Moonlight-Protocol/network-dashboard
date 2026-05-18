import { assertEquals } from "@std/assert";
import { __testing } from "./ws-client.ts";

const { parseFrame } = __testing;

Deno.test("parseFrame accepts snapshot with topology array", () => {
  const f = parseFrame(JSON.stringify({
    type: "snapshot",
    counters: {
      councils: 0,
      activePPs: 0,
      eventsLast24h: 0,
      assetsRegistered: 0,
    },
    topology: [],
    recent: [],
    generatedAt: new Date(0).toISOString(),
  }));
  assertEquals(f?.type, "snapshot");
});

Deno.test("parseFrame accepts event frame", () => {
  const f = parseFrame(JSON.stringify({
    type: "event",
    event: {
      id: "a",
      kind: "provider_added",
      councilId: "C",
      councilName: null,
      ledger: 1,
      occurredAt: new Date(0).toISOString(),
      payload: {},
    },
  }));
  assertEquals(f?.type, "event");
});

Deno.test("parseFrame rejects unknown types", () => {
  assertEquals(parseFrame(JSON.stringify({ type: "ping" })), null);
});

Deno.test("parseFrame rejects malformed JSON", () => {
  assertEquals(parseFrame("not-json"), null);
});

Deno.test("parseFrame rejects snapshot missing topology", () => {
  assertEquals(parseFrame(JSON.stringify({ type: "snapshot" })), null);
});
