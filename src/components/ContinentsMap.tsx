import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import { Trip as LocalTrip } from "@/lib/storage";

// Approximate continent bounding boxes (lat, lon)
// Used to classify both trip markers AND country centroids
type Continent = "Africa" | "Antartide" | "Asia" | "Europa" | "Nord America" | "Oceania" | "Sud America";

const CONTINENTS: Continent[] = [
  "Africa", "Antartide", "Asia", "Europa", "Nord America", "Oceania", "Sud America",
];

function classifyContinent(lat: number, lon: number): Continent | null {
  if (lat < -60) return "Antartide";
  // Europe
  if (lat >= 36 && lat <= 71 && lon >= -25 && lon <= 45) return "Europa";
  // Africa
  if (lat >= -35 && lat < 37 && lon >= -20 && lon <= 52) return "Africa";
  // Asia (broad)
  if (lat >= 0 && lat <= 78 && lon > 45 && lon <= 180) return "Asia";
  if (lat >= -10 && lat < 8 && lon >= 95 && lon <= 141) return "Asia"; // Indonesia etc.
  // Oceania
  if (lat >= -50 && lat < 0 && lon >= 110 && lon <= 180) return "Oceania";
  if (lat >= -50 && lat < 0 && lon >= -180 && lon <= -130) return "Oceania";
  // Americas
  if (lat >= 12 && lon >= -170 && lon <= -50) return "Nord America";
  if (lat < 12 && lat >= -60 && lon >= -90 && lon <= -34) return "Sud America";
  if (lat >= -60 && lat < 12 && lon >= -120 && lon <= -75) return "Sud America";
  return null;
}

// Full equirectangular world dimensions (no clamping → no horizontal artifacts)
const W = 450;
// Full world height if we used the entire latitude range -180..180 lon, -90..90 lat
const FULL_H = W / 2; // = 225
// We crop the poles via viewBox instead of clamping coordinates.
// Latitude range we want to display:
const LAT_MAX = 83;
const LAT_MIN = -58;
// Visible height after cropping the poles
const H = Math.round((FULL_H * (LAT_MAX - LAT_MIN)) / 180); // ~176

function project(lon: number, lat: number): [number, number] {
  const x = ((lon + 180) / 360) * W;
  // Map latitude linearly across the full sphere, then we crop via viewBox
  const yFull = ((90 - lat) / 180) * FULL_H;
  // Shift so that LAT_MAX becomes y=0 in the cropped viewBox
  const yOffset = ((90 - LAT_MAX) / 180) * FULL_H;
  return [x, yFull - yOffset];
}


interface Props {
  trips: LocalTrip[];
}

type CountryFeat = {
  id: string;
  name: string;
  path: string;
  centroid: [number, number]; // lon, lat
  polygons: number[][][][]; // list of polygons; each polygon = list of rings of [lon,lat]
};

