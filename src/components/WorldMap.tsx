import { useEffect, useRef, useState, useMemo } from "react";
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

interface Props {
  trips: Trip[];
  selectedId?: string | null;
  onSelectTrip?: (t: Trip) => void;
  onSelectCity?: (city: CityInfo) => void;
  globeLabels?: GlobeLabels;
  autoRotateSetting?: AutoRotate;
}

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
  {name:"Lisbona",country:"Portogallo",country_code:"PT",latitude:38.72,longitude:-9.14,tier:3},
  {name:"Atene",country:"Grecia",country_code:"GR",latitude:37.98,longitude:23.73,tier:3},
  {name:"Stoccolma",country:"Svezia",country_code:"SE",latitude:59.33,longitude:18.07,tier:3},
  {name:"San Francisco",country:"USA",country_code:"US",latitude:37.77,longitude:-122.42,tier:3},
  {name:"Miami",country:"USA",country_code:"US",latitude:25.77,longitude:-80.19,tier:3},
  {name:"Chicago",country:"USA",country_code:"US",latitude:41.85,longitude:-87.65,tier:3},
  {name:"Toronto",country:"Canada",country_code:"CA",latitude:43.65,longitude:-79.38,tier:3},
  {name:"Nairobi",country:"Kenya",country_code:"KE",latitude:-1.29,longitude:36.82,tier:3},
  {name:"Osaka",country:"Giappone",country_code:"JP",latitude:34.69,longitude:135.5,tier:3},
  {name:"Tel Aviv",country:"Israele",country_code:"IL",latitude:32.08,longitude:34.78,tier:3},
];

