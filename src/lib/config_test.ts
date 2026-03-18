import { assertEquals } from "@std/assert";

// Test the network passphrase derivation logic
function getNetworkPassphrase(network: string): string {
  switch (network) {
    case "mainnet": return "Public Global Stellar Network ; September 2015";
    case "standalone": return "Standalone Network ; February 2017";
    default: return "Test SDF Network ; September 2015";
  }
}

Deno.test("getNetworkPassphrase returns testnet by default", () => {
  assertEquals(
    getNetworkPassphrase("testnet"),
    "Test SDF Network ; September 2015",
  );
});

Deno.test("getNetworkPassphrase returns mainnet passphrase", () => {
  assertEquals(
    getNetworkPassphrase("mainnet"),
    "Public Global Stellar Network ; September 2015",
  );
});

Deno.test("getNetworkPassphrase returns standalone passphrase", () => {
  assertEquals(
    getNetworkPassphrase("standalone"),
    "Standalone Network ; February 2017",
  );
});

Deno.test("getNetworkPassphrase defaults unknown to testnet", () => {
  assertEquals(
    getNetworkPassphrase("unknown"),
    "Test SDF Network ; September 2015",
  );
});

// Test URL sanitization logic (matches dom.ts sanitizeUrl)
function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

Deno.test("sanitizeUrl allows https URLs", () => {
  assertEquals(sanitizeUrl("https://example.com"), "https://example.com/");
});

Deno.test("sanitizeUrl allows http URLs", () => {
  assertEquals(sanitizeUrl("http://example.com"), "http://example.com/");
});

Deno.test("sanitizeUrl rejects javascript: URLs", () => {
  assertEquals(sanitizeUrl("javascript:alert(1)"), null);
});

Deno.test("sanitizeUrl rejects data: URLs", () => {
  assertEquals(sanitizeUrl("data:text/html,<h1>hi</h1>"), null);
});

Deno.test("sanitizeUrl rejects invalid URLs", () => {
  assertEquals(sanitizeUrl("not a url"), null);
});