export function ContinentsMap({ trips }: Props) {
  const [countries, setCountries] = useState<CountryFeat[]>([]);
  const [debug, setDebug] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then((r) => r.json())
      .then((topo: any) => {
        if (cancelled) return;
        const geo: any = feature(topo, topo.objects.countries);
        const feats: CountryFeat[] = geo.features.map((f: any) => {
          const path = geoToPath(f.geometry);
          const c = polyCentroid(f.geometry);
          const polygons = extractPolygons(f.geometry);
          return { id: String(f.id), name: f.properties?.name ?? String(f.id), path, centroid: c, polygons };
        });
        setCountries(feats);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const visitedContinents = useMemo(() => {
    const set = new Set<Continent>();
    for (const t of trips) {
      const c = classifyContinent(t.latitude, t.longitude);
      if (c) set.add(c);
    }
    return set;
  }, [trips]);

  const visitedCountryIds = useMemo(() => {
    const set = new Set<string>();
    if (!countries.length) return set;
    for (const t of trips) {
      for (const c of countries) {
        if (pointInCountry(t.longitude, t.latitude, c.polygons)) {
          set.add(c.id);
          break;
        }
      }
    }
    return set;
  }, [trips, countries]);

  // Detect countries whose polygons cross the antimeridian and capture the
  // (projected) split points so we can highlight them in debug mode.
  const antimeridianInfo = useMemo(() => {
    const splits: { x: number; y: number; name: string }[] = [];
    const names = new Set<string>();
    for (const c of countries) {
      let crossed = false;
      for (const poly of c.polygons) {
        for (const ring of poly) {
          let prevLon: number | null = null;
          let prevLat: number | null = null;
          for (const [lon, lat] of ring) {
            if (prevLon !== null && prevLat !== null && Math.abs(lon - prevLon) > 180) {
              crossed = true;
              const [x1, y1] = project(prevLon, prevLat);
              const [x2, y2] = project(lon, lat);
              splits.push({ x: x1, y: y1, name: c.name });
              splits.push({ x: x2, y: y2, name: c.name });
            }
            prevLon = lon;
            prevLat = lat;
          }
        }
      }
      if (crossed) names.add(c.name);
    }
    return { splits, names: Array.from(names).sort() };
  }, [countries]);

  return (
    <div className="glass-card p-5 animate-fade-up">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground">Mappa del mondo</h2>
</div>

      <div className="w-full rounded-xl bg-white p-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto block"
          role="img"
          aria-label="Mappa dei paesi visitati"
        >
          <defs>
            <clipPath id="map-clip">
              <rect x={0} y={0} width={W} height={H} />
            </clipPath>
          </defs>
          <rect x={0} y={0} width={W} height={H} fill="#ffffff" />
          <g clipPath="url(#map-clip)">
            {countries.map((c) => {
              const isVisited = visitedCountryIds.has(c.id);
              return (
                <path
                  key={c.id}
                  d={c.path}
                  fill={isVisited ? "#0ea5e9" : "#e5e7eb"}
                  stroke="#ffffff"
                  strokeWidth={0.5}
                  strokeLinejoin="round"
                />
              );
            })}

            {debug && (
              <g>
                <line x1={0} y1={0} x2={0} y2={H} stroke="#ef4444" strokeWidth={0.6} strokeDasharray="2,2" />
                <line x1={W} y1={0} x2={W} y2={H} stroke="#ef4444" strokeWidth={0.6} strokeDasharray="2,2" />
                {antimeridianInfo.splits.map((s, i) => (
                  <circle key={i} cx={s.x} cy={s.y} r={1.4} fill="#ef4444" stroke="#ffffff" strokeWidth={0.3}>
                    <title>{s.name}</title>
                  </circle>
                ))}
              </g>
            )}
          </g>
        </svg>
      </div>

      {debug && antimeridianInfo.names.length > 0 && (
        <div className="mt-3 rounded-lg border border-red-300/40 bg-red-500/5 p-3 text-xs">
          <div className="font-semibold text-red-500 mb-1">
            Paesi che attraversano ±180° ({antimeridianInfo.names.length})
          </div>
          <div className="text-muted-foreground">{antimeridianInfo.names.join(", ")}</div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
        {CONTINENTS.map((c) => {
          const v = visitedContinents.has(c);
          return (
            <div
              key={c}
              className={`flex items-center gap-2 ${v ? "text-primary font-semibold" : "text-muted-foreground"}`}
            >
              <span>{c}</span>
              <span aria-hidden>{v ? "✓" : "✕"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Geometry helpers ---

function geoToPath(geom: any): string {
  if (!geom) return "";
  if (geom.type === "Polygon") return polyToPath(geom.coordinates);
  if (geom.type === "MultiPolygon")
    return geom.coordinates.map((poly: any) => polyToPath(poly)).join(" ");
  return "";
}

// Split a ring whenever consecutive points jump across the antimeridian
// (longitude difference > 180°). Without this the equirectangular projection
// draws a long horizontal line across the whole map for any country whose
// polygon crosses the ±180° meridian (Russia, Antarctica, Fiji, Kiribati…).
export function splitRingAtAntimeridian(ring: number[][]): number[][][] {
  const segments: number[][][] = [];
  let current: number[][] = [];
  let prevLon: number | null = null;
  for (const point of ring) {
    const lon = point[0];
    if (prevLon !== null && Math.abs(lon - prevLon) > 180) {
      if (current.length) segments.push(current);
      current = [];
    }
    current.push(point);
    prevLon = lon;
  }
  if (current.length) segments.push(current);
  return segments;
}

function polyToPath(rings: number[][][]): string {
  return rings
    .map((ring) => {
      const segments = splitRingAtAntimeridian(ring);
      return segments
        .map((seg) => {
          if (seg.length < 2) return "";
          const pts = seg.map(([lon, lat]) => project(lon, lat));
          return (
            "M" +
            pts
              .map(([x, y], i) => `${i === 0 ? "" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
              .join(" ")
          );
        })
        .filter(Boolean)
        .join(" ");
    })
    .join(" ");
}

function polyCentroid(geom: any): [number, number] {
  // Returns [lon, lat] approximate centroid
  let coords: number[][] = [];
  if (geom.type === "Polygon") coords = geom.coordinates[0];
  else if (geom.type === "MultiPolygon") {
    // pick the largest ring
    let best: number[][] = [];
    for (const poly of geom.coordinates) {
      if (poly[0].length > best.length) best = poly[0];
    }
    coords = best;
  }
  if (!coords.length) return [0, 0];
  let lon = 0, lat = 0;
  for (const [x, y] of coords) { lon += x; lat += y; }
  return [lon / coords.length, lat / coords.length];
}

function extractPolygons(geom: any): number[][][][] {
  if (!geom) return [];
  if (geom.type === "Polygon") return [geom.coordinates];
  if (geom.type === "MultiPolygon") return geom.coordinates;
  return [];
}

function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      (yi > lat) !== (yj > lat) &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInCountry(lon: number, lat: number, polygons: number[][][][]): boolean {
  for (const poly of polygons) {
    if (!poly.length) continue;
    if (pointInRing(lon, lat, poly[0])) {
      let inHole = false;
      for (let h = 1; h < poly.length; h++) {
        if (pointInRing(lon, lat, poly[h])) { inHole = true; break; }
      }
      if (!inHole) return true;
    }
  }
  return false;
}
