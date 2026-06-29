// [FROZEN] — Non modificare senza esplicita richiesta
import { useEffect, useRef, useState, useMemo } from "react";
import { Trip } from "@/lib/storage";
import { AutoRotate } from "@/lib/settings";
import { Play, Square } from "lucide-react";

export interface CityInfo {
  name: string;
  country: string;
  country_code: string;
  latitude: number;
  longitude: number;
  tier: 1 | 2 | 3;
}

interface Props {
  trips: Trip[];
  selectedId?: string | null;
  onSelectTrip?: (t: Trip) => void;
  onSelectCity?: (city: CityInfo) => void;
  autoRotateSetting?: AutoRotate;
}

const MAPTILER_KEY = "J3c87wVeji5QqN7DSqJX";

export const ALL_CITIES: CityInfo[] = [
  {name:"Roma",country:"Italia",country_code:"IT",latitude:41.9,longitude:12.5,tier:1},
  {name:"Tokyo",country:"Giappone",country_code:"JP",latitude:35.68,longitude:139.69,tier:1},
  {name:"New York",country:"USA",country_code:"US",latitude:40.71,longitude:-74.01,tier:1},
  {name:"Londra",country:"Regno Unito",country_code:"GB",latitude:51.51,longitude:-0.13,tier:1},
  {name:"Pechino",country:"Cina",country_code:"CN",latitude:39.91,longitude:116.39,tier:1},
  {name:"Mosca",country:"Russia",country_code:"RU",latitude:55.75,longitude:37.62,tier:1},
  {name:"Cairo",country:"Egitto",country_code:"EG",latitude:30.05,longitude:31.25,tier:1},
  {name:"São Paulo",country:"Brasile",country_code:"BR",latitude:-23.55,longitude:-46.63,tier:1},
  {name:"Mumbai",country:"India",country_code:"IN",latitude:19.08,longitude:72.88,tier:1},
  {name:"Sydney",country:"Australia",country_code:"AU",latitude:-33.87,longitude:151.21,tier:1},
  {name:"Los Angeles",country:"USA",country_code:"US",latitude:34.05,longitude:-118.24,tier:1},
  {name:"Dubai",country:"Emirati Arabi",country_code:"AE",latitude:25.2,longitude:55.27,tier:1},
  {name:"Parigi",country:"Francia",country_code:"FR",latitude:48.85,longitude:2.35,tier:2},
  {name:"Berlino",country:"Germania",country_code:"DE",latitude:52.52,longitude:13.4,tier:2},
  {name:"Madrid",country:"Spagna",country_code:"ES",latitude:40.42,longitude:-3.7,tier:2},
  {name:"Istanbul",country:"Turchia",country_code:"TR",latitude:41.01,longitude:28.95,tier:2},
  {name:"Seoul",country:"Corea del Sud",country_code:"KR",latitude:37.57,longitude:126.98,tier:2},
  {name:"Delhi",country:"India",country_code:"IN",latitude:28.61,longitude:77.21,tier:2},
  {name:"Shanghai",country:"Cina",country_code:"CN",latitude:31.23,longitude:121.47,tier:2},
  {name:"Bangkok",country:"Tailandia",country_code:"TH",latitude:13.75,longitude:100.52,tier:2},
  {name:"Singapore",country:"Singapore",country_code:"SG",latitude:1.35,longitude:103.82,tier:2},
  {name:"Amsterdam",country:"Paesi Bassi",country_code:"NL",latitude:52.37,longitude:4.9,tier:2},
  {name:"Vienna",country:"Austria",country_code:"AT",latitude:48.21,longitude:16.37,tier:2},
  {name:"Kyiv",country:"Ucraina",country_code:"UA",latitude:50.45,longitude:30.52,tier:2},
  {name:"Buenos Aires",country:"Argentina",country_code:"AR",latitude:-34.6,longitude:-58.38,tier:2},
  {name:"Lagos",country:"Nigeria",country_code:"NG",latitude:6.45,longitude:3.4,tier:2},
  {name:"Milano",country:"Italia",country_code:"IT",latitude:45.47,longitude:9.19,tier:3},
  {name:"Napoli",country:"Italia",country_code:"IT",latitude:40.85,longitude:14.27,tier:3},
  {name:"Barcellona",country:"Spagna",country_code:"ES",latitude:41.39,longitude:2.15,tier:3},
  {name:"Monaco",country:"Germania",country_code:"DE",latitude:48.14,longitude:11.58,tier:3},
  {name:"Zurigo",country:"Svizzera",country_code:"CH",latitude:47.38,longitude:8.54,tier:3},
  {name:"Budapest",country:"Ungheria",country_code:"HU",latitude:47.5,longitude:19.04,tier:3},
  {name:"Praga",country:"Rep. Ceca",country_code:"CZ",latitude:50.08,longitude:14.44,tier:3},
  {name:"Oslo",country:"Norvegia",country_code:"NO",latitude:59.91,longitude:10.75,tier:3},
  {name:"Copenhagen",country:"Danimarca",country_code:"DK",latitude:55.68,longitude:12.57,tier:3},
  {name:"Varsavia",country:"Polonia",country_code:"PL",latitude:52.23,longitude:21.01,tier:3},
  {name:"San Francisco",country:"USA",country_code:"US",latitude:37.77,longitude:-122.42,tier:3},
  {name:"Miami",country:"USA",country_code:"US",latitude:25.77,longitude:-80.19,tier:3},
  {name:"Toronto",country:"Canada",country_code:"CA",latitude:43.65,longitude:-79.38,tier:3},
  {name:"Nairobi",country:"Kenya",country_code:"KE",latitude:-1.29,longitude:36.82,tier:3},
  {name:"Osaka",country:"Giappone",country_code:"JP",latitude:34.69,longitude:135.5,tier:3},
  {name:"Tel Aviv",country:"Israele",country_code:"IL",latitude:32.08,longitude:34.78,tier:3},
];

