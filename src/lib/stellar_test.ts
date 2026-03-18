import { assertEquals } from "@std/assert";
import { queryErrors, clearQueryErrors, countProvidersFromEvents } from "./stellar.ts";
import type { ContractEvent } from "./stellar.ts";

function mockEvent(type: string, value: string | null, ledger = 1): ContractEvent {
  return { id: "e1", type, contractId: "C...", ledger, timestamp: "", topic: [], value };
}

Deno.test("queryErrors starts empty", () => {
  assertEquals(Array.isArray(queryErrors), true);
});

Deno.test("clearQueryErrors empties the array", () => {
  queryErrors.push({ source: "test", message: "err", time: 0 });
  clearQueryErrors();
  assertEquals(queryErrors.length, 0);
});

Deno.test("countProvidersFromEvents tracks adds and removes", () => {
  const events = [
    mockEvent("ProviderAdded", "GAAA", 1),
    mockEvent("ProviderAdded", "GBBB", 2),
    mockEvent("ProviderRemoved", "GAAA", 3),
  ];
  const result = countProvidersFromEvents(events);
  assertEquals(result, ["GBBB"]);
});

Deno.test("countProvidersFromEvents handles add-remove-re-add", () => {
  const events = [
    mockEvent("ProviderAdded", "GAAA", 1),
    mockEvent("ProviderRemoved", "GAAA", 2),
    mockEvent("ProviderAdded", "GAAA", 3),
  ];
  const result = countProvidersFromEvents(events);
  assertEquals(result, ["GAAA"]);
});

Deno.test("countProvidersFromEvents deduplicates multiple adds", () => {
  const events = [
    mockEvent("ProviderAdded", "GAAA", 1),
    mockEvent("ProviderAdded", "GAAA", 2),
  ];
  assertEquals(countProvidersFromEvents(events).length, 1);
});

Deno.test("countProvidersFromEvents handles empty events", () => {
  assertEquals(countProvidersFromEvents([]).length, 0);
});

Deno.test("countProvidersFromEvents ignores null values", () => {
  const events = [mockEvent("ProviderAdded", null, 1)];
  assertEquals(countProvidersFromEvents(events).length, 0);
});
