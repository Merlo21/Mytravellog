import { useEffect, useRef, useState } from "react";
import { Trip } from "@/lib/storage";
import { buildFlightPath, buildFlightLegs, FlightLeg } from "@/lib/flyover";
import { fetchMapStyle } from "@/components/WorldMap";
import { X, Play, Pause, Download, Loader2 } from "lucide-react";

const MAPTILER_KEY = "J3c87wVeji5QqN7DSqJX";

/**
 * Registrare il canvas della mappa richiede captureStream() + MediaRecorder:
 * ben supportati su Chrome/Edge/Firefox (quindi web e Android), ma non su
 * Safari/WebKit — che è anche il motore obbligato dentro una eventuale app
 * iOS pacchettizzata in futuro. Se manca, il bottone "Scarica" resta
 * semplicemente nascosto: l'anteprima funziona comunque ovunque.
 */
export function canRecordVideo(): boolean {
  try {
    return (
      typeof HTMLCanvasElement !== "undefined" &&
      typeof (HTMLCanvasElement.prototype as any).captureStream === "function" &&
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported("video/webm")
    );
  } catch {
    return false;
  }
}

function flyLeg(map: any, leg: FlightLeg): Promise<void> {
  return new Promise(resolve => {
    const onMoveEnd = () => { map.off("moveend", onMoveEnd); resolve(); };
    map.on("moveend", onMoveEnd);
    map.flyTo({
      center: [leg.to.lon, leg.to.lat],
      zoom: leg.camera.zoom,
      pitch: leg.camera.pitch,
      bearing: leg.camera.bearing,
      duration: leg.camera.durationMs,
      essential: true,
    });
  });
}

interface Props {
  trips: Trip[];
  onClose: () => void;
}

export function TripFlyover({ trips, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const playingRef = useRef(false);
  const legIndexRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const objectUrlRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "empty">("loading");
  const [playing, setPlaying] = useState(false);
  const [legIndex, setLegIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const legsRef = useRef<FlightLeg[]>([]);

  const startRecording = () => {
    if (!canRecordVideo() || !containerRef.current) return;
    const canvas = containerRef.current.querySelector("canvas");
    if (!canvas) return;
    try {
      const stream = (canvas as any).captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9" : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start();
      recorderRef.current = recorder;
    } catch {
      // registrazione non disponibile su questo dispositivo: l'anteprima
      // resta comunque fruibile, semplicemente senza download a fine volo.
    }
  };

  const stopRecordingAndBuildDownload = () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorder.onstop = () => {
      if (!mountedRef.current) return;
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setDownloadUrl(url);
    };
    recorder.stop();
    recorderRef.current = null;
  };

  const playFrom = async (startIndex: number, map: any) => {
    const legs = legsRef.current;
    for (let i = startIndex; i < legs.length; i++) {
      if (!playingRef.current) { legIndexRef.current = i; return; }
      if (!mountedRef.current) return;
      setLegIndex(i);
      await flyLeg(map, legs[i]);
    }
    if (!mountedRef.current) return;
    legIndexRef.current = legs.length;
    setFinished(true);
    setPlaying(false);
    playingRef.current = false;
    stopRecordingAndBuildDownload();
  };

  const handleTogglePlay = () => {
    const map = mapRef.current;
    if (!map || finished) return;
    if (playing) {
      playingRef.current = false;
      setPlaying(false);
    } else {
      playingRef.current = true;
      setPlaying(true);
      playFrom(legIndexRef.current, map);
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    const stops = buildFlightPath(trips);
    const legs = buildFlightLegs(stops);
    legsRef.current = legs;

    if (legs.length === 0) {
      setPhase("empty");
      return;
    }

    let map: any;

    const init = async () => {
      try {
        const ml = await import("maplibre-gl");
        const maplibregl = (ml as any).default || ml;

        if (!document.getElementById("ml-css")) {
          const link = document.createElement("link");
          link.id = "ml-css"; link.rel = "stylesheet";
          link.href = "https://cdn.jsdelivr.net/npm/maplibre-gl@5.0.0/dist/maplibre-gl.css";
          document.head.appendChild(link);
        }

        const style = await fetchMapStyle();
        style.projection = { type: "globe" };
        style.glyphs = `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${MAPTILER_KEY}`;

        if (!containerRef.current) return;
        map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: [stops[0].lon, stops[0].lat],
          zoom: 2,
          attributionControl: false,
        });
        mapRef.current = map;

        map.on("load", () => {
          if (!mountedRef.current) return;

          map.addSource("flyover-route", {
            type: "geojson",
            data: { type: "Feature", geometry: { type: "LineString", coordinates: stops.map(s => [s.lon, s.lat]) } },
          });
          map.addLayer({
            id: "flyover-route", type: "line", source: "flyover-route",
            paint: { "line-color": "#60a5fa", "line-width": 3, "line-opacity": 0.85 },
          });

          map.addSource("flyover-stops", {
            type: "geojson",
            data: { type: "FeatureCollection", features: stops.map(s => ({ type: "Feature", geometry: { type: "Point", coordinates: [s.lon, s.lat] }, properties: {} })) },
          });
          map.addLayer({
            id: "flyover-stops", type: "circle", source: "flyover-stops",
            paint: { "circle-radius": 5, "circle-color": "#fbbf24", "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 },
          });

          setPhase("ready");
          setTimeout(() => { map.resize(); }, 100);

          startRecording();
          playingRef.current = true;
          setPlaying(true);
          playFrom(0, map);
        });
      } catch {
        if (mountedRef.current) setPhase("error");
      }
    };

    init();

    return () => {
      mountedRef.current = false;
      playingRef.current = false;
      if (recorderRef.current) {
        try { recorderRef.current.stop(); } catch { /* già fermo */ }
        recorderRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const legs = legsRef.current;
  const currentLabel = legs[Math.min(legIndex, legs.length - 1)]?.to.label ?? "";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.9)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ position: "absolute", inset: 0 }} ref={containerRef} />

      <button onClick={onClose} aria-label="Chiudi"
        style={{
          position: "absolute", top: 16, right: 16, width: 34, height: 34, borderRadius: 10,
          background: "rgba(10,22,40,0.8)", border: "0.5px solid #1a2d4a", cursor: "pointer",
          color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
        <X className="w-4 h-4" />
      </button>

      {phase === "loading" && (
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Caricamento del flyover…
        </div>
      )}

      {phase === "error" && (
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Impossibile caricare la mappa.</div>
      )}

      {phase === "empty" && (
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", maxWidth: 280 }}>
          Questo viaggio non ha punti sufficienti per un flyover (manca la posizione di casa o della destinazione).
        </div>
      )}

      {phase === "ready" && (
        <div style={{
          position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        }}>
          {!finished && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
              Tappa {Math.min(legIndex + 1, legs.length)} di {legs.length} — {currentLabel}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!finished && (
              <button onClick={handleTogglePlay} aria-label={playing ? "Pausa" : "Riproduci"}
                style={{
                  width: 40, height: 40, borderRadius: "50%", background: "#60a5fa", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "#0a1628",
                }}>
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
            )}
            {downloadUrl && (
              <a href={downloadUrl} download="viaggio-3d.webm"
                style={{
                  display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
                  padding: "8px 14px", borderRadius: 999, background: "rgba(96,165,250,0.15)",
                  border: "1px solid #60a5fa", color: "#60a5fa", textDecoration: "none",
                }}>
                <Download className="w-3.5 h-3.5" /> Scarica video
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
