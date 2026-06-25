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
  globeLabels?:;
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

      // Fetch style and inject globe projection (MapLibre 5.x)
      const styleResp = await fetch(`https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`);
      const style = await styleResp.json();
      style.projection = { type: "globe" };

      map = new maplibregl.Map({
        container: containerRef.current!,
        style,
        center: [10, 20],
        zoom: 1.5,
        attributionControl: false,
      });

      mapRef.current = map;

      map.on("load", () => {
        // Globe atmosphere
        try {
          map.setFog({
            color: "rgb(186,210,235)",
            "high-color": "rgb(36,92,223)",
            "horizon-blend": 0.02,
            "space-color": "rgb(6,18,38)",
            "star-intensity": 0.6,
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

    const home = ordered[0];
    const coords = [
      [home.home_longitude, home.home_latitude],
      ...ordered.map(t => [t.longitude, t.latitude]),
    ];

    // Route line
    map.addSource("route-line", {
      type: "geojson",
      data: { type:"Feature", geometry:{ type:"LineString", coordinates: coords } },
    });
    map.addLayer({
      id: "route-line", type: "line", source: "route-line",
      paint: { "line-color":"#22d3ee", "line-width":2, "line-opacity":0.8, "line-dasharray":[3,2] },
    });

    // Home marker
    const homeEl = document.createElement("div");
    homeEl.style.cssText = "width:16px;height:16px;border-radius:50%;background:#fbbf24;border:2.5px solid #fff;box-shadow:0 0 8px rgba(251,191,36,0.6);cursor:pointer";
    markersRef.current.push(
      new maplibregl.Marker({ element: homeEl })
        .setLngLat([home.home_longitude, home.home_latitude])
        .addTo(map)
    );

    // Trip markers
    ordered.forEach((t, i) => {
      const sel = t.id === selectedId;
      const el = document.createElement("div");
      el.style.cssText = `width:${sel?30:24}px;height:${sel?30:24}px;border-radius:50%;background:${sel?"#5eead4":"#22d3ee"};border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;font-size:${sel?11:10}px;font-weight:700;color:#02060f;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.5);font-family:ui-sans-serif,system-ui,sans-serif`;
      el.textContent = String(i + 1);

      const flag = (c: string) => c.length === 2
        ? String.fromCodePoint(...c.toUpperCase().split("").map(ch => 0x1f1e6 + ch.charCodeAt(0) - 65))
        : "🌍";

      const popup = new maplibregl.Popup({ offset:20, closeButton:false, className:"atlas-popup" })
        .setHTML(`
          <div style="font-family:ui-sans-serif,system-ui,sans-serif;min-width:150px">
            <div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-bottom:2px">${flag(t.country_code)} ${t.city}</div>
            <div style="font-size:11px;color:#64748b;margin-bottom:6px">${t.country} · ${new Date(t.trip_date+"T00:00:00").toLocaleDateString("it-IT",{day:"2-digit",month:"short",year:"numeric"})}</div>
            ${t.temperature_c != null ? `<div style="font-size:11px;color:#94a3b8">🌡 ${t.temperature_c.toFixed(1)}°C</div>`:""}
            ${t.altitude_m != null ? `<div style="font-size:11px;color:#94a3b8">⛰ ${Math.round(t.altitude_m)}m</div>`:""}
            ${t.distance_from_home_km != null ? `<div style="font-size:11px;color:#94a3b8">↔ ${t.distance_from_home_km.toLocaleString("it-IT")}km</div>`:""}
            ${t.notes ? `<div style="font-size:10px;color:#64748b;margin-top:4px;font-style:italic">"${t.notes}"</div>`:""}
          </div>
        `);

      popupsRef.current.push(popup);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectTripRef.current?.(t);
        map.flyTo({ center:[t.longitude,t.latitude], zoom:Math.max(map.getZoom(),5), duration:800 });
      });
      el.addEventListener("mouseenter", () => popup.setLngLat([t.longitude,t.latitude]).addTo(map));
      el.addEventListener("mouseleave", () => popup.remove());

      markersRef.current.push(
        new maplibregl.Marker({ element: el })
          .setLngLat([t.longitude, t.latitude])
          .addTo(map)
      );
    });
  }

  // ── City labels ────────────────────────────────────────────────────────────
  function updateCityLabels(map: any, maplibregl: any) {
    // Remove existing city markers
    cityMarkerRefs.current.forEach(({marker}) => marker.remove());
    cityMarkerRefs.current = [];

    const maxTier = 3; // Controlled by zoom levels, not settings

    ALL_CITIES.filter(c => c.tier <= maxTier).forEach(city => {
      const el = document.createElement("div");
      el.style.cssText = "display:flex;align-items:center;gap:4px;cursor:pointer;pointer-events:none;opacity:0;transition:opacity 0.4s";
      const dot = document.createElement("div");
      const ds = city.tier===1?5:city.tier===2?4:3;
      dot.style.cssText = `width:${ds}px;height:${ds}px;border-radius:50%;background:rgba(255,255,255,0.9);box-shadow:0 0 4px rgba(0,0,0,0.8);flex-shrink:0`;
      const lbl = document.createElement("span");
      lbl.textContent = city.name;
      lbl.style.cssText = `font-family:ui-sans-serif,system-ui,sans-serif;font-size:${city.tier===1?13:city.tier===2?11:10}px;font-weight:${city.tier===1?700:600};color:rgba(255,255,255,0.95);text-shadow:0 0 8px rgba(0,0,0,1),1px 1px 3px rgba(0,0,0,0.9);white-space:nowrap`;
      el.appendChild(dot); el.appendChild(lbl);
      el.addEventListener("mouseenter", () => { dot.style.background="#22d3ee"; lbl.style.color="#22d3ee"; });
      el.addEventListener("mouseleave", () => { dot.style.background="rgba(255,255,255,0.9)"; lbl.style.color="rgba(255,255,255,0.95)"; });
      el.addEventListener("click", (e) => { e.stopPropagation(); onSelectCityRef.current?.(city); });
      const marker = new maplibregl.Marker({ element: el, anchor:"left" })
        .setLngLat([city.longitude, city.latitude]).addTo(map);
      cityMarkerRefs.current.push({ marker, el, city });
    });

    // Show/hide by zoom: T1 at z≥2, T2 at z≥3, T3 at z≥4.5
    const updateVis = () => {
      const z = map.getZoom();
      cityMarkerRefs.current.forEach(({ el, city }) => {
        const show = city.tier===1 ? z>=2 : city.tier===2 ? z>=3 : z>=4.5;
        el.style.opacity = show ? "1" : "0";
        el.style.pointerEvents = show ? "auto" : "none";
      });
    };
    map.on("zoom", updateVis);
    updateVis();
  }

  // Rebuild on trips/selection change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    import("maplibre-gl").then(ml => {
      const maplibregl = (ml as any).default || ml;
      addTripsToMap(map, maplibregl);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered, selectedId]);

  // Focus selected trip
  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const t = ordered.find(x => x.id === selectedId); if (!t) return;
    mapRef.current.flyTo({ center:[t.longitude,t.latitude], zoom:Math.max(mapRef.current.getZoom(),5), duration:1000 });
  }, [selectedId, ordered]);

  // ── Replay ─────────────────────────────────────────────────────────────────
  const startReplay = () => {
    if (!ordered.length || !mapRef.current || playing) return;
    setPlaying(true); playingRef.current = true; stopRotation();
    const pts = [
      [ordered[0].home_longitude, ordered[0].home_latitude],
      ...ordered.map(t => [t.longitude, t.latitude]),
    ];
    let i = 0;
    const flyNext = () => {
      if (!playingRef.current || !mapRef.current || i >= pts.length) { stopReplay(); return; }
      mapRef.current.flyTo({ center: pts[i] as [number,number], zoom:4, duration:2000, essential:true });
      i++;
      setTimeout(flyNext, 2500);
    };
    mapRef.current.flyTo({ center: pts[0] as [number,number], zoom:2, duration:800 });
    setTimeout(flyNext, 1000);
  };

  const stopReplay = () => {
    setPlaying(false); playingRef.current = false;
    if (autoRotateSetting === "on") startRotation();
  };

  // Popup styles
  useEffect(() => {
    if (!document.getElementById("atlas-popup-css")) {
      const s = document.createElement("style"); s.id = "atlas-popup-css";
      s.textContent = `.atlas-popup .maplibregl-popup-content{background:#0d1829!important;border:1px solid rgba(255,255,255,0.1)!important;border-radius:10px!important;padding:12px 14px!important;box-shadow:0 8px 32px rgba(0,0,0,0.6)!important;color:#e2e8f0!important}.atlas-popup .maplibregl-popup-tip{border-top-color:#0d1829!important}.maplibregl-ctrl-attrib{background:rgba(0,0,0,0.4)!important;color:#475569!important;font-size:9px!important}`;
      document.head.appendChild(s);
    }
  }, []);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-border">
      <div ref={containerRef} style={{ position:"absolute", inset:0 }} />

      {/* Zoom */}
      <div className="absolute bottom-16 right-3 flex flex-col gap-1 z-40">
        <button onClick={() => mapRef.current?.zoomIn()}
          className="w-8 h-8 bg-black/60 backdrop-blur border border-white/15 rounded-lg text-white text-lg font-bold flex items-center justify-center hover:bg-white/10 transition-colors select-none">+</button>
        <button onClick={() => mapRef.current?.zoomOut()}
          className="w-8 h-8 bg-black/60 backdrop-blur border border-white/15 rounded-lg text-white text-lg font-bold flex items-center justify-center hover:bg-white/10 transition-colors select-none">−</button>
      </div>

      {/* Replay */}
      {trips.length >= 1 && (
        <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur border border-white/10 rounded-lg px-2 py-1.5 flex items-center gap-1 z-40">
          {!playing
            ? <button onClick={startReplay} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-white/10 transition-colors text-white"><Play className="w-3.5 h-3.5"/>Replay</button>
            : <button onClick={stopReplay}  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-white/10 transition-colors text-white"><Square className="w-3.5 h-3.5"/>Stop</button>
          }
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur border border-white/10 rounded-lg px-3 py-2 flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-white/60 z-40">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400"/>Casa</div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-cyan-400"/>Tappa</div>
      </div>
    </div>
  );
}
