import { assertEquals } from "@std/assert";
import { __testing, deriveWsUrl } from "./ws-client.ts";

const { parseFrame } = __testing;

Deno.test("parseFrame accepts a hello frame with an events array", () => {
  const frame = parseFrame(JSON.stringify({ type: "hello", events: [] }));
  assertEquals(frame?.type, "hello");
});

Deno.test("parseFrame accepts an event frame", () => {
  const event = {
    id: "a",
    kind: "provider_added",
    councilId: "C",
    ledger: 1,
    occurredAt: new Date(0).toISOString(),
    payload: {},
  };
  const frame = parseFrame(JSON.stringify({ type: "event", event }));
  assertEquals(frame?.type, "event");
});

Deno.test("parseFrame rejects unknown types", () => {
  assertEquals(parseFrame(JSON.stringify({ type: "ping" })), null);
});

Deno.test("parseFrame rejects malformed JSON", () => {
  assertEquals(parseFrame("not-json"), null);
});

Deno.test("parseFrame rejects hello without an events array", () => {
  assertEquals(parseFrame(JSON.stringify({ type: "hello" })), null);
});

Deno.test("deriveWsUrl swaps http → ws and appends the endpoint", () => {
  assertEquals(
    deriveWsUrl("http://localhost:3015"),
    "ws://localhost:3015/api/v1/public/events/ws",
  );
});

Deno.test("deriveWsUrl swaps https → wss and trims trailing slashes", () => {
  assertEquals(
    deriveWsUrl("https://council.example.com/"),
    "wss://council.example.com/api/v1/public/events/ws",
  );
});
