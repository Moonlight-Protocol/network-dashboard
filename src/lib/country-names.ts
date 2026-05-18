/**
 * ISO 3166-1 alpha-2 country code → display name lookup used by the
 * Councils + Council Detail views. The earlier world-map.ts module also
 * carried equirectangular projection helpers; those went with the v1
 * dashboard rework (no world map in v1 per PM-signed design sketch).
 */

export const COUNTRY_NAMES: Record<string, string> = {
  // Americas
  US: "United States",
  CA: "Canada",
  MX: "Mexico",
  BR: "Brazil",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  PE: "Peru",
  UY: "Uruguay",
  PY: "Paraguay",
  EC: "Ecuador",
  VE: "Venezuela",
  CR: "Costa Rica",
  PA: "Panama",

  // Europe
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  CH: "Switzerland",
  NL: "Netherlands",
  SE: "Sweden",
  NO: "Norway",
  FI: "Finland",
  PT: "Portugal",
  IE: "Ireland",
  PL: "Poland",
  AT: "Austria",
  BE: "Belgium",
  UA: "Ukraine",
  RU: "Russia",

  // Africa
  NG: "Nigeria",
  ZA: "South Africa",
  KE: "Kenya",
  EG: "Egypt",
  MA: "Morocco",
  GH: "Ghana",

  // Middle East
  AE: "UAE",
  SA: "Saudi Arabia",
  IL: "Israel",
  TR: "Turkey",

  // Asia
  IN: "India",
  CN: "China",
  JP: "Japan",
  KR: "South Korea",
  SG: "Singapore",
  TH: "Thailand",
  VN: "Vietnam",
  ID: "Indonesia",
  PH: "Philippines",
  MY: "Malaysia",

  // Oceania
  AU: "Australia",
  NZ: "New Zealand",
};

export function getCountryName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] ?? code;
}
