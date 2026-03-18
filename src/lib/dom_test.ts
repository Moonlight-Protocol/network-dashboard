import { assertEquals } from "@std/assert";
import { truncateAddress, formatAmount, timeAgo } from "./dom.ts";

Deno.test("truncateAddress shortens long addresses", () => {
  const addr = "CAF7DFHTPSYIW5543WBXJODZCDI5WF5SSHBXGMPKFOYPFRDVWFDNBGX7";
  assertEquals(truncateAddress(addr), "CAF7DF...BGX7");
});

Deno.test("truncateAddress returns short strings unchanged", () => {
  assertEquals(truncateAddress("SHORT"), "SHORT");
});

Deno.test("formatAmount converts stroops to human readable", () => {
  assertEquals(formatAmount(10_000_000), "1.00");
  assertEquals(formatAmount(0), "0.00");
  assertEquals(formatAmount(50_000_000_000n), "5,000.00");
});

Deno.test("timeAgo returns relative time", () => {
  const now = Date.now() / 1000;
  assertEquals(timeAgo(now - 30), "30s ago");
  assertEquals(timeAgo(now - 120), "2m ago");
  assertEquals(timeAgo(now - 7200), "2h ago");
  assertEquals(timeAgo(now - 172800), "2d ago");
});
