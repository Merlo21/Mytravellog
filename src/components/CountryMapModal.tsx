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

// Cache loaded GeoJSON in memory
const geoCache: Record<string, any> = {};

interface Props {
  countryCode: string;
  countryName: string;
  trips: Trip[];
  onClose: () => void;
}

function projectGeoJSON(features: any[], W: number, H: number) {
  // Find bounding box
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

function drawPolygon(ctx: CanvasRenderingContext2D, coords: any[], project: (lon: number, lat: number) => [number, number]) {
  ctx.beginPath();
  const ring = coords[0];
  if (!ring?.length) return;
  const [x0, y0] = project(ring[0][0], ring[0][1]);
  ctx.moveTo(x0, y0);
  for (let i = 1; i < ring.length; i++) {
    const [x, y] = project(ring[i][0], ring[i][1]);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawFeature(ctx: CanvasRenderingContext2D, feature: any, project: (lon: number, lat: number) => [number, number]) {
  const geom = feature.geometry;
  if (!geom) return;
  if (geom.type === "Polygon") drawPolygon(ctx, geom.coordinates, project);
  else if (geom.type === "MultiPolygon") geom.coordinates.forEach((poly: any) => drawPolygon(ctx, poly, project));
}

export function CountryMapModal({ countryCode, countryName, trips, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [visitedRegions, setVisitedRegions] = useState<string[]>([]);
  const [totalRegions, setTotalRegions] = useState(0);

  const source = GEOJSON_SOURCES[countryCode?.toUpperCase()];

  // Collect visited regions from trips
  const visitedSet = new Set(trips.map(t => t.region).filter(Boolean) as string[]);

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
          const name = f.properties?.[source.nameProp] ?? "";
          // Fuzzy match: check if any visited region contains this name or vice versa
          const isVisited = [...visitedSet].some(v =>
            v?.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(v?.toLowerCase() ?? "")
          );
          if (isVisited) visited.push(name);

          ctx.save();
          // Fill
          ctx.fillStyle = isVisited ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.12)";
          drawFeature(ctx, f, project);
          ctx.fill();
          // Stroke
          ctx.strokeStyle = isVisited ? "rgba(96,165,250,0.9)" : "rgba(255,255,255,0.25)";
          ctx.lineWidth = 0.8;
          drawFeature(ctx, f, project);
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
        <div style={{ padding: "16px 20px 12px", borderBottom: "0.5px solid #1a2d4a", display: "flex", alignItems: "center", gap: 12 }}>
          {countryCode && (
            <img src={"https://flagcdn.com/w40/" + countryCode.toLowerCase() + ".png"}
              style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }}/>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f0f4ff" }}>{countryName}</div>
            {!loading && !error && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                {visitedRegions.length} / {totalRegions} regioni visitate ({pct}%)
              </div>
            )}
          </div>
          <button onClick={onClose}
            style={{ width: 30, height: 30, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}>
            <X style={{ width: 16, height: 16 }}/>
          </button>
        </div>

        {/* Progress bar */}
        {!loading && !error && totalRegions > 0 && (
          <div style={{ padding: "8px 20px 0" }}>
            <div style={{ height: 4, background: "#1a2d4a", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: pct + "%", background: "#60a5fa", borderRadius: 99, transition: "width 0.8s ease" }}/>
            </div>
          </div>
        )}

        {/* Map canvas */}
        <div style={{ flex: 1, padding: 16, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 320 }}>
          {loading && (
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Caricamento mappa…</div>
          )}
          {error && (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🗺️</div>
              <div>Mappa non disponibile per questo paese.</div>
              <div style={{ marginTop: 8, fontSize: 11 }}>
                Regioni visitate: {[...visitedSet].join(", ") || "—"}
              </div>
            </div>
          )}
          {!error && (
            <canvas ref={canvasRef} width={540} height={380}
              style={{ width: "100%", maxWidth: 540, height: "auto", display: loading ? "none" : "block" }}/>
          )}
        </div>

        {/* Visited regions list */}
        {!loading && !error && visitedRegions.length > 0 && (
          <div style={{ padding: "0 20px 16px" }}>
            <div style={{ fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
              Regioni visitate
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {visitedRegions.map(r => (
                <span key={r} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "0.5px solid rgba(96,165,250,0.3)" }}>
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
