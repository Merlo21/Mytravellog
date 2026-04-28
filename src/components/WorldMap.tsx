import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocalTrip } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Play, Square, Video, Mountain, Layers } from "lucide-react";

interface Props {
  trips: LocalTrip[];
  onSelectTrip?: (t: LocalTrip) => void;
  selectedId?: string | null;
}

type LatLng = [number, number];

/** Sort by chronological visit date (oldest -> newest) */
function chronological(trips: LocalTrip[]): LocalTrip[] {
  return [...trips].sort((a, b) => a.trip_date.localeCompare(b.trip_date));
}

/** Build a smooth great-circle-ish curve between two points using a quadratic bezier in lat/lon space. */
function curveBetween(a: LatLng, b: LatLng, segments = 64): LatLng[] {
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  // midpoint pushed perpendicular to give a sinuous arc
  const midLat = (lat1 + lat2) / 2;
  const midLon = (lon1 + lon2) / 2;
  const dx = lon2 - lon1;
  const dy = lat2 - lat1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // offset perpendicular, scaled by distance — gives nice arching like FindPenguins
  const offset = Math.min(dist * 0.18, 12);
  const nx = -dy / (dist || 1);
  const ny = dx / (dist || 1);
  const cLat = midLat + ny * offset;
  const cLon = midLon + nx * offset;
  const pts: LatLng[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * cLat + t * t * lat2;
    const lon = (1 - t) * (1 - t) * lon1 + 2 * (1 - t) * t * cLon + t * t * lon2;
    pts.push([lat, lon]);
  }
  return pts;
}

/** Build the full chronological route through all trips, starting from home. */
function buildRoute(trips: LocalTrip[]): { segments: LatLng[][]; flat: LatLng[]; nodes: LatLng[] } {
  const ordered = chronological(trips);
  if (ordered.length === 0) return { segments: [], flat: [], nodes: [] };
  const home: LatLng = [ordered[0].home_latitude, ordered[0].home_longitude];
  const nodes: LatLng[] = [home, ...ordered.map((t) => [t.latitude, t.longitude] as LatLng)];
  const segments: LatLng[][] = [];
  const flat: LatLng[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const seg = curveBetween(nodes[i], nodes[i + 1], 48);
    segments.push(seg);
    if (i === 0) flat.push(...seg);
    else flat.push(...seg.slice(1));
  }
  return { segments, flat, nodes };
}

