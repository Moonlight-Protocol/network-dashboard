import { assertEquals } from "@std/assert";
import { COUNTRIES, getCountryName, projectCountry, sanitizeSvgPath } from "./world-map.ts";

Deno.test("getCountryName returns full name for known code", () => {
  assertEquals(getCountryName("US"), "United States");
  assertEquals(getCountryName("AR"), "Argentina");
  assertEquals(getCountryName("GB"), "United Kingdom");
});

Deno.test("getCountryName returns code for unknown country", () => {
  assertEquals(getCountryName("ZZ"), "ZZ");
});

Deno.test("all country coords have valid lon/lat ranges", () => {
  for (const [code, c] of Object.entries(COUNTRIES)) {
    if (c.lon < -180 || c.lon > 180 || c.lat < -90 || c.lat > 90) {
      throw new Error(`${code} out of bounds: (${c.lon}, ${c.lat})`);
    }
  }
});

Deno.test("projectCountry returns projected coordinates", () => {
  const result = projectCountry("US", 1000, 500);
  assertEquals(result !== null, true);
  if (result) {
    assertEquals(result.x > 0 && result.x < 1000, true);
    assertEquals(result.y > 0 && result.y < 500, true);
  }
});

Deno.test("projectCountry returns null for unknown code", () => {
  assertEquals(projectCountry("ZZ", 1000, 500), null);
});

Deno.test("sanitizeSvgPath allows valid path commands", () => {
  const valid = "M100.5,200.3 L300,400 Z";
  assertEquals(sanitizeSvgPath(valid), valid);
});

Deno.test("sanitizeSvgPath strips script injection", () => {
  const malicious = 'M0,0" /><foreignObject><body onload="alert(1)">';
  const result = sanitizeSvgPath(malicious);
  assertEquals(result.includes("<"), false);
  assertEquals(result.includes(">"), false);
  assertEquals(result.includes('"'), false);
});

Deno.test("sanitizeSvgPath strips event handlers", () => {
  const malicious = "M0,0 onmouseover=alert(1)";
  const result = sanitizeSvgPath(malicious);
  // Only valid chars remain: M0,0 omousovelert1
  assertEquals(result.includes("="), false);
  assertEquals(result.includes("("), false);
  assertEquals(result.includes(")"), false);
});
