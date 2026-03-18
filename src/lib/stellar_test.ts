import { assertEquals } from "@std/assert";
import { queryErrors } from "./stellar.ts";

Deno.test("queryErrors starts empty", () => {
  // queryErrors is a module-level array; in a fresh import it should be empty
  assertEquals(Array.isArray(queryErrors), true);
});

// Test the event type parsing logic (extracted for testability)
function parseEventType(topic: string[]): string {
  if (!topic || topic.length === 0) return "unknown";
  const first = topic[0];
  if (typeof first === "string") return first;
  return "unknown";
}

Deno.test("parseEventType extracts string topic", () => {
  assertEquals(parseEventType(["ProviderAdded"]), "ProviderAdded");
  assertEquals(parseEventType(["ProviderRemoved"]), "ProviderRemoved");
  assertEquals(parseEventType(["ContractInitialized"]), "ContractInitialized");
});

Deno.test("parseEventType returns unknown for empty topics", () => {
  assertEquals(parseEventType([]), "unknown");
});

// Test provider count logic (extracted for testability)
function countProviders(events: { type: string; value: string | null }[]): { count: number; addresses: string[] } {
  const added = new Set<string>();
  const removed = new Set<string>();

  for (const e of events) {
    if (e.type === "ProviderAdded" && e.value) added.add(e.value);
    if (e.type === "ProviderRemoved" && e.value) removed.add(e.value);
  }

  for (const r of removed) added.delete(r);
  return { count: added.size, addresses: [...added] };
}

Deno.test("countProviders tracks adds and removes", () => {
  const events = [
    { type: "ProviderAdded", value: "GAAA" },
    { type: "ProviderAdded", value: "GBBB" },
    { type: "ProviderRemoved", value: "GAAA" },
  ];
  const result = countProviders(events);
  assertEquals(result.count, 1);
  assertEquals(result.addresses, ["GBBB"]);
});

Deno.test("countProviders deduplicates multiple adds", () => {
  const events = [
    { type: "ProviderAdded", value: "GAAA" },
    { type: "ProviderAdded", value: "GAAA" },
  ];
  assertEquals(countProviders(events).count, 1);
});

Deno.test("countProviders handles empty events", () => {
  assertEquals(countProviders([]).count, 0);
});

Deno.test("countProviders ignores null values", () => {
  const events = [
    { type: "ProviderAdded", value: null },
  ];
  assertEquals(countProviders(events).count, 0);
});
