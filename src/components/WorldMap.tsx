import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MlMap, LngLatBoundsLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LocalTrip } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Play, Square, Video, Mountain, Layers, Globe2 } from "lucide-react";

interface Props {
  trips: LocalTrip[];
  onSelectTrip?: (t: LocalTrip) => void;
  selectedId?: string | null;
}

type LngLat = [number, number]; // [lon, lat]

function chronological(trips: LocalTrip[]) {
  return [...trips].sort((a, b) => a.trip_date.localeCompare(b.trip_date));
}

/** Smooth great-circle-ish curve via quadratic Bezier (perpendicular offset for arch). */
function curveBetween(a: LngLat, b: LngLat, segments = 64): LngLat[] {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dx = lon2 - lon1;
  const dy = lat2 - lat1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const offset = Math.min(dist * 0.18, 12);
  const nx = -dy / (dist || 1);
  const ny = dx / (dist || 1);
  const cLon = (lon1 + lon2) / 2 + nx * offset;
  const cLat = (lat1 + lat2) / 2 + ny * offset;
  const pts: LngLat[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const lon = (1 - t) * (1 - t) * lon1 + 2 * (1 - t) * t * cLon + t * t * lon2;
    const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * cLat + t * t * lat2;
    pts.push([lon, lat]);
  }
  return pts;
}

function buildRoute(trips: LocalTrip[]) {
  const ordered = chronological(trips);
  if (ordered.length === 0) return { flat: [] as LngLat[], nodes: [] as LngLat[] };
  const home: LngLat = [ordered[0].home_longitude, ordered[0].home_latitude];
  const nodes: LngLat[] = [home, ...ordered.map((t) => [t.longitude, t.latitude] as LngLat)];
  const flat: LngLat[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const seg = curveBetween(nodes[i], nodes[i + 1], 48);
    if (i === 0) flat.push(...seg);
    else flat.push(...seg.slice(1));
  }
  return { flat, nodes };
}

type StyleKey = "vector" | "satellite" | "topo";

