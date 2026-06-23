import { useEffect, useRef, useState, useMemo } from "react";
import maplibregl from "maplibre-gl";
import { Trip } from "@/lib/storage";
import { GlobeLabels, AutoRotate } from "@/lib/settings";
import { Play, Square } from "lucide-react";

export interface CityInfo {
  name: string;
  country: string;
  country_code: string;
  latitude: number;
  longitude: number;
  tier: 1 | 2 | 3;
}

export const ALL_CITIES: CityInfo[] = [
  // T1
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
  // T2
  {name:"Parigi",country:"Francia",country_code:"FR",latitude:48.85,longitude:2.35,tier:2},
  {name:"Berlino",country:"Germania",country_code:"DE",latitude:52.52,longitude:13.4,tier:2},
  {name:"Madrid",country:"Spagna",country_code:"ES",latitude:40.42,longitude:-3.7,tier:2},
  {name:"Istanbul",country:"Turchia",country_code:"TR",latitude:41.01,longitude:28.95,tier:2},
  {name:"Seoul",country:"Corea del Sud",country_code:"KR",latitude:37.57,longitude:126.98,tier:2},
  {name:"Delhi",country:"India",country_code:"IN",latitude:28.61,longitude:77.21,tier:2},
  {name:"Shanghai",country:"Cina",country_code:"CN",latitude:31.23,longitude:121.47,tier:2},
  {name:"Lagos",country:"Nigeria",country_code:"NG",latitude:6.45,longitude:3.4,tier:2},
  {name:"Buenos Aires",country:"Argentina",country_code:"AR",latitude:-34.6,longitude:-58.38,tier:2},
  {name:"Los Angeles",country:"USA",country_code:"US",latitude:34.05,longitude:-118.24,tier:2},
  {name:"Dubai",country:"Emirati Arabi",country_code:"AE",latitude:25.2,longitude:55.27,tier:2},
  {name:"Bangkok",country:"Tailandia",country_code:"TH",latitude:13.75,longitude:100.52,tier:2},
  {name:"Singapore",country:"Singapore",country_code:"SG",latitude:1.35,longitude:103.82,tier:2},
  {name:"Amsterdam",country:"Paesi Bassi",country_code:"NL",latitude:52.37,longitude:4.9,tier:2},
  {name:"Vienna",country:"Austria",country_code:"AT",latitude:48.21,longitude:16.37,tier:2},
  {name:"Kyiv",country:"Ucraina",country_code:"UA",latitude:50.45,longitude:30.52,tier:2},
  // T3
  {name:"Milano",country:"Italia",country_code:"IT",latitude:45.47,longitude:9.19,tier:3},
  {name:"Napoli",country:"Italia",country_code:"IT",latitude:40.85,longitude:14.27,tier:3},
  {name:"Firenze",country:"Italia",country_code:"IT",latitude:43.77,longitude:11.26,tier:3},
  {name:"Barcellona",country:"Spagna",country_code:"ES",latitude:41.39,longitude:2.15,tier:3},
  {name:"Monaco",country:"Germania",country_code:"DE",latitude:48.14,longitude:11.58,tier:3},
  {name:"Zurigo",country:"Svizzera",country_code:"CH",latitude:47.38,longitude:8.54,tier:3},
  {name:"Bruxelles",country:"Belgio",country_code:"BE",latitude:50.85,longitude:4.35,tier:3},
  {name:"Budapest",country:"Ungheria",country_code:"HU",latitude:47.5,longitude:19.04,tier:3},
  {name:"Praga",country:"Rep. Ceca",country_code:"CZ",latitude:50.08,longitude:14.44,tier:3},
  {name:"Oslo",country:"Norvegia",country_code:"NO",latitude:59.91,longitude:10.75,tier:3},
  {name:"Copenhagen",country:"Danimarca",country_code:"DK",latitude:55.68,longitude:12.57,tier:3},
  {name:"Helsinki",country:"Finlandia",country_code:"FI",latitude:60.17,longitude:24.94,tier:3},
  {name:"Varsavia",country:"Polonia",country_code:"PL",latitude:52.23,longitude:21.01,tier:3},
  {name:"San Francisco",country:"USA",country_code:"US",latitude:37.77,longitude:-122.42,tier:3},
  {name:"Miami",country:"USA",country_code:"US",latitude:25.77,longitude:-80.19,tier:3},
  {name:"Montréal",country:"Canada",country_code:"CA",latitude:45.5,longitude:-73.57,tier:3},
  {name:"Ho Chi Minh",country:"Vietnam",country_code:"VN",latitude:10.82,longitude:106.63,tier:3},
  {name:"Tel Aviv",country:"Israele",country_code:"IL",latitude:32.08,longitude:34.78,tier:3},
  {name:"Casablanca",country:"Marocco",country_code:"MA",latitude:33.59,longitude:-7.62,tier:3},
  {name:"Nairobi",country:"Kenya",country_code:"KE",latitude:-1.29,longitude:36.82,tier:3},
  {name:"Osaka",country:"Giappone",country_code:"JP",latitude:34.69,longitude:135.5,tier:3},
];

