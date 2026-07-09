// [FROZEN] — Non modificare senza esplicita richiesta
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { feature } from "topojson-client";
import { Trip as LocalTrip } from "@/lib/storage";

// Approximate continent bounding boxes (lat, lon)
// Used to classify both trip markers AND country centroids
type Continent = "Africa" | "Antartide" | "Asia" | "Europa" | "Nord America" | "Oceania" | "Sud America";

const CONTINENTS: Continent[] = [
  "Africa", "Antartide", "Asia", "Europa", "Nord America", "Oceania", "Sud America",
];

/**
 * Un viaggio non tocca solo la destinazione finale: ogni waypoint intermedio
 * ha coordinate proprie ed è una tappa effettivamente visitata (con data e
 * mezzo di trasporto). Le raccogliamo tutte per il conteggio di paesi/continenti.
 */
export function allVisitedPoints(trips: LocalTrip[]): { lat: number; lon: number }[] {
  const points: { lat: number; lon: number }[] = [];
  for (const t of trips) {
    points.push({ lat: t.latitude, lon: t.longitude });
    for (const w of t.waypoints ?? []) {
      if (w.lat != null && w.lon != null) points.push({ lat: w.lat, lon: w.lon });
    }
  }
  return points;
}

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

// I confini dei paesi non cambiano a runtime, ma senza cache il topojson
// (e il ricalcolo di path/centroidi/poligoni per ogni paese) verrebbe
// ri-scaricato ed elaborato ogni volta che questa pagina si smonta e
// rimonta — es. navigando Statistiche → Home → Statistiche con HashRouter.
let cachedCountryFeats: CountryFeat[] | null = null;

/** Test-only: reset la cache dei country feats tra i test. */
export function __clearCountryFeatsCache() {
  cachedCountryFeats = null;
}

export function ContinentsMap({ trips }: Props) {
  const [countries, setCountries] = useState<CountryFeat[]>(cachedCountryFeats ?? []);
  const [debug, setDebug] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (cachedCountryFeats) { setCountries(cachedCountryFeats); return; }
    let cancelled = false;
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then((r) => r.json())
      .then((topo: any) => {
        if (cancelled) return;
        const geo: any = feature(topo, topo.objects.countries);
        const feats: CountryFeat[] = geo.features.map((f: any, idx: number) => {
          const path = geoToPath(f.geometry);
          const c = polyCentroid(f.geometry);
          const polygons = extractPolygons(f.geometry);
          const id = deriveCountryId(f, idx);
          return { id, name: f.properties?.name ?? id, path, centroid: c, polygons };
        });
        cachedCountryFeats = feats;
        setCountries(feats);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Ogni tappa (waypoint) attraversata conta come "visitata", non solo la
  // destinazione finale del viaggio.
  const visitedPoints = useMemo(() => allVisitedPoints(trips), [trips]);

  const visitedContinents = useMemo(() => {
    const set = new Set<Continent>();
    for (const p of visitedPoints) {
      const c = classifyContinent(p.lat, p.lon);
      if (c) set.add(c);
    }
    return set;
  }, [visitedPoints]);

  const visitedCountryIds = useMemo(() => {
    const set = new Set<string>();
    if (!countries.length) return set;
    for (const p of visitedPoints) {
      for (const c of countries) {
        if (pointInCountry(p.lon, p.lat, c.polygons)) {
          set.add(c.id);
          break;
        }
      }
    }
    return set;
  }, [visitedPoints, countries]);

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

      <div className="w-full rounded-xl p-3" style={{ background: "#060e1e" }}>
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
          <rect x={0} y={0} width={W} height={H} fill="#060e1e" />
          <g clipPath="url(#map-clip)">
            {countries.map((c) => {
              const isVisited = visitedCountryIds.has(c.id);
              const countryContinent = classifyContinent(c.centroid[1], c.centroid[0]);
              const continentVisited = countryContinent ? visitedContinents.has(countryContinent) : false;
              const fill = isVisited
                ? "#0ea5e9"
                : continentVisited
                  ? "rgba(96,165,250,0.22)"
                  : "#16233d";
              return (
                <path
                  key={c.id}
                  d={c.path}
                  fill={fill}
                  stroke="#060e1e"
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

      <div className="mt-5 flex flex-wrap gap-2">
        {CONTINENTS.map((c) => {
          const v = visitedContinents.has(c);
          return (
            <div
              key={c}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium ${
                v
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "bg-muted/20 border-border text-muted-foreground"
              }`}
            >
              <span>{c}</span>
              {v ? <Check className="w-3.5 h-3.5" aria-hidden /> : <X className="w-3.5 h-3.5 opacity-50" aria-hidden />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Geometry helpers ---

/**
 * Some world-atlas TopoJSON features (e.g. Antarctica, a few disputed
 * territories) have no numeric `id`. String(undefined) === "undefined" for
 * all of them, which made every such feature share the same React key.
 * Fall back to the feature name, then to the array index, to guarantee
 * uniqueness.
 */
export function deriveCountryId(f: { id?: unknown; properties?: { name?: string } }, index: number): string {
  if (f.id != null) return String(f.id);
  if (f.properties?.name) return f.properties.name;
  return `unknown-${index}`;
}

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
