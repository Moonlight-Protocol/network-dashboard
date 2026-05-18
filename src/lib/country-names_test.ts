import { assertEquals } from "@std/assert";
import { COUNTRY_NAMES, getCountryName } from "./country-names.ts";

Deno.test("getCountryName returns full name for a known code", () => {
  assertEquals(getCountryName("US"), "United States");
  assertEquals(getCountryName("AR"), "Argentina");
  assertEquals(getCountryName("GB"), "United Kingdom");
});

Deno.test("getCountryName accepts lowercase input", () => {
  assertEquals(getCountryName("us"), "United States");
  assertEquals(getCountryName("ar"), "Argentina");
});

Deno.test("getCountryName returns the code for an unknown country", () => {
  assertEquals(getCountryName("ZZ"), "ZZ");
});

Deno.test("COUNTRY_NAMES has unique non-empty display values", () => {
  const values = Object.values(COUNTRY_NAMES);
  assertEquals(values.length, new Set(values).size, "duplicate names found");
  for (const v of values) {
    assertEquals(v.length > 0, true);
  }
});
