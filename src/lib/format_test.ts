import { assertEquals } from "@std/assert";
import { formatIsoTimestamp } from "./format.ts";

Deno.test("formatIsoTimestamp normalizes to second-precision UTC ISO 8601", () => {
  assertEquals(
    formatIsoTimestamp("2026-08-25T13:28:00.123Z"),
    "2026-08-25T13:28:00Z",
  );
});

Deno.test("formatIsoTimestamp converts offset timestamps to UTC", () => {
  assertEquals(
    formatIsoTimestamp("2026-08-25T10:28:00-03:00"),
    "2026-08-25T13:28:00Z",
  );
});

Deno.test("formatIsoTimestamp falls back to the raw input when unparseable", () => {
  assertEquals(formatIsoTimestamp("not-a-date"), "not-a-date");
});
