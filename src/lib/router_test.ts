import { assertEquals } from "@std/assert";

// Test the route matching logic (extracted for testability)
function matchRoute(
  path: string,
  patterns: string[],
): { pattern: string; params: Record<string, string> } | null {
  // Exact match first
  if (patterns.includes(path)) return { pattern: path, params: {} };

  // Parameterized match
  for (const pattern of patterns) {
    const patternParts = pattern.split("/");
    const pathParts = path.split("/");
    if (patternParts.length !== pathParts.length) continue;

    const params: Record<string, string> = {};
    let match = true;
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(":")) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        match = false;
        break;
      }
    }
    if (match) return { pattern, params };
  }

  return null;
}

Deno.test("exact route match", () => {
  const result = matchRoute("/councils", ["/map", "/councils", "/transactions"]);
  assertEquals(result?.pattern, "/councils");
  assertEquals(result?.params, {});
});

Deno.test("parameterized route match", () => {
  const result = matchRoute("/council/ABC123", ["/map", "/council/:id"]);
  assertEquals(result?.pattern, "/council/:id");
  assertEquals(result?.params, { id: "ABC123" });
});

Deno.test("no match returns null", () => {
  const result = matchRoute("/unknown", ["/map", "/councils"]);
  assertEquals(result, null);
});

Deno.test("parameterized route does not match wrong segment count", () => {
  const result = matchRoute("/council/ABC/extra", ["/council/:id"]);
  assertEquals(result, null);
});