/** Custom div icons — pulsing dot for visited cities, home star. */
const tripIcon = (label: string, selected: boolean) =>
  L.divIcon({
    className: "atlas-marker",
    html: `<div class="relative flex items-center justify-center">
      <div class="absolute w-8 h-8 rounded-full bg-primary/30 ${selected ? "animate-ping" : ""}"></div>
      <div class="relative w-3.5 h-3.5 rounded-full bg-primary border-2 border-background shadow-[0_0_12px_hsl(var(--primary))]"></div>
      <div class="absolute -bottom-5 whitespace-nowrap text-[10px] font-mono uppercase tracking-wider text-foreground bg-background/80 backdrop-blur px-1.5 py-0.5 rounded border border-border">${label}</div>
    </div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const homeIcon = L.divIcon({
  className: "atlas-marker",
  html: `<div class="relative flex items-center justify-center">
    <div class="absolute w-10 h-10 rounded-full bg-accent/25"></div>
    <div class="relative w-4 h-4 rotate-45 bg-accent border-2 border-background shadow-[0_0_14px_hsl(var(--accent))]"></div>
  </div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

/** Helper component: imperatively expose the map instance via callback. */
function MapBinder({ onReady }: { onReady: (m: L.Map) => void }) {
  const map = useMap();
  useEffect(() => { onReady(map); }, [map, onReady]);
  return null;
}

type LayerKey = "topo" | "satellite" | "dark";

const LAYERS: Record<LayerKey, { url: string; attribution: string; maxZoom: number; label: string }> = {
  topo: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap, SRTM | © OpenTopoMap",
    maxZoom: 17,
    label: "Topo",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri — Source: Esri, Earthstar Geographics",
    maxZoom: 19,
    label: "Satellite",
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "© OpenStreetMap, © CARTO",
    maxZoom: 19,
    label: "Dark",
  },
};

export function WorldMap({ trips, onSelectTrip, selectedId }: Props) {
  const [layer, setLayer] = useState<LayerKey>("topo");
  const [progress, setProgress] = useState(1); // 0..1 — how much of route to draw
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const rafRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const { segments, flat, nodes } = useMemo(() => buildRoute(trips), [trips]);
  const orderedTrips = useMemo(() => chronological(trips), [trips]);

  // Visible portion of the route based on progress (0..1)
  const visibleRoute = useMemo(() => {
    if (flat.length === 0) return [];
    const count = Math.max(2, Math.floor(flat.length * progress));
    return flat.slice(0, count);
  }, [flat, progress]);

  // Fit map to all nodes when trips change
  useEffect(() => {
    if (!mapRef.current || nodes.length === 0) return;
    const bounds = L.latLngBounds(nodes.map(([lat, lon]) => L.latLng(lat, lon)));
    mapRef.current.fitBounds(bounds.pad(0.25), { animate: true, duration: 1.2 });
  }, [nodes.length]);

  /** Animated replay: drives `progress` from 0 to 1 and pans camera to current point. */
  const playReplay = () => {
    if (flat.length === 0 || playing) return;
    setPlaying(true);
    setProgress(0);
    const start = performance.now();
    const duration = Math.min(15000, 2500 + orderedTrips.length * 1200); // ~1.2s per leg, max 15s
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setProgress(t);
      // pan camera to leading edge
      const idx = Math.min(flat.length - 1, Math.floor(flat.length * t));
      const [lat, lon] = flat[idx];
      mapRef.current?.panTo([lat, lon], { animate: true, duration: 0.3 });
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else {
        setPlaying(false);
        // refit to whole route at end
        if (mapRef.current && nodes.length > 1) {
          const bounds = L.latLngBounds(nodes.map(([la, lo]) => L.latLng(la, lo)));
          mapRef.current.fitBounds(bounds.pad(0.25), { animate: true, duration: 1.5 });
        }
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const stopReplay = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPlaying(false);
    setProgress(1);
  };

  /** Record the replay as a WebM video using MediaRecorder on a captured canvas of the map element. */
  const recordReplay = async () => {
    if (!mapRef.current || flat.length === 0) return;
    const container = mapRef.current.getContainer();
    // Use HTMLCanvasElement-based capture via html2canvas-like trick is heavy.
    // Instead, capture a stream from a hidden canvas that mirrors the map via DOM screenshots is not feasible without extra deps.
    // Approach: capture the page region using getDisplayMedia is intrusive.
    // Lightweight approach: use canvas captureStream of an offscreen canvas where we draw markers + path on a static map background.
    // To keep it simple and dependency-free, we capture the visible map container via `captureStream` of a <canvas> we paint each frame with map screenshot via SVG foreignObject -> blob.
    // Given the complexity, we use a simpler but effective approach: record the entire map container by drawing it into a canvas every frame using `html-to-image`-style technique would add deps.
    // Solution: leverage the browser's `CanvasCaptureMediaStreamTrack` from a canvas where we render the route + a snapshot tile collage.

    try {
      // Snapshot the current map tiles into an offscreen canvas using SVG foreignObject
      const w = container.clientWidth;
      const h = container.clientHeight;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      const stream = canvas.captureStream(30);
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
      recorderRef.current = recorder;
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

      // Take a snapshot of the map container by serializing tile <img> positions into the canvas.
      const drawSnapshot = () => {
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("background-color") || "#000";
        ctx.fillRect(0, 0, w, h);
        const tiles = container.querySelectorAll<HTMLImageElement>(".leaflet-tile-loaded");
        tiles.forEach((img) => {
          const transform = img.style.transform; // translate3d(x, y, 0)
          const m = /translate3d\((-?\d+\.?\d*)px,\s*(-?\d+\.?\d*)px/.exec(transform);
          if (!m) return;
          const x = parseFloat(m[1]);
          const y = parseFloat(m[2]);
          try { ctx.drawImage(img, x, y, img.width || 256, img.height || 256); } catch {}
        });
        // Draw route polyline
        if (visibleRouteRef.current.length > 1 && mapRef.current) {
          ctx.beginPath();
          visibleRouteRef.current.forEach(([lat, lon], i) => {
            const p = mapRef.current!.latLngToContainerPoint([lat, lon]);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.strokeStyle = "rgba(34, 211, 238, 0.95)";
          ctx.lineWidth = 3;
          ctx.shadowColor = "rgba(34, 211, 238, 0.7)";
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;
          // Leading dot
          const last = visibleRouteRef.current[visibleRouteRef.current.length - 1];
          const lp = mapRef.current.latLngToContainerPoint(last);
          ctx.beginPath();
          ctx.arc(lp.x, lp.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = "#22d3ee";
          ctx.fill();
        }
      };

      // Run replay while continuously snapshotting
      const start = performance.now();
      const duration = Math.min(15000, 2500 + orderedTrips.length * 1200);
      setProgress(0);
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        setProgress(t);
        const idx = Math.min(flat.length - 1, Math.floor(flat.length * t));
        mapRef.current?.panTo(flat[idx], { animate: false });
        drawSnapshot();
        if (t < 1) requestAnimationFrame(tick);
        else {
          // Hold final frame for 1.2s
          let extra = 0;
          const hold = () => {
            extra += 16;
            drawSnapshot();
            if (extra < 1200) requestAnimationFrame(hold);
            else recorder.stop();
          };
          requestAnimationFrame(hold);
        }
      };
      requestAnimationFrame(tick);
    } catch (e) {
      console.error("Recording failed", e);
      setRecording(false);
    }
  };

  // Keep visibleRoute available to the recording closure
  const visibleRouteRef = useRef<LatLng[]>([]);
  useEffect(() => { visibleRouteRef.current = visibleRoute; }, [visibleRoute]);

  const home: LatLng | null = nodes[0] ?? null;

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-border bg-[hsl(var(--ocean))]">
      <MapContainer
        center={[20, 10]}
        zoom={2}
        minZoom={2}
        maxZoom={LAYERS[layer].maxZoom}
        worldCopyJump
        zoomControl={false}
        style={{ width: "100%", height: "100%", background: "hsl(var(--ocean))" }}
      >
        <MapBinder onReady={(m) => { mapRef.current = m; }} />
        <TileLayer
          key={layer}
          url={LAYERS[layer].url}
          attribution={LAYERS[layer].attribution}
          maxZoom={LAYERS[layer].maxZoom}
          // Subtle dark tint via CSS filter on topo to fit the dark theme
          className={layer === "topo" ? "atlas-tile-tint" : ""}
        />

        {/* Faded full route preview underneath */}
        {flat.length > 1 && (
          <Polyline
            positions={flat}
            pathOptions={{ color: "hsl(175 84% 55%)", weight: 1.5, opacity: 0.25, dashArray: "4 6" }}
          />
        )}

        {/* Active (animated/visible) route on top */}
        {visibleRoute.length > 1 && (
          <Polyline
            positions={visibleRoute}
            pathOptions={{ color: "hsl(175 84% 55%)", weight: 3, opacity: 0.95, lineCap: "round", lineJoin: "round" }}
          />
        )}

        {/* Leading point during replay */}
        {playing && visibleRoute.length > 0 && (
          <CircleMarker
            center={visibleRoute[visibleRoute.length - 1]}
            radius={6}
            pathOptions={{ color: "hsl(175 95% 65%)", fillColor: "hsl(175 95% 65%)", fillOpacity: 1, weight: 2 }}
          />
        )}

        {/* Home */}
        {home && (
          <Marker position={home} icon={homeIcon}>
            <Tooltip direction="top" offset={[0, -10]}>
              <span className="font-mono text-[10px] uppercase">Casa</span>
            </Tooltip>
          </Marker>
        )}

        {/* Trip markers in chronological order */}
        {orderedTrips.map((t, i) => (
          <Marker
            key={t.id}
            position={[t.latitude, t.longitude]}
            icon={tripIcon(`${i + 1}. ${t.city}`, selectedId === t.id)}
            eventHandlers={{ click: () => onSelectTrip?.(t) }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              <div className="text-xs">
                <div className="font-semibold">{t.city}, {t.country}</div>
                <div className="text-[10px] opacity-70">{t.trip_date}</div>
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      {/* Top-right: layer switcher */}
      <div className="absolute top-3 right-3 glass-card flex p-1 gap-1 z-[400]">
        {(Object.keys(LAYERS) as LayerKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setLayer(k)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors ${
              layer === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {k === "topo" ? <Mountain className="inline w-3 h-3 mr-1" /> : <Layers className="inline w-3 h-3 mr-1" />}
            {LAYERS[k].label}
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
          <Button
            size="sm"
            variant="ghost"
            onClick={recordReplay}
            disabled={recording || playing}
            className="h-8 gap-1.5"
          >
            <Video className={`w-3.5 h-3.5 ${recording ? "text-destructive animate-pulse" : ""}`} />
            {recording ? "Registrazione…" : "Esporta video"}
          </Button>
        </div>
      )}

      {/* Bottom-right: legend */}
      <div className="absolute bottom-3 right-3 glass-card px-3 py-2 flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground z-[400]">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rotate-45 bg-accent" /> Casa
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-primary" /> Tappa
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-primary" /> Percorso
        </div>
      </div>
    </div>
  );
}
