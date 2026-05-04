import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import { LocalTrip } from "@/lib/storage";

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

const W = 450;
const H = 281;
// Crop the poles (Antarctica + extreme north) so landmasses look natural,
// not stretched. Latitudes outside this range are clipped to the edges.
const LAT_MAX = 83;
const LAT_MIN = -58;

function project(lon: number, lat: number): [number, number] {
  const x = ((lon + 180) / 360) * W;
  const clamped = Math.max(LAT_MIN, Math.min(LAT_MAX, lat));
  const y = ((LAT_MAX - clamped) / (LAT_MAX - LAT_MIN)) * H;
  return [x, y];
}

interface Props {
  trips: LocalTrip[];
}

type CountryFeat = {
  id: string;
  path: string;
  centroid: [number, number]; // lon, lat
  polygons: number[][][][]; // list of polygons; each polygon = list of rings of [lon,lat]
};

export function ContinentsMap({ trips }: Props) {
  const [countries, setCountries] = useState<CountryFeat[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  // Pan/zoom state — viewBox driven
  const [view, setView] = useState({ x: 0, y: 0, w: W, h: H });
  const dragRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const zoom = W / view.w; // 1 = no zoom
  const showCities = zoom >= 2.2;

  function clamp(v: typeof view) {
    const w = Math.min(W, Math.max(W / 12, v.w));
    const h = (w * H) / W;
    const x = Math.max(0, Math.min(W - w, v.x));
    const y = Math.max(0, Math.min(H - h, v.y));
    return { x, y, w, h };
  }

  function handleWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const factor = e.deltaY < 0 ? 0.85 : 1.18;
    const newW = view.w * factor;
    const newH = view.h * factor;
    const cx = view.x + px * view.w;
    const cy = view.y + py * view.h;
    setView(clamp({ x: cx - px * newW, y: cy - py * newH, w: newW, h: newH }));
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  }
  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragRef.current.x) / rect.width) * view.w;
    const dy = ((e.clientY - dragRef.current.y) / rect.height) * view.h;
    setView(clamp({ ...view, x: dragRef.current.vx - dx, y: dragRef.current.vy - dy }));
  }
  function handlePointerUp() { dragRef.current = null; }

  function zoomBy(factor: number) {
    const cx = view.x + view.w / 2;
    const cy = view.y + view.h / 2;
    const newW = view.w * factor;
    const newH = view.h * factor;
    setView(clamp({ x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH }));
  }
  function resetView() { setView({ x: 0, y: 0, w: W, h: H }); }

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
          return { id: String(f.id), path, centroid: c, polygons };
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

  return (
    <div className="glass-card p-5 animate-fade-up">
      <h2 className="text-lg font-bold mb-4 text-foreground">Mappa del mondo</h2>

      <div className="w-full rounded-xl bg-white p-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto block"
          role="img"
          aria-label="Mappa dei paesi visitati"
        >
          <rect x={0} y={0} width={W} height={H} fill="#ffffff" />
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
        </svg>
      </div>


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

function polyToPath(rings: number[][][]): string {
  return rings
    .map((ring) => {
      const pts = ring.map(([lon, lat]) => project(lon, lat));
      return (
        "M" +
        pts.map(([x, y], i) => `${i === 0 ? "" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ") +
        "Z"
      );
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