interface Props {
  trips: Trip[];
  selectedId?: string | null;
  onSelectTrip?: (t: Trip) => void;
  onSelectCity?: (city: CityInfo) => void;
  globeLabels?: GlobeLabels;
  autoRotateSetting?: AutoRotate;
}

const flag = (c: string) =>
  c.length === 2 ? String.fromCodePoint(...c.toUpperCase().split("").map(ch => 0x1f1e6 + ch.charCodeAt(0) - 65)) : "🌍";

// Free tile sources — no API key needed
const STYLE = {
  version: 8 as const,
  sources: {
    "esri-satellite": {
      type: "raster" as const,
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© Esri",
    },
    "esri-labels": {
      type: "raster" as const,
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    { id: "background", type: "background" as const, paint: { "background-color": "#061226" } },
    { id: "satellite", type: "raster" as const, source: "esri-satellite" },
    { id: "labels",    type: "raster" as const, source: "esri-labels" },
  ],
};

export function WorldMap({ trips, selectedId, onSelectTrip, onSelectCity, globeLabels = "major", autoRotateSetting = "on" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const popupsRef = useRef<any[]>([]);
  const rotationRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);

  const ordered = useMemo(() => [...trips].sort((a, b) => a.trip_date.localeCompare(b.trip_date)), [trips]);

  // ── Init MapLibre ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    let map: any;

    const init = () => {
      map = new maplibregl.Map({
        container: containerRef.current!,
        style: STYLE as any,
        center: [10, 20],
        zoom: 1.5,
        attributionControl: false,
      });

      // Force resize — MapLibre needs computed height at init
      setTimeout(() => { if (mapRef.current) mapRef.current.resize(); }, 50);
      setTimeout(() => { if (mapRef.current) mapRef.current.resize(); }, 300);
      setTimeout(() => { if (mapRef.current) mapRef.current.resize(); }, 800);

      // Also use ResizeObserver
      const ro = new ResizeObserver(() => { if (mapRef.current) mapRef.current.resize(); });
      if (containerRef.current) ro.observe(containerRef.current);

      mapRef.current = map;

      // Atmosphere (star field + glow)
      map.on("style.load", () => {
        // Enable globe projection (MapLibre 4.x)
        try {
          (map as any).setProjection({ type: "globe" });
        } catch(_) {
          try { (map as any).setProjection("globe"); } catch(__) {}
        }
        // Add trip routes and markers
        addTripsToMap(map, maplibregl);
      });

      // Auto-rotate
      if (autoRotateSetting === "on") startRotation(map);

      // Click on map → add city
      map.on("click", (e: any) => {
        if (Math.abs(e.point.x) < 5 || playingRef.current) return;
        // Reverse geocode via nominatim
        const { lng, lat } = e.lngLat;
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=it`)
          .then(r => r.json())
          .then(d => {
            if (!d || !d.address) return;
            const addr = d.address;
            const city = addr.city || addr.town || addr.village || addr.county || d.name || "Luogo sconosciuto";
            const country = addr.country || "";
            const cc = addr.country_code?.toUpperCase() || "";
            onSelectCity?.({ name: city, country, country_code: cc, latitude: lat, longitude: lng, tier: 1 });
          }).catch(() => {});
      });

      // Stop rotation on drag
      map.on("mousedown", () => stopRotation());
      map.on("touchstart", () => stopRotation());
    };

    init();

    let ro: ResizeObserver | null = null;

    return () => {
      stopRotation();
      if (ro) ro.disconnect();
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rotation ────────────────────────────────────────────────────────────────
  function startRotation(m: any) {
    if (rotationRef.current) return;
    const rotate = () => {
      if (!m || m._removed) return;
      const zoom = m.getZoom();
      if (zoom < 3) {
        m.setCenter([m.getCenter().lng + 0.08, m.getCenter().lat]);
      }
      rotationRef.current = requestAnimationFrame(rotate);
    };
    rotationRef.current = requestAnimationFrame(rotate);
  }

  function stopRotation() {
    if (rotationRef.current) { cancelAnimationFrame(rotationRef.current); rotationRef.current = null; }
  }

  // Sync autoRotate setting
  useEffect(() => {
    if (!mapRef.current) return;
    if (autoRotateSetting === "on") startRotation(mapRef.current);
    else stopRotation();
  }, [autoRotateSetting]);

  // ── Add trips to map ────────────────────────────────────────────────────────
  function addTripsToMap(map: any, maplibregl: any) {
    // Remove old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    popupsRef.current.forEach(p => p.remove());
    popupsRef.current = [];

    // Remove old sources/layers
    ["route", "trip-points", "home-point"].forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });

    if (!ordered.length) return;

    const home = ordered[0];

    // Route line
    const coords = [
      [home.home_longitude, home.home_latitude],
      ...ordered.map(t => [t.longitude, t.latitude]),
    ];

    map.addSource("route", {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
      },
    });
    map.addLayer({
      id: "route",
      type: "line",
      source: "route",
      paint: {
        "line-color": "#22d3ee",
        "line-width": 2,
        "line-opacity": 0.8,
        "line-dasharray": [3, 2],
      },
    });

    // Home marker
    const homeEl = document.createElement("div");
    homeEl.style.cssText = "width:20px;height:20px;border-radius:50%;background:#fbbf24;border:2.5px solid #fff;box-shadow:0 0 8px rgba(251,191,36,0.5);cursor:pointer";
    const homeMarker = new maplibregl.Marker({ element: homeEl })
      .setLngLat([home.home_longitude, home.home_latitude])
      .addTo(map);
    markersRef.current.push(homeMarker);

    // Trip markers
    ordered.forEach((t, i) => {
      const sel = t.id === selectedId;
      const el = document.createElement("div");
      el.style.cssText = `width:${sel?30:24}px;height:${sel?30:24}px;border-radius:50%;background:${sel?"#5eead4":"#22d3ee"};border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;font-size:${sel?11:10}px;font-weight:700;color:#02060f;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.5),0 0 0 ${sel?4:2}px rgba(34,211,238,0.3);font-family:ui-sans-serif,system-ui,sans-serif;transition:all .15s`;
      el.textContent = String(i + 1);

      const popup = new maplibregl.Popup({ offset: 20, closeButton: false, className: "atlas-popup" })
        .setHTML(`
          <div style="font-family:ui-sans-serif,system-ui,sans-serif;min-width:160px">
            <div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-bottom:2px">${flag(t.country_code)} ${t.city}</div>
            <div style="font-size:11px;color:#64748b;margin-bottom:8px">${t.country} · ${new Date(t.trip_date+"T00:00:00").toLocaleDateString("it-IT",{day:"2-digit",month:"short",year:"numeric"})}</div>
            ${t.temperature_c != null ? `<div style="font-size:11px;color:#94a3b8">🌡 ${t.temperature_c.toFixed(1)}°C</div>` : ""}
            ${t.altitude_m != null ? `<div style="font-size:11px;color:#94a3b8">⛰ ${Math.round(t.altitude_m)} m</div>` : ""}
            ${t.distance_from_home_km != null ? `<div style="font-size:11px;color:#94a3b8">↔ ${t.distance_from_home_km.toLocaleString("it-IT")} km</div>` : ""}
            ${t.notes ? `<div style="font-size:10px;color:#64748b;margin-top:6px;font-style:italic">"${t.notes}"</div>` : ""}
          </div>
        `);

      popupsRef.current.push(popup);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectTrip?.(t);
        map.flyTo({ center: [t.longitude, t.latitude], zoom: Math.max(map.getZoom(), 5), duration: 800 });
      });

      el.addEventListener("mouseenter", () => popup.setLngLat([t.longitude, t.latitude]).addTo(map));
      el.addEventListener("mouseleave", () => popup.remove());

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([t.longitude, t.latitude])
        .addTo(map);
      markersRef.current.push(marker);
    });
  }

  // Rebuild markers when trips/selection change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    // Re-import maplibregl to rebuild
    addTripsToMap(map, maplibregl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered, selectedId]);

  // Focus on selected trip
  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const t = ordered.find(x => x.id === selectedId);
    if (!t) return;
    mapRef.current.flyTo({ center: [t.longitude, t.latitude], zoom: Math.max(mapRef.current.getZoom(), 5), duration: 1000 });
  }, [selectedId, ordered]);

  // ── Replay ──────────────────────────────────────────────────────────────────
  const startReplay = () => {
    if (!ordered.length || !mapRef.current) return;
    setPlaying(true); playingRef.current = true;
    stopRotation();

    const map = mapRef.current;
    const points = [
      [ordered[0].home_longitude, ordered[0].home_latitude],
      ...ordered.map(t => [t.longitude, t.latitude]),
    ];

    let i = 0;
    const flyNext = () => {
      if (!playingRef.current || i >= points.length) { stopReplay(); return; }
      map.flyTo({ center: points[i] as [number,number], zoom: 4, duration: 2000, essential: true });
      i++;
      setTimeout(flyNext, 2500);
    };
    map.flyTo({ center: points[0] as [number,number], zoom: 2, duration: 1000 });
    setTimeout(flyNext, 1200);
  };

  const stopReplay = () => {
    setPlaying(false); playingRef.current = false;
  };

  // Inject popup styles
  useEffect(() => {
    if (!document.getElementById("atlas-popup-style")) {
      const style = document.createElement("style");
      style.id = "atlas-popup-style";
      style.textContent = `
        .atlas-popup .maplibregl-popup-content {
          background: #0d1829 !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 10px !important;
          padding: 12px 14px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
          color: #e2e8f0 !important;
        }
        .atlas-popup .maplibregl-popup-tip { border-top-color: #0d1829 !important; }
        .maplibregl-ctrl-attrib { background: rgba(0,0,0,0.4) !important; color: #475569 !important; font-size: 9px !important; }
        .maplibregl-ctrl-attrib a { color: #64748b !important; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-border" style={{ minHeight: "400px" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0, background: "#061226" }} />

      {/* Zoom buttons */}
      <div className="absolute bottom-16 right-3 flex flex-col gap-1 z-40">
        <button onClick={() => mapRef.current?.zoomIn()}
          className="w-8 h-8 bg-black/60 backdrop-blur border border-white/15 rounded-lg text-white text-lg font-bold flex items-center justify-center hover:bg-white/10 transition-colors select-none">+</button>
        <button onClick={() => mapRef.current?.zoomOut()}
          className="w-8 h-8 bg-black/60 backdrop-blur border border-white/15 rounded-lg text-white text-lg font-bold flex items-center justify-center hover:bg-white/10 transition-colors select-none">−</button>
      </div>

      {/* Replay button */}
      {trips.length >= 1 && (
        <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur border border-white/10 rounded-lg px-2 py-1.5 flex items-center gap-1 z-40">
          {!playing
            ? <button onClick={startReplay} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-white/10 transition-colors text-white"><Play className="w-3.5 h-3.5" /> Replay</button>
            : <button onClick={stopReplay} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-white/10 transition-colors text-white"><Square className="w-3.5 h-3.5" /> Stop</button>
          }
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur border border-white/10 rounded-lg px-3 py-2 flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-white/60 z-40">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400" /> Casa</div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-cyan-400" /> Tappa</div>
      </div>
    </div>
  );
}