// Canvas-based glow that follows the actual globe circle
function GlobeHalo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      canvas.width  = W * window.devicePixelRatio;
      canvas.height = H * window.devicePixelRatio;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      // Globe radius in MapLibre at zoom 1.5 is roughly 42% of the smaller dimension
      const r = Math.min(W, H) * 0.44;
      const cx = W / 2;
      const cy = H / 2;

      // Draw glow layers outward from globe edge
      const layers = [
        { dr: 2,  blur: 8,  color: "rgba(0,200,255,0.7)" },
        { dr: 8,  blur: 20, color: "rgba(0,160,255,0.45)" },
        { dr: 18, blur: 40, color: "rgba(0,110,220,0.25)" },
        { dr: 35, blur: 70, color: "rgba(0,70,180,0.12)" },
      ];

      layers.forEach(({ dr, blur, color }) => {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = blur;
        ctx.beginPath();
        ctx.arc(cx, cy, r + dr, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      });
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:10 }}
    />
  );
}

export function WorldMap({
  trips, selectedId, onSelectTrip, onSelectCity, autoRotateSetting = "on"
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<any>(null);
  const markersRef    = useRef<any[]>([]);
  const popupsRef     = useRef<any[]>([]);
  const rotTimerRef   = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const playingRef    = useRef(false);
  const onSelectCityRef = useRef(onSelectCity);
  const onSelectTripRef = useRef(onSelectTrip);
  const cityMarkerRefs = useRef<{marker:any;el:HTMLElement;city:CityInfo}[]>([]);
  useEffect(() => { onSelectCityRef.current = onSelectCity; }, [onSelectCity]);
  useEffect(() => { onSelectTripRef.current = onSelectTrip; }, [onSelectTrip]);

  const ordered = useMemo(() =>
    [...trips].sort((a,b) => a.trip_date.localeCompare(b.trip_date)), [trips]);

  // ── Init MapLibre ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    let map: any;

    const init = async () => {
      const ml = await import("maplibre-gl");
      const maplibregl = (ml as any).default || ml;

      // Inject CSS
      if (!document.getElementById("ml-css")) {
        const link = document.createElement("link");
        link.id = "ml-css"; link.rel = "stylesheet";
        link.href = "https://cdn.jsdelivr.net/npm/maplibre-gl@5.0.0/dist/maplibre-gl.css";
        document.head.appendChild(link);
      }

      // Fetch style and inject globe projection + glyphs (MapLibre 5.x)
      const styleResp = await fetch(`https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`);
      const style = await styleResp.json();
      style.projection = { type: "globe" };
      // Add glyph server so native symbol layers can render text
      style.glyphs = `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${MAPTILER_KEY}`;

      map = new maplibregl.Map({
        container: containerRef.current!,
        style,
        center: [10, 20],
        zoom: 1.5,
        attributionControl: false,
      });

      mapRef.current = map;

      // Suppress MapLibre globe projection warnings
      const _warn = console.warn.bind(console);
      console.warn = (...args: any[]) => {
        if (typeof args[0] === 'string' && args[0].includes('globe projection')) return;
        _warn(...args);
      };

      map.on("load", () => {
        // Hide all text/symbol layers below zoom 2 so globe is clean when far
        map.getStyle().layers?.forEach((layer: any) => {
          if (layer.type === "symbol") {
            map.setLayerZoomRange(layer.id, 2, 24);
          }
        });

        // Globe atmosphere
        try {
          map.setFog({
            color: "rgb(140,200,255)",
            "high-color": "rgb(30,100,255)",
            "horizon-blend": 0.12,
            "space-color": "rgb(3,8,22)",
            "star-intensity": 0.9,
          });
        } catch(_) {}

        // Add trip sources
        addTripsToMap(map, maplibregl);

        // City labels as markers
        updateCityLabels(map, maplibregl);
      });

      // Click → reverse geocode
      map.on("click", async (e: any) => {
        const { lng, lat } = e.lngLat;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&accept-language=it`
          );
          const data = await res.json();
          if (!data || data.error) return;
          const addr = data.address || {};
          const name = addr.city || addr.town || addr.village ||
                       addr.suburb || addr.county || data.name ||
                       `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
          onSelectCityRef.current?.({
            name, country: addr.country || "",
            country_code: (addr.country_code || "").toUpperCase(),
            latitude: lat, longitude: lng, tier: 1,
          });
        } catch(_) {}
      });

      // Stop rotation on interaction
      map.on("mousedown", stopRotation);
      map.on("touchstart", stopRotation);

      setTimeout(() => { map.resize(); }, 100);
    };

    init();

    return () => {
      stopRotation();
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      popupsRef.current.forEach(p => p.remove());
      popupsRef.current = [];
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-rotate ────────────────────────────────────────────────────────────
  function startRotation() {
    if (rotTimerRef.current) return;
    const rotate = () => {
      const map = mapRef.current;
      if (!map || playingRef.current) return;
      const center = map.getCenter();
      map.setCenter([center.lng + 0.1, center.lat]);
      rotTimerRef.current = requestAnimationFrame(rotate) as unknown as number;
    };
    rotTimerRef.current = requestAnimationFrame(rotate) as unknown as number;
  }

  function stopRotation() {
    if (rotTimerRef.current) {
      cancelAnimationFrame(rotTimerRef.current as unknown as number);
      rotTimerRef.current = null;
    }
  }

  useEffect(() => {
    if (!mapRef.current) return;
    if (autoRotateSetting === "on") startRotation();
    else stopRotation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRotateSetting]);

  // ── Add trips ──────────────────────────────────────────────────────────────
  function addTripsToMap(map: any, maplibregl: any) {
    // Clean old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    popupsRef.current.forEach(p => p.remove());
    popupsRef.current = [];

    // Remove old layers/sources
    ["route-line","route-points"].forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });

    if (!ordered.length) return;

    // Transport colors for route segments
    const TRANSPORT_COLORS: Record<string, string> = {
      plane: "#378ADD", train: "#BA7517", car: "#639922",
      ship: "#0F6E56", walk: "#D85A30"
    };

    // Draw per-trip: single = pink dot, multi-tappa = blue dots + dashed segments
    ordered.forEach((t, tripIdx) => {
      const hasWaypoints = t.waypoints && t.waypoints.length > 0;
      const sel = t.id === selectedId;

      if (hasWaypoints && t.home_latitude && t.home_longitude) {
        // Multi-tappa trip — draw segments between waypoints
        const allPoints: [number, number][] = [
          [t.home_longitude!, t.home_latitude!],
          [t.longitude, t.latitude],
        ].filter(p => p && p[0] && p[1]) as [number, number][];

        if (allPoints.length >= 2) {
          const lineId = `route-multi-${t.id}`;
          if (map.getLayer(lineId)) map.removeLayer(lineId);
          if (map.getSource(lineId)) map.removeSource(lineId);
          const color = TRANSPORT_COLORS[t.transport_mode ?? "plane"] ?? "#60a5fa";
          map.addSource(lineId, {
            type: "geojson",
            data: { type:"Feature", geometry:{ type:"LineString", coordinates: allPoints } },
          });
          map.addLayer({
            id: lineId, type: "line", source: lineId,
            paint: { "line-color": color, "line-width": sel ? 2.5 : 1.8,
              "line-opacity": sel ? 0.9 : 0.5, "line-dasharray": [4, 3] },
          });
        }
      } else if (t.home_latitude && t.home_longitude) {
        // Single destination — just draw a subtle line from home
        const lineId = `route-single-${t.id}`;
        if (map.getLayer(lineId)) map.removeLayer(lineId);
        if (map.getSource(lineId)) map.removeSource(lineId);
        if (sel) {
          // Only show line for selected single trip
          map.addSource(lineId, {
            type: "geojson",
            data: { type:"Feature", geometry:{ type:"LineString",
              coordinates: [[t.home_longitude!, t.home_latitude!], [t.longitude, t.latitude]] } },
          });
          map.addLayer({
            id: lineId, type: "line", source: lineId,
            paint: { "line-color":"#f472b6", "line-width":1.5,
              "line-opacity": 0.6, "line-dasharray": [3, 3] },
          });
        }
      }
    });

    // Home marker (yellow)
    if (ordered[0]?.home_latitude && ordered[0]?.home_longitude) {
      const homeEl = document.createElement("div");
      homeEl.style.cssText = "width:14px;height:14px;border-radius:50%;background:#fbbf24;border:2px solid #fff;box-shadow:0 0 0 3px rgba(251,191,36,0.3),0 2px 6px rgba(0,0,0,0.4)";
      markersRef.current.push(
        new maplibregl.Marker({ element: homeEl })
          .setLngLat([ordered[0].home_longitude!, ordered[0].home_latitude!])
          .addTo(map)
      );
    }


