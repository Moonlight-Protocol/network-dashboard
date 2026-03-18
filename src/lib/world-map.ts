/**
 * World map renderer using Natural Earth TopoJSON data.
 * Fetches land-110m from CDN and renders SVG paths via equirectangular projection.
 */

const TOPO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json";

// Only valid SVG path commands and numeric values — strips anything else.
const SVG_PATH_VALID = /[^MmLlHhVvCcSsQqTtAaZz0-9eE.,\s\-+]/g;

interface TopoTransform {
  scale: [number, number];
  translate: [number, number];
}

interface TopoGeometry {
  type: string;
  // Polygon: number[][], MultiPolygon: number[][][]
  // deno-lint-ignore no-explicit-any
  arcs: any;
}

interface TopoData {
  arcs: number[][][];
  transform: TopoTransform;
  objects: { land: { geometries: TopoGeometry[] } };
}

/**
 * Sanitize an SVG path `d` attribute by removing any characters
 * that are not valid path commands, digits, or separators.
 */
export function sanitizeSvgPath(d: string): string {
  return d.replace(SVG_PATH_VALID, "");
}

/**
 * Fetch and render world landmasses as sanitized SVG path strings.
 */
export async function fetchWorldPaths(width: number, height: number): Promise<string[]> {
  const res = await fetch(TOPO_URL);
  if (!res.ok) throw new Error(`Failed to fetch world map data: ${res.status}`);
  const topo = await res.json() as TopoData;

  // Basic structural validation
  if (!topo?.arcs || !topo?.transform || !topo?.objects?.land?.geometries) {
    throw new Error("Invalid TopoJSON structure");
  }

  return topoToSvgPaths(topo, width, height);
}

function projectPoint(lon: number, lat: number, w: number, h: number): [number, number] {
  return [(lon + 180) / 360 * w, (90 - lat) / 180 * h];
}

function topoToSvgPaths(topo: TopoData, width: number, height: number): string[] {
  const { scale, translate } = topo.transform;

  // Decode delta-encoded arcs into projected coordinates
  const decodedArcs: [number, number][][] = topo.arcs.map((arc: number[][]) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]: number[]) => {
      x += dx;
      y += dy;
      const lon = x * scale[0] + translate[0];
      const lat = y * scale[1] + translate[1];
      return projectPoint(lon, lat, width, height);
    });
  });

  function resolveArc(index: number): [number, number][] {
    if (index >= 0) return decodedArcs[index];
    return [...decodedArcs[~index]].reverse();
  }

  function ringToPathD(ring: number[]): string {
    const points = ring.flatMap(i => resolveArc(i));
    return points
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ") + " Z";
  }

  const paths: string[] = [];
  const land = topo.objects.land;

  for (const geom of land.geometries) {
    if (geom.type === "Polygon") {
      paths.push(geom.arcs.map((r: number[]) => ringToPathD(r)).join(" "));
    } else if (geom.type === "MultiPolygon") {
      paths.push(
        geom.arcs
          .map((poly: number[][]) => poly.map((r: number[]) => ringToPathD(r)).join(" "))
          .join(" "),
      );
    }
  }

  return paths.map(sanitizeSvgPath);
}

/**
 * Country coordinates (capital cities, lon/lat).
 * Projected at render time using the same equirectangular transform.
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

export function projectCountry(code: string, width: number, height: number): { x: number; y: number } | null {
  const c = COUNTRIES[code];
  if (!c) return null;
  const [x, y] = projectPoint(c.lon, c.lat, width, height);
  return { x, y };
}