// Free, no-API-key vector + raster styles.
const STYLES: Record<StyleKey, { url: string | maplibregl.StyleSpecification; label: string }> = {
  // OpenFreeMap "Liberty" — full vector tiles with country/state/city/town labels at all zooms.
  vector: { url: "https://tiles.openfreemap.org/styles/liberty", label: "Vettoriale" },
  // Esri World Imagery — high-detail satellite raster.
  satellite: {
    label: "Satellite",
    url: {
      version: 8,
      sources: {
        sat: {
          type: "raster",
          tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
          tileSize: 256,
          attribution: "Tiles © Esri — World Imagery",
          maxzoom: 19,
        },
      },
      layers: [{ id: "sat", type: "raster", source: "sat" }],
    } as maplibregl.StyleSpecification,
  },
  // OpenTopoMap — topographic with hillshade and contours.
  topo: {
    label: "Topo",
    url: {
      version: 8,
      sources: {
        topo: {
          type: "raster",
          tiles: [
            "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
            "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
            "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: "© OpenStreetMap, SRTM | © OpenTopoMap",
          maxzoom: 17,
        },
      },
      layers: [{ id: "topo", type: "raster", source: "topo" }],
    } as maplibregl.StyleSpecification,
  },
};

const ROUTE_SOURCE = "atlas-route";
const ROUTE_FULL_LAYER = "atlas-route-full";
const ROUTE_LIVE_LAYER = "atlas-route-live";
const ROUTE_LIVE_SOURCE = "atlas-route-live-src";
const POINTS_SOURCE = "atlas-points";
const POINTS_LAYER = "atlas-points";
const POINTS_LABELS_LAYER = "atlas-points-labels";
const HOME_SOURCE = "atlas-home";
const HOME_LAYER = "atlas-home";

export function WorldMap({ trips, onSelectTrip, selectedId }: Props) {
  const [styleKey, setStyleKey] = useState<StyleKey>("vector");
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const rafRef = useRef<number | null>(null);

  const { flat, nodes } = useMemo(() => buildRoute(trips), [trips]);
  const orderedTrips = useMemo(() => chronological(trips), [trips]);
  const flatRef = useRef<LngLat[]>([]);
  useEffect(() => { flatRef.current = flat; }, [flat]);

  // ---- init map once ----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLES[styleKey].url as any,
      center: [10, 30],
      zoom: 1.6,
      minZoom: 0.8,
      maxZoom: 18,
      attributionControl: { compact: true },
      // Preserve drawing buffer so we can grab the canvas for video recording
      preserveDrawingBuffer: true,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
    map.on("load", () => {
      // Globe projection — true 3D sphere.
      try { map.setProjection({ type: "globe" } as any); } catch {}
      // Atmosphere/sky tint to make the sphere read clearly on dark bg.
      try {
        map.setSky({
          "sky-color": "#0a1228",
          "horizon-color": "#1a3a6b",
          "fog-color": "#0a1228",
          "sky-horizon-blend": 0.6,
          "horizon-fog-blend": 0.6,
          "fog-ground-blend": 0.05,
          "atmosphere-blend": [
            "interpolate", ["linear"], ["zoom"], 0, 1, 5, 0.6, 8, 0,
          ],
        } as any);
      } catch {}
      addRouteLayers(map);
      refreshRouteData(map);
      fitToTrips(map);
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- handle style change ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(STYLES[styleKey].url as any);
    map.once("styledata", () => {
      try { map.setProjection({ type: "globe" } as any); } catch {}
      addRouteLayers(map);
      refreshRouteData(map);
    });
  }, [styleKey]);

  // ---- update data when trips change ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    refreshRouteData(map);
    fitToTrips(map);
  }, [trips]);

  function addRouteLayers(map: MlMap) {
    if (!map.getSource(ROUTE_SOURCE)) {
      map.addSource(ROUTE_SOURCE, { type: "geojson", data: emptyLine() });
    }
    if (!map.getSource(ROUTE_LIVE_SOURCE)) {
      map.addSource(ROUTE_LIVE_SOURCE, { type: "geojson", data: emptyLine() });
    }
    if (!map.getSource(POINTS_SOURCE)) {
      map.addSource(POINTS_SOURCE, { type: "geojson", data: emptyFC() });
    }
    if (!map.getSource(HOME_SOURCE)) {
      map.addSource(HOME_SOURCE, { type: "geojson", data: emptyFC() });
    }
    if (!map.getLayer(ROUTE_FULL_LAYER)) {
      map.addLayer({
        id: ROUTE_FULL_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        paint: {
          "line-color": "#22d3ee",
          "line-width": 1.2,
          "line-opacity": 0.35,
          "line-dasharray": [2, 2],
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }
    if (!map.getLayer(ROUTE_LIVE_LAYER)) {
      map.addLayer({
        id: ROUTE_LIVE_LAYER,
        type: "line",
        source: ROUTE_LIVE_SOURCE,
        paint: {
          "line-color": "#5eead4",
          "line-width": 3,
          "line-opacity": 0.95,
          "line-blur": 0.5,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }
    if (!map.getLayer(POINTS_LAYER)) {
      map.addLayer({
        id: POINTS_LAYER,
        type: "circle",
        source: POINTS_SOURCE,
        paint: {
          "circle-radius": ["case", ["get", "selected"], 9, 6],
          "circle-color": "#22d3ee",
          "circle-stroke-color": "#04111f",
          "circle-stroke-width": 2,
          "circle-opacity": 0.95,
        },
      });
    }
    if (!map.getLayer(POINTS_LABELS_LAYER)) {
      map.addLayer({
        id: POINTS_LABELS_LAYER,
        type: "symbol",
        source: POINTS_SOURCE,
        layout: {
          "text-field": ["concat", ["to-string", ["get", "idx"]], ". ", ["get", "city"]],
          "text-size": 11,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          "text-font": ["Noto Sans Regular"],
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#e6f8ff",
          "text-halo-color": "#04111f",
          "text-halo-width": 1.4,
        },
      });
    }
    if (!map.getLayer(HOME_LAYER)) {
      map.addLayer({
        id: HOME_LAYER,
        type: "circle",
        source: HOME_SOURCE,
        paint: {
          "circle-radius": 8,
          "circle-color": "#fbbf24",
          "circle-stroke-color": "#04111f",
          "circle-stroke-width": 2,
        },
      });
    }
    map.on("click", POINTS_LAYER, (e) => {
      const f = e.features?.[0];
      const id = f?.properties?.id as string | undefined;
      if (id && onSelectTripRef.current) onSelectTripRef.current(id);
    });
    map.on("mouseenter", POINTS_LAYER, () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", POINTS_LAYER, () => { map.getCanvas().style.cursor = ""; });
  }

  // Keep latest onSelectTrip available to map event handlers
  const onSelectTripRef = useRef<((id: string) => void) | null>(null);
  useEffect(() => {
    onSelectTripRef.current = (id: string) => {
      const t = trips.find((x) => x.id === id);
      if (t) onSelectTrip?.(t);
    };
  }, [trips, onSelectTrip]);

  function refreshRouteData(map: MlMap) {
    const fullSrc = map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    const liveSrc = map.getSource(ROUTE_LIVE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    const ptsSrc = map.getSource(POINTS_SOURCE) as maplibregl.GeoJSONSource | undefined;
    const homeSrc = map.getSource(HOME_SOURCE) as maplibregl.GeoJSONSource | undefined;
    fullSrc?.setData(flat.length > 1 ? lineFC(flat) : emptyLine());
    liveSrc?.setData(emptyLine());
    ptsSrc?.setData({
      type: "FeatureCollection",
      features: orderedTrips.map((t, i) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [t.longitude, t.latitude] },
        properties: { id: t.id, idx: i + 1, city: t.city, selected: t.id === selectedId },
      })),
    });
    if (orderedTrips[0]) {
      homeSrc?.setData({
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          geometry: { type: "Point", coordinates: [orderedTrips[0].home_longitude, orderedTrips[0].home_latitude] },
          properties: {},
        }],
      });
    } else {
      homeSrc?.setData(emptyFC());
    }
  }

  // Re-apply selected styling when selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (map && map.isStyleLoaded()) refreshRouteData(map);
  }, [selectedId]);

  function fitToTrips(map: MlMap) {
    if (nodes.length === 0) return;
    if (nodes.length === 1) {
      map.flyTo({ center: nodes[0], zoom: 4, duration: 1500 });
      return;
    }
    const bounds = nodes.reduce(
      (b, c) => b.extend(c as [number, number]),
      new maplibregl.LngLatBounds(nodes[0] as [number, number], nodes[0] as [number, number])
    );
    map.fitBounds(bounds as LngLatBoundsLike, { padding: 80, duration: 1500, maxZoom: 6 });
  }

  // ---- replay animation ----
  const playReplay = () => {
    const map = mapRef.current;
    if (!map || flat.length === 0 || playing) return;
    setPlaying(true);
    const liveSrc = map.getSource(ROUTE_LIVE_SOURCE) as maplibregl.GeoJSONSource;
    const start = performance.now();
    const duration = Math.min(15000, 2500 + orderedTrips.length * 1200);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const count = Math.max(2, Math.floor(flat.length * t));
      const partial = flat.slice(0, count);
      liveSrc.setData(lineFC(partial));
      const lead = partial[partial.length - 1];
      map.panTo(lead, { duration: 200, essential: true });
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else {
        setPlaying(false);
        fitToTrips(map);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const stopReplay = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPlaying(false);
    const map = mapRef.current;
    if (map) {
      const liveSrc = map.getSource(ROUTE_LIVE_SOURCE) as maplibregl.GeoJSONSource;
      liveSrc?.setData(lineFC(flat));
    }
  };

  // ---- record replay as WebM video using map canvas ----
  const recordReplay = async () => {
    const map = mapRef.current;
    if (!map || flat.length === 0 || recording) return;
    const canvas = map.getCanvas();
    // Force a repaint each frame so the captureStream sees fresh content.
    map.triggerRepaint();
    const stream = (canvas as HTMLCanvasElement).captureStream(30);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `atlas-viaggio-${new Date().toISOString().slice(0, 10)}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setRecording(false);
    };
    setRecording(true);
    recorder.start();

    const liveSrc = map.getSource(ROUTE_LIVE_SOURCE) as maplibregl.GeoJSONSource;
    const start = performance.now();
    const duration = Math.min(15000, 2500 + orderedTrips.length * 1200);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const count = Math.max(2, Math.floor(flat.length * t));
      const partial = flat.slice(0, count);
      liveSrc.setData(lineFC(partial));
      const lead = partial[partial.length - 1];
      // Smooth zoom-in along the path to highlight detail (cities/streets at higher zoom)
      const zoom = 2 + t * 3.2;
      map.jumpTo({ center: lead, zoom });
      map.triggerRepaint();
      if (t < 1) requestAnimationFrame(tick);
      else {
        // Final beauty shot: zoom out to whole route, hold ~1.5s
        fitToTrips(map);
        setTimeout(() => recorder.stop(), 1500);
      }
    };
    requestAnimationFrame(tick);
  };

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-border bg-[hsl(var(--ocean))]">
      <div ref={containerRef} className="w-full h-full" />

      {/* Top-right: style switcher */}
      <div className="absolute top-3 right-3 glass-card flex p-1 gap-1 z-[400]">
        {(Object.keys(STYLES) as StyleKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setStyleKey(k)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors flex items-center gap-1 ${
              styleKey === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {k === "topo" ? <Mountain className="w-3 h-3" /> : k === "satellite" ? <Layers className="w-3 h-3" /> : <Globe2 className="w-3 h-3" />}
            {STYLES[k].label}
          </button>
        ))}
      </div>

      {/* Bottom-left: replay controls */}
      {trips.length >= 1 && (
        <div className="absolute bottom-3 left-3 glass-card px-2 py-1.5 flex items-center gap-1 z-[400]">
          {!playing ? (
            <Button size="sm" variant="ghost" onClick={playReplay} disabled={recording} className="h-8 gap-1.5">
              <Play className="w-3.5 h-3.5" /> Replay
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={stopReplay} className="h-8 gap-1.5">
              <Square className="w-3.5 h-3.5" /> Stop
            </Button>
          )}
          <div className="w-px h-5 bg-border mx-0.5" />
          <Button size="sm" variant="ghost" onClick={recordReplay} disabled={recording || playing} className="h-8 gap-1.5">
            <Video className={`w-3.5 h-3.5 ${recording ? "text-destructive animate-pulse" : ""}`} />
            {recording ? "Registrazione…" : "Esporta video"}
          </Button>
        </div>
      )}

      {/* Bottom-right: legend */}
      <div className="absolute bottom-3 right-3 glass-card px-3 py-2 flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground z-[400]">
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-accent" /> Casa</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-primary" /> Tappa</div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-primary" /> Percorso</div>
      </div>
    </div>
  );
}

// ---- helpers ----
function lineFC(coords: LngLat[]): GeoJSON.Feature<GeoJSON.LineString> {
  return { type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} };
}
function emptyLine(): GeoJSON.Feature<GeoJSON.LineString> {
  return { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} };
}
function emptyFC(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}
