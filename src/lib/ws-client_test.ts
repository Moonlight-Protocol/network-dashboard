import { assertEquals } from "@std/assert";
import { buildWsUrl } from "./ws-client.ts";

Deno.test("buildWsUrl: http:// → ws://", () => {
  assertEquals(
    buildWsUrl("http://localhost:3035"),
    "ws://localhost:3035/api/v1/network/ws",
  );
});

Deno.test("buildWsUrl: https:// → wss://", () => {
  assertEquals(
    buildWsUrl("https://dashboard-api.moonlightprotocol.io"),
    "wss://dashboard-api.moonlightprotocol.io/api/v1/network/ws",
  );
});

Deno.test("buildWsUrl: ws:// preserved", () => {
  assertEquals(
    buildWsUrl("ws://localhost:3035"),
    "ws://localhost:3035/api/v1/network/ws",
  );
});

Deno.test("buildWsUrl: already-suffixed paths kept as-is", () => {
  assertEquals(
    buildWsUrl("wss://example.com/network/ws"),
    "wss://example.com/network/ws",
  );
});

Deno.test("buildWsUrl: empty/invalid returns null", () => {
  assertEquals(buildWsUrl(""), null);
  assertEquals(buildWsUrl("   "), null);
  assertEquals(buildWsUrl("not-a-url"), null);
});
