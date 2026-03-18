import { assertEquals } from "@std/assert";
import { COUNTRIES, getCountryName, projectCountry } from "./world-map.ts";

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
