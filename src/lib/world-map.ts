/**
 * World map renderer using a static SVG map.
 * Uses simple-world-map (CC BY-SA 3.0, Al MacDonald / Fritz Lekschas)
 * with ISO 3166-1 country IDs on each path.
 *
 * The SVG is served as a static asset from public/world-map.svg.
 * Country coordinates for marker placement use the same hardcoded
 * centroids as before, projected via equirectangular transform into
 * the SVG's coordinate space.
 */

// Only valid SVG path commands and numeric values.
const SVG_PATH_VALID = /[^MmLlHhVvCcSsQqTtAaZz0-9eE.,\s\-+]/g;

/**
 * Sanitize an SVG path `d` attribute by removing any characters
 * that are not valid path commands, digits, or separators.
 */
export function sanitizeSvgPath(d: string): string {
  return d.replace(SVG_PATH_VALID, "");
}

// Original SVG viewBox: 30.767 241.591 784.077 458.627
const SVG_VB_X = 30.767;
const SVG_VB_Y = 241.591;
const SVG_VB_W = 784.077;
const SVG_VB_H = 458.627;

/**
 * Fetch the world map SVG from the local static asset.
 * Returns the raw SVG string with all country paths.
 */
export async function fetchWorldSvg(): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch("/world-map.svg", { signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to load map: ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Country coordinates (centroids, lon/lat).
 * Projected at render time into the SVG's coordinate space.
 */
export const COUNTRIES: Record<string, { lon: number; lat: number; name: string }> = {
  // Americas
  US: { lon: -98, lat: 39, name: "United States" },
  CA: { lon: -106, lat: 56, name: "Canada" },
  MX: { lon: -102, lat: 23, name: "Mexico" },
  BR: { lon: -51, lat: -14, name: "Brazil" },
  AR: { lon: -64, lat: -34, name: "Argentina" },
  CL: { lon: -71, lat: -35, name: "Chile" },
  CO: { lon: -74, lat: 4, name: "Colombia" },
  PE: { lon: -76, lat: -10, name: "Peru" },
  UY: { lon: -56, lat: -33, name: "Uruguay" },
  PY: { lon: -58, lat: -23, name: "Paraguay" },
  EC: { lon: -78, lat: -2, name: "Ecuador" },
  VE: { lon: -66, lat: 8, name: "Venezuela" },
  CR: { lon: -84, lat: 10, name: "Costa Rica" },
  PA: { lon: -80, lat: 9, name: "Panama" },

  // Europe
  GB: { lon: -2, lat: 54, name: "United Kingdom" },
  DE: { lon: 10, lat: 51, name: "Germany" },
  FR: { lon: 2, lat: 46, name: "France" },
  ES: { lon: -4, lat: 40, name: "Spain" },
  IT: { lon: 12, lat: 42, name: "Italy" },
  CH: { lon: 8, lat: 47, name: "Switzerland" },
  NL: { lon: 5, lat: 52, name: "Netherlands" },
  SE: { lon: 18, lat: 60, name: "Sweden" },
  NO: { lon: 10, lat: 62, name: "Norway" },
  FI: { lon: 26, lat: 64, name: "Finland" },
  PT: { lon: -8, lat: 39, name: "Portugal" },
  IE: { lon: -8, lat: 53, name: "Ireland" },
  PL: { lon: 20, lat: 52, name: "Poland" },
  AT: { lon: 14, lat: 47, name: "Austria" },
  BE: { lon: 4, lat: 51, name: "Belgium" },
  UA: { lon: 32, lat: 49, name: "Ukraine" },
  RU: { lon: 40, lat: 56, name: "Russia" },

  // Africa
  NG: { lon: 8, lat: 10, name: "Nigeria" },
  ZA: { lon: 25, lat: -29, name: "South Africa" },
  KE: { lon: 38, lat: 0, name: "Kenya" },
  EG: { lon: 30, lat: 27, name: "Egypt" },
  MA: { lon: -5, lat: 32, name: "Morocco" },
  GH: { lon: -2, lat: 8, name: "Ghana" },

  // Middle East
  AE: { lon: 54, lat: 24, name: "UAE" },
  SA: { lon: 45, lat: 24, name: "Saudi Arabia" },
  IL: { lon: 35, lat: 31, name: "Israel" },
  TR: { lon: 32, lat: 39, name: "Turkey" },

  // Asia
  IN: { lon: 78, lat: 21, name: "India" },
  CN: { lon: 104, lat: 35, name: "China" },
  JP: { lon: 138, lat: 36, name: "Japan" },
  KR: { lon: 128, lat: 36, name: "South Korea" },
  SG: { lon: 104, lat: 1, name: "Singapore" },
  TH: { lon: 101, lat: 15, name: "Thailand" },
  VN: { lon: 108, lat: 14, name: "Vietnam" },
  ID: { lon: 113, lat: -1, name: "Indonesia" },
  PH: { lon: 122, lat: 13, name: "Philippines" },
  MY: { lon: 102, lat: 4, name: "Malaysia" },

  // Oceania
  AU: { lon: 133, lat: -25, name: "Australia" },
  NZ: { lon: 174, lat: -41, name: "New Zealand" },
};

export function getCountryName(code: string): string {
  return COUNTRIES[code]?.name ?? code;
}

/**
 * Project a country's centroid into the SVG's coordinate space.
 * Uses the same equirectangular projection as the SVG map.
 */
export function projectCountry(
  code: string,
  _width: number,
  _height: number,
): { x: number; y: number } | null {
  const c = COUNTRIES[code.toUpperCase()];
  if (!c) return null;

  // Equirectangular: map lon/lat to the SVG viewBox coordinate space.
  // The SVG's viewBox maps roughly to -180..180 lon, -60..85 lat
  // (standard world map cropping).
  const x = SVG_VB_X + ((c.lon + 180) / 360) * SVG_VB_W;
  const y = SVG_VB_Y + ((85 - c.lat) / 145) * SVG_VB_H;

  return { x, y };
}
