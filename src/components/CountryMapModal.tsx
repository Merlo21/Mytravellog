import { useEffect, useRef, useState } from "react";
import { Trip } from "@/lib/storage";
import { X } from "lucide-react";

// GeoJSON sources per country ISO2 code
const GEOJSON_SOURCES: Record<string, { url: string; nameProp: string }> = {
  IT: { url: "https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_regions.geojson", nameProp: "reg_name" },
  ES: { url: "https://raw.githubusercontent.com/codeforgermany/click_that_hood/master/public/data/spain-communities.geojson", nameProp: "name" },
  FR: { url: "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/regions.geojson", nameProp: "nom" },
  AT: { url: "https://raw.githubusercontent.com/ginseng666/GeoJSON-TopoJSON-Austria/master/2021/simplified-99.5/laender_995_geo.json", nameProp: "name" },
  US: { url: "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json", nameProp: "name" },
};

// Translation maps: English names (from Nominatim EN) → local GeoJSON names
// Nominatim with Accept-Language:"en" returns English region names; GeoJSON uses local names.
const REGION_ALIASES: Record<string, Record<string, string>> = {
  IT: {
    // English → Italian
    "tuscany": "toscana",
    "sicily": "sicilia",
    "sardinia": "sardegna",
    "apulia": "puglia",
    "piedmont": "piemonte",
    "lombardy": "lombardia",
    "veneto": "veneto",
    "liguria": "liguria",
    "umbria": "umbria",
    "marche": "marche",
    "lazio": "lazio",
    "abruzzo": "abruzzo",
    "molise": "molise",
    "campania": "campania",
    "basilicata": "basilicata",
    "calabria": "calabria",
    "aosta valley": "valle d'aosta/vallée d'aoste",
    "aosta": "valle d'aosta/vallée d'aoste",
    "valle d'aosta": "valle d'aosta/vallée d'aoste",
    "friuli-venezia giulia": "friuli-venezia giulia",
    "friuli venezia giulia": "friuli-venezia giulia",
    "emilia-romagna": "emilia-romagna",
    "emilia romagna": "emilia-romagna",
    "trentino-alto adige": "trentino-alto adige/südtirol",
    "trentino alto adige": "trentino-alto adige/südtirol",
    "south tyrol": "trentino-alto adige/südtirol",
    "trentino": "trentino-alto adige/südtirol",
  },
  ES: {
    "catalonia": "cataluña",
    "aragon": "aragón",
    "andalusia": "andalucía",
    "castile and león": "castilla y león",
    "castile-la mancha": "castilla-la mancha",
    "basque country": "país vasco",
    "valencian community": "comunitat valenciana",
    "canary islands": "canarias",
    "balearic islands": "illes balears",
    "navarre": "navarra",
    "la rioja": "la rioja",
    "extremadura": "extremadura",
    "galicia": "galicia",
    "asturias": "asturias",
    "cantabria": "cantabria",
    "murcia": "región de murcia",
    "madrid": "comunidad de madrid",
  },
  FR: {
    "brittany": "bretagne",
    "normandy": "normandie",
    "occitanie": "occitanie",
    "new aquitaine": "nouvelle-aquitaine",
    "auvergne-rhône-alpes": "auvergne-rhône-alpes",
    "provence-alpes-côte d'azur": "provence-alpes-côte d'azur",
    "ile-de-france": "île-de-france",
    "hauts-de-france": "hauts-de-france",
    "grand est": "grand est",
    "bourgogne-franche-comté": "bourgogne-franche-comté",
    "centre-val de loire": "centre-val de loire",
    "pays de la loire": "pays de la loire",
  },
};

// Cache loaded GeoJSON in memory
const geoCache: Record<string, any> = {};

interface Props {
  countryCode: string;
  countryName: string;
  trips: Trip[];
  onClose: () => void;
}

function projectGeoJSON(features: any[], W: number, H: number) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  const visitCoords = (coords: any[]) => {
    if (typeof coords[0] === "number") {
      minLon = Math.min(minLon, coords[0]); maxLon = Math.max(maxLon, coords[0]);
      minLat = Math.min(minLat, coords[1]); maxLat = Math.max(maxLat, coords[1]);
    } else coords.forEach(visitCoords);
  };
  features.forEach(f => visitCoords(f.geometry?.coordinates || []));

  const pad = 20;
  const scaleX = (W - pad * 2) / (maxLon - minLon);
  const scaleY = (H - pad * 2) / (maxLat - minLat);
  const scale = Math.min(scaleX, scaleY);
  const offX = pad + ((W - pad * 2) - (maxLon - minLon) * scale) / 2;
  const offY = pad + ((H - pad * 2) - (maxLat - minLat) * scale) / 2;

  const project = (lon: number, lat: number): [number, number] => [
    offX + (lon - minLon) * scale,
    H - (offY + (lat - minLat) * scale),
  ];
  return { project };
}

