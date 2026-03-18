import { assertEquals } from "@std/assert";
import { getNetworkPassphrase } from "./config.ts";

// getNetworkPassphrase reads module-level STELLAR_NETWORK which defaults to
// "testnet" when no config is present (Deno test environment).
Deno.test("getNetworkPassphrase returns testnet passphrase by default", () => {
  assertEquals(
    getNetworkPassphrase(),
    "Test SDF Network ; September 2015",
  );
});
