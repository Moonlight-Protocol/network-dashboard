import { assertEquals } from "@std/assert";
import { COUNTRY_COORDS, getCountryName } from "./geo.ts";

Deno.test("getCountryName returns full name for known code", () => {
  assertEquals(getCountryName("US"), "United States");
  assertEquals(getCountryName("AR"), "Argentina");
  assertEquals(getCountryName("GB"), "United Kingdom");
});

Deno.test("getCountryName returns code for unknown country", () => {
  assertEquals(getCountryName("ZZ"), "ZZ");
});

Deno.test("all country coords are within SVG viewBox", () => {
  for (const [code, coord] of Object.entries(COUNTRY_COORDS)) {
    if (coord.x < 0 || coord.x > 1000 || coord.y < 0 || coord.y > 500) {
      throw new Error(`${code} out of bounds: (${coord.x}, ${coord.y})`);
    }
  }
});