function drawRing(ctx: CanvasRenderingContext2D, ring: any[], project: (lon: number, lat: number) => [number, number]) {
  if (!ring?.length) return;
  const [x0, y0] = project(ring[0][0], ring[0][1]);
  ctx.moveTo(x0, y0);
  for (let i = 1; i < ring.length; i++) {
    const [x, y] = project(ring[i][0], ring[i][1]);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function buildFeaturePath(ctx: CanvasRenderingContext2D, feature: any, project: (lon: number, lat: number) => [number, number]) {
  const geom = feature.geometry;
  if (!geom) return;
  ctx.beginPath();
  if (geom.type === "Polygon") {
    drawRing(ctx, geom.coordinates[0], project);
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) {
      drawRing(ctx, poly[0], project);
    }
  }
}

/** Normalize a region name for matching: lowercase, remove accents, trim */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['']/g, "'")
    .trim();
}

/**
 * Returns true if the saved trip.region matches a GeoJSON feature name.
 * Strategy (in order):
 * 1. Exact match after normalize
 * 2. Alias lookup (EN→local) after normalize
 * 3. Substring containment after normalize
 */
function regionMatches(tripRegion: string, geoName: string, countryCode: string): boolean {
  const t = normalize(tripRegion);
  const g = normalize(geoName);

  // 1. Exact
  if (t === g) return true;

  // 2. Alias
  const aliases = REGION_ALIASES[countryCode?.toUpperCase()] ?? {};
  const resolved = aliases[t];
  if (resolved && normalize(resolved) === g) return true;

  // 3. Substring (both directions)
  if (t.length >= 4 && g.includes(t)) return true;
  if (g.length >= 4 && t.includes(g)) return true;

  return false;
}

export function CountryMapModal({ countryCode, countryName, trips, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [visitedRegions, setVisitedRegions] = useState<string[]>([]);
  const [totalRegions, setTotalRegions] = useState(0);

  const source = GEOJSON_SOURCES[countryCode?.toUpperCase()];

  // region may be a comma-separated string (multi-stop trips); split into individual entries
  const visitedSet = new Set(
    trips.flatMap(t =>
      t.region ? t.region.split(",").map(r => r.trim()).filter(Boolean) : []
    )
  );

  useEffect(() => {
    if (!source) { setLoading(false); setError(true); return; }

    const load = async () => {
      try {
        let geo = geoCache[countryCode];
        if (!geo) {
          const r = await fetch(source.url);
          geo = await r.json();
          geoCache[countryCode] = geo;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        const features = geo.features ?? [];
        const { project } = projectGeoJSON(features, W, H);

        const visited: string[] = [];
        features.forEach((f: any) => {
          const geoName: string = f.properties?.[source.nameProp] ?? "";
          const isVisited = [...visitedSet].some(v => regionMatches(v, geoName, countryCode));
          if (isVisited) visited.push(geoName);

          ctx.save();
          buildFeaturePath(ctx, f, project);
          ctx.fillStyle = isVisited ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.12)";
          ctx.fill();
          ctx.strokeStyle = isVisited ? "rgba(96,165,250,0.9)" : "rgba(255,255,255,0.25)";
          ctx.lineWidth = 0.8;
          ctx.stroke();
          ctx.restore();
        });

        setVisitedRegions(visited);
        setTotalRegions(features.length);
        setLoading(false);
      } catch {
        setLoading(false);
        setError(true);
      }
    };
    load();
  }, [countryCode, source]);

  const pct = totalRegions > 0 ? Math.round((visitedRegions.length / totalRegions) * 100) : 0;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: "#0a1628", border: "0.5px solid #1a2d4a", borderRadius: 16,
        width: "100%", maxWidth: 580, maxHeight: "90vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #1a2d4a", display: "flex", alignItems: "center", gap: 10 }}>
          {countryCode && (
            <img src={"https://flagcdn.com/w40/" + countryCode.toLowerCase() + ".png"}
              style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }}/>
          )}
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f0f4ff", flex: 1 }}>{countryName}</div>
          <button onClick={onClose}
            style={{ width: 28, height: 28, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}>
            <X style={{ width: 16, height: 16 }}/>
          </button>
        </div>

        {/* Stats */}
        {!loading && !error && totalRegions > 0 && (
          <div style={{ textAlign: "center", paddingTop: 16 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: "#60a5fa" }}>{pct}%</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginLeft: 8 }}>del paese visitato</span>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
              {visitedRegions.length} region{visitedRegions.length === 1 ? "e" : "i"} su {totalRegions}
            </div>
          </div>
        )}

        {/* Map */}
        <div style={{ flex: 1, padding: 16, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
          {loading && (
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Caricamento mappa…</div>
          )}
          {error && (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🗺️</div>
              <div>Mappa non disponibile per questo paese.</div>
              {visitedSet.size > 0 && (
                <div style={{ marginTop: 8, fontSize: 11 }}>
                  Regioni visitate: {[...visitedSet].join(", ")}
                </div>
              )}
            </div>
          )}
          {!error && (
            <canvas ref={canvasRef} width={540} height={380}
              style={{ width: "100%", maxWidth: 540, height: "auto", display: loading ? "none" : "block" }}/>
          )}
        </div>

      </div>
    </div>
  );
}