export function WorldMap({ trips, selectedId, onSelectTrip, onSelectCity, globeLabels = "major", autoRotateSetting = "on" }: Props) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const globeRef       = useRef<any>(null);
  const autoRotInterv  = useRef<ReturnType<typeof setInterval> | null>(null);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);

  const ordered = useMemo(() => [...trips].sort((a, b) => a.trip_date.localeCompare(b.trip_date)), [trips]);

  // ── Init globe.gl ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    import("globe.gl").then((mod) => {
      const Globe = mod.default || mod;

      const globe = Globe({ animateIn: true })(containerRef.current!)
        .globeImageUrl("//unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
        .bumpImageUrl("//unpkg.com/three-globe/example/img/earth-topology.png")
        .backgroundImageUrl("//unpkg.com/three-globe/example/img/night-sky.png")
        .pointOfView({ lat: 20, lng: 10, altitude: 2.5 })
        .width(containerRef.current!.clientWidth)
        .height(containerRef.current!.clientHeight);

      globe.controls().minDistance = 0.1;
      globe.controls().maxDistance = 800;

      // Bidirectional transition at dist 120
      globe.controls().addEventListener("change", () => {
        const cam = globe.camera();
        const distance = Math.round(cam.position.length());
        const pov = globe.pointOfView();
        const alt = Math.round(pov.altitude * 100) / 100;
        setDebugZoom({ dist: distance, alt });
        // Store current pov for transition back
        latLngRef.current = { lat: pov.lat, lng: pov.lng };
        if (distance < 120) {
          switchToLeaflet(pov.lat, pov.lng);
        }
      });

      globeRef.current = globe;

      // Click on globe → reverse geocode with Nominatim
      globe.onGlobeClick(async ({ lat, lng }: { lat: number; lng: number }) => {
        globe.pointOfView({ lat, lng, altitude: 0.5 }, 800);
        try {
          const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&accept-language=it`);
          const data = await res.json();
          if (!data || data.error) return;
          const addr = data.address || {};
          const name = addr.city || addr.town || addr.village || addr.county || data.name || `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
          const country = addr.country || "";
          const cc = (addr.country_code || "").toUpperCase();
          onSelectCity?.({ name, country, country_code: cc, latitude: lat, longitude: lng, tier: 1 });
        } catch (_) {}
      });
    });

    return () => {
      if (globeRef.current) {
        try { globeRef.current._destructor?.(); } catch(_) {}
        globeRef.current = null;
      }
      if (autoRotInterv.current) clearInterval(autoRotInterv.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-rotate ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoRotInterv.current) clearInterval(autoRotInterv.current);
    if (autoRotateSetting === "on" && globeRef.current) {
      autoRotInterv.current = setInterval(() => {
        if (!globeRef.current || playingRef.current) return;
        const pov = globeRef.current.pointOfView();
        if (pov.altitude > 1.2) {
          globeRef.current.pointOfView({ lat: pov.lat, lng: pov.lng + 0.15, altitude: pov.altitude });
        }
      }, 30);
    }
    return () => { if (autoRotInterv.current) clearInterval(autoRotInterv.current); };
  }, [autoRotateSetting]);

  // ── Update arcs (routes) ───────────────────────────────────────────────────
  useEffect(() => {
    if (!globeRef.current) return;

    if (!ordered.length) {
      globeRef.current.arcsData([]).pointsData([]).labelsData([]);
      return;
    }

    const home = ordered[0];

    // Arcs between consecutive stops
    const arcs = [];
    const allPts = [{ lat: home.home_latitude, lng: home.home_longitude }, ...ordered.map(t => ({ lat: t.latitude, lng: t.longitude }))];
    for (let i = 0; i < allPts.length - 1; i++) {
      arcs.push({ startLat: allPts[i].lat, startLng: allPts[i].lng, endLat: allPts[i+1].lat, endLng: allPts[i+1].lng });
    }

    // Points — home + trips
    const points = [
      { lat: home.home_latitude, lng: home.home_longitude, color: "#fbbf24", radius: 0.5, label: "Casa", isHome: true, id: null },
      ...ordered.map((t, i) => ({
        lat: t.latitude, lng: t.longitude,
        color: t.id === selectedId ? "#5eead4" : "#22d3ee",
        radius: t.id === selectedId ? 0.6 : 0.4,
        label: `${i + 1}. ${t.city}`,
        isHome: false,
        id: t.id,
      })),
    ];

    globeRef.current
      .arcsData(arcs)
      .arcColor(() => "#22d3ee")
      .arcAltitude(0.12)
      .arcStroke(0.5)
      .arcDashLength(0.4)
      .arcDashGap(0.2)
      .arcDashAnimateTime(3000)
      .pointsData(points)
      .pointLat((d: any) => d.lat)
      .pointLng((d: any) => d.lng)
      .pointColor((d: any) => d.color)
      .pointRadius((d: any) => d.radius)
      .pointAltitude(0.01)
      .onPointClick((d: any) => {
        if (d.id) {
          const t = trips.find(x => x.id === d.id);
          if (t) onSelectTrip?.(t);
        }
      })
      .pointLabel((d: any) => `<div style="background:#0d1829;border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:8px 12px;font-family:ui-sans-serif,system-ui,sans-serif;font-size:13px;color:#e2e8f0">${d.label}</div>`);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered, selectedId]);

  // ── City labels ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!globeRef.current) return;
    const maxTier = globeLabels === "none" ? 0 : globeLabels === "capitals" ? 1 : globeLabels === "major" ? 2 : 3;
    const cities = ALL_CITIES.filter(c => c.tier <= maxTier);

    globeRef.current
      .labelsData(cities)
      .labelLat((d: any) => d.latitude)
      .labelLng((d: any) => d.longitude)
      .labelText((d: any) => d.name)
      .labelSize((d: any) => d.tier === 1 ? 0.8 : d.tier === 2 ? 0.6 : 0.45)
      .labelDotRadius((d: any) => d.tier === 1 ? 0.4 : d.tier === 2 ? 0.3 : 0.2)
      .labelColor(() => "rgba(255,255,255,0.9)")
      .labelResolution(2)
      .onLabelClick((d: any) => onSelectCity?.(d as CityInfo));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globeLabels]);

  // ── Focus selected trip ────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId || !globeRef.current) return;
    const t = ordered.find(x => x.id === selectedId); if (!t) return;
    globeRef.current.pointOfView({ lat: t.latitude, lng: t.longitude, altitude: 0.8 }, 1000);
  }, [selectedId, ordered]);

  // ── Replay ─────────────────────────────────────────────────────────────────
  const startReplay = () => {
    if (!ordered.length || !globeRef.current || playing) return;
    setPlaying(true); playingRef.current = true;
    if (autoRotInterv.current) clearInterval(autoRotInterv.current);

    const pts = [
      { lat: ordered[0].home_latitude, lng: ordered[0].home_longitude },
      ...ordered.map(t => ({ lat: t.latitude, lng: t.longitude })),
    ];

    let i = 0;
    const flyNext = () => {
      if (!playingRef.current || !globeRef.current || i >= pts.length) { stopReplay(); return; }
      globeRef.current.pointOfView({ lat: pts[i].lat, lng: pts[i].lng, altitude: 0.7 }, 1800);
      i++;
      setTimeout(flyNext, 2200);
    };
    globeRef.current.pointOfView({ lat: pts[0].lat, lng: pts[0].lng, altitude: 2 }, 600);
    setTimeout(flyNext, 800);
  };

  const stopReplay = () => {
    setPlaying(false); playingRef.current = false;
  };

  // ── Leaflet flat map overlay ───────────────────────────────────────────────
  const [flatMode, setFlatMode] = useState(false);
  const [debugZoom, setDebugZoom] = useState<{dist:number;alt:number}>({dist:0,alt:0});
  const flatCenterRef = useRef<{lat:number;lng:number}>({lat:20,lng:10});
  const leafletRef = useRef<any>(null);
  const latLngRef = useRef<{lat:number;lng:number}>({lat:20,lng:10});
  const leafletContRef = useRef<HTMLDivElement>(null);

  const switchToLeaflet = (lat: number, lng: number) => {
    if (flatMode) return;
    flatCenterRef.current = {lat, lng};
    setFlatMode(true);
  };

  const switchToGlobe = () => {
    if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null; }
    setFlatMode(false);
    // After globe reappears, set POV just above the threshold
    setTimeout(() => {
      if (globeRef.current) {
        const { lat, lng } = latLngRef.current;
        globeRef.current.pointOfView({ lat, lng, altitude: 0.22 }, 0);
      }
    }, 50);
  };

  // Init Leaflet when flatMode turns on
  useEffect(() => {
    if (!flatMode || !leafletContRef.current || leafletRef.current) return;

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css"; link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const initLeaflet = () => {
      const L = (window as any).L;
      if (!L || !leafletContRef.current) return;
      const { lat, lng } = flatCenterRef.current;
      const map = L.map(leafletContRef.current, { center:[lat,lng], zoom:10, zoomControl:false });
      L.control.zoom({ position:"bottomright" }).addTo(map);
      // Satellite + labels
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution:"© Esri", maxZoom:19 }).addTo(map);
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { attribution:"", maxZoom:19 }).addTo(map);
      // Zoom out in Leaflet → back to globe
      map.on("zoomend", () => {
        if (map.getZoom() < 6) {
          const center = map.getCenter();
          latLngRef.current = { lat: center.lat, lng: center.lng };
          switchToGlobe();
        }
      });

      // Click to add city
      map.on("click", async (e: any) => {
        const { lat: la, lng: lo } = e.latlng;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${la}&lon=${lo}&zoom=14&accept-language=it`);
          const data = await res.json();
          if (!data || data.error) return;
          const addr = data.address || {};
          const name = addr.city || addr.town || addr.village || addr.suburb || addr.county || data.name || `${la.toFixed(3)}, ${lo.toFixed(3)}`;
          onSelectCity?.({ name, country: addr.country||"", country_code:(addr.country_code||"").toUpperCase(), latitude:la, longitude:lo, tier:1 });
        } catch(_) {}
      });
      leafletRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);
    };

    if ((window as any).L) { initLeaflet(); }
    else if (!document.getElementById("leaflet-js")) {
      const s = document.createElement("script");
      s.id = "leaflet-js"; s.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
      s.onload = initLeaflet; document.head.appendChild(s);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatMode]);

  // ── Zoom buttons ───────────────────────────────────────────────────────────
  const zoomIn = () => {
    if (!globeRef.current) return;
    const pov = globeRef.current.pointOfView();
    globeRef.current.pointOfView({ ...pov, altitude: Math.max(0.15, pov.altitude * 0.6) }, 400);
  };
  const zoomOut = () => {
    if (!globeRef.current) return;
    const pov = globeRef.current.pointOfView();
    globeRef.current.pointOfView({ ...pov, altitude: Math.min(5, pov.altitude * 1.6) }, 400);
  };

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-border">
      <div ref={containerRef} style={{ width:"100%", height:"100%", display: flatMode ? "none" : "block" }} />
      {flatMode && (
        <>
          <div ref={leafletContRef} style={{ position:"absolute", inset:0 }} />
          <button onClick={switchToGlobe}
            className="absolute top-3 left-3 z-50 bg-black/70 backdrop-blur border border-white/15 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5">
            🌍 Torna al globo
          </button>
        </>
      )}

      {/* Debug zoom indicator */}
      {!flatMode && (
        <div className="absolute top-3 left-3 z-40 bg-black/60 backdrop-blur border border-white/10 rounded-lg px-3 py-1.5 text-[11px] font-mono text-white/70">
          dist: <span className="text-cyan-400">{debugZoom.dist}</span> · alt: <span className="text-amber-400">{debugZoom.alt}</span>
          <span className="text-white/30 ml-1">(→Leaflet &lt;120)</span>
        </div>
      )}

      {/* Zoom — only on globe */}
      {!flatMode && <div className="absolute bottom-16 right-3 flex flex-col gap-1 z-40">
        <button onClick={zoomIn}
          className="w-8 h-8 bg-black/60 backdrop-blur border border-white/15 rounded-lg text-white text-lg font-bold flex items-center justify-center hover:bg-white/10 transition-colors select-none">+</button>
        <button onClick={zoomOut}
          className="w-8 h-8 bg-black/60 backdrop-blur border border-white/15 rounded-lg text-white text-lg font-bold flex items-center justify-center hover:bg-white/10 transition-colors select-none">−</button>
      </div>}

      {/* Replay */}
      {trips.length >= 1 && (
        <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur border border-white/10 rounded-lg px-2 py-1.5 flex items-center gap-1 z-40">
          {!playing
            ? <button onClick={startReplay} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-white/10 transition-colors text-white"><Play className="w-3.5 h-3.5" /> Replay</button>
            : <button onClick={stopReplay}  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-white/10 transition-colors text-white"><Square className="w-3.5 h-3.5" /> Stop</button>
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
