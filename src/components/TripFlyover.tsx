import { useEffect, useRef, useState } from "react";
import { Trip, formatTripDate } from "@/lib/storage";
import { buildFlightPath, buildFlightLegs, pointAlongPath, easeInOutCubic, lerpBearing, pathLengthKm, FlightLeg } from "@/lib/flyover";
import { fetchMapStyle } from "@/components/WorldMap";
import { getPhotosForTrip, photoToBlob } from "@/lib/photoStorage";
import { X, Play, Pause, Download, Share2, Loader2 } from "lucide-react";

const MAPTILER_KEY = "J3c87wVeji5QqN7DSqJX";

// Stessa palette di TripCardTicket.tsx/WorldMap.tsx per il mezzo di trasporto.
const TRANSPORT_STYLE: Record<string, { color: string; emoji: string }> = {
  plane: { color: "#378ADD", emoji: "✈️" },
  train: { color: "#BA7517", emoji: "🚆" },
  car: { color: "#A855F7", emoji: "🚗" },
  ship: { color: "#0F6E56", emoji: "🚢" },
  walk: { color: "#D85A30", emoji: "🚶" },
  bici: { color: "#22C55E", emoji: "🚲" },
  moto: { color: "#EAB308", emoji: "🏍️" },
};
const DEFAULT_TRANSPORT_STYLE = { color: "#60a5fa", emoji: "✈️" };

/** Rettangolo con angoli arrotondati, per il ritaglio della foto-tappa sul canvas di registrazione. */
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Emula object-fit:cover disegnando l'immagine sul canvas di registrazione. */
function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale, sh = h / scale;
  const sx = (img.naturalWidth - sw) / 2, sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function createFlyoverMarkerEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText =
    "width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;" +
    "font-size:14px;line-height:1;border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,0.5);";
  return el;
}

function styleMarkerForMode(el: HTMLDivElement, mode: string | null) {
  const style = (mode && TRANSPORT_STYLE[mode]) || DEFAULT_TRANSPORT_STYLE;
  el.style.backgroundColor = style.color;
  el.textContent = style.emoji;
}

/** Coordinate [lon,lat] dell'intera rotta, tratto stradale reale quando disponibile. */
function buildFlyoverRouteCoords(stops: { lat: number; lon: number }[], legs: FlightLeg[]): [number, number][] {
  const coords: [number, number][] = [[stops[0].lon, stops[0].lat]];
  for (const leg of legs) coords.push(...leg.pathCoords.slice(1));
  return coords;
}

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

/**
 * true solo se il browser supporta davvero la condivisione di un file video
 * (Web Share API con `files`, tipicamente Chrome/Safari su mobile) — su
 * desktop `navigator.share` spesso manca o non accetta file, quindi si
 * ricade sul link di download esistente.
 */
function canShareFile(file: File): boolean {
  try {
    return typeof navigator !== "undefined"
      && typeof (navigator as any).canShare === "function"
      && (navigator as any).canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Vola verso `leg.to` mentre anima in parallelo il marker del mezzo lungo
 * `leg.pathCoords` (tracciato stradale reale se disponibile). La telecamera
 * vola sempre dritta verso `to` (non segue le curve): solo il marker e la
 * linea disegnata seguono la strada, per scelta esplicita (vedi flyover.ts).
 *
 * La camera NON usa il `flyTo` nativo di MapLibre: viene pilotata a mano,
 * frame per frame via `jumpTo`, interpolando linearmente centro/zoom/pitch
 * (e il bearing con `lerpBearing`, che gestisce il giro 360°) tra la
 * posizione corrente e quella target. È l'unico modo per restare sincronizzata
 * con il marker — la curva di volo predefinita di MapLibre non avanza in modo
 * geograficamente lineare (nemmeno passandole un easing custom, perché lo
 * zoom-out/in intermedio distorce comunque il progresso): misurato dal vivo,
 * a metà durata la camera nativa era già al 97% del tragitto mentre un
 * marker a velocità costante era solo al 50%. Qui camera e marker leggono
 * esattamente lo stesso `t` (con lo stesso `easeInOutCubic`) ogni frame,
 * quindi restano allineati per costruzione.
 */
/** Formatta un numero di km con separatore delle migliaia in stile italiano. */
function formatKm(km: number): string {
  return Math.round(km).toLocaleString("it-IT");
}

function flyLeg(
  map: any, leg: FlightLeg, marker: any,
  rafIdRef: { current: number | null }, mountedRef: { current: boolean }, playingRef: { current: boolean },
  distance: { legKm: number; traveledBeforeKm: number; totalKm: number; traveledKmRef: { current: number }; counterEl: HTMLSpanElement | null },
): Promise<void> {
  return new Promise(resolve => {
    if (marker) {
      styleMarkerForMode(marker.getElement(), leg.to.transportMode);
      marker.setLngLat(leg.pathCoords[0]);
    }

    const fromCenter = map.getCenter();
    const fromZoom = map.getZoom();
    const fromPitch = map.getPitch();
    const fromBearing = map.getBearing();
    const { zoom: toZoom, pitch: toPitch, bearing: toBearing } = leg.camera;

    const start = performance.now();
    const tick = () => {
      if (!mountedRef.current || !playingRef.current) { resolve(); return; }
      const rawT = Math.min(1, (performance.now() - start) / leg.camera.durationMs);
      const t = easeInOutCubic(rawT);

      map.jumpTo({
        center: [
          fromCenter.lng + (leg.to.lon - fromCenter.lng) * t,
          fromCenter.lat + (leg.to.lat - fromCenter.lat) * t,
        ],
        zoom: fromZoom + (toZoom - fromZoom) * t,
        pitch: fromPitch + (toPitch - fromPitch) * t,
        bearing: lerpBearing(fromBearing, toBearing, t),
      });
      if (marker) marker.setLngLat(pointAlongPath(leg.pathCoords, t));

      const traveledKm = distance.traveledBeforeKm + distance.legKm * t;
      distance.traveledKmRef.current = traveledKm;
      if (distance.counterEl) {
        distance.counterEl.textContent = `${formatKm(traveledKm)} / ${formatKm(distance.totalKm)} km`;
      }

      if (rawT < 1) { rafIdRef.current = requestAnimationFrame(tick); }
      else { rafIdRef.current = null; resolve(); }
    };
    rafIdRef.current = requestAnimationFrame(tick);
  });
}

const STOP_PHOTO_LIMIT = 3;
const STOP_PHOTO_DISPLAY_MS = 1500;

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  const videoBlobRef = useRef<Blob | null>(null);
  const markerRef = useRef<any>(null);
  const markerRafIdRef = useRef<number | null>(null);
  // Canvas "compositing" separato usato solo per la registrazione: il canvas
  // WebGL di MapLibre da solo non basta perché marker e foto-tappa sono
  // elementi HTML sovrapposti (non parte del framebuffer), quindi captureStream()
  // sul canvas della mappa li ignorerebbe — vedi drawRecordFrame più sotto.
  const recordCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordRafIdRef = useRef<number | null>(null);
  const stopPhotoImgsRef = useRef<{ label: string; imgs: HTMLImageElement[] } | null>(null);
  const stopPhotoIndexRef = useRef(0);
  // Distanza percorsa in tempo reale: aggiornata ad ogni frame da flyLeg (via
  // ref, non stato React, per non causare un re-render a 60fps) e letta sia
  // dal contatore a schermo (via counterElRef, DOM diretto) sia da drawRecordFrame.
  const counterElRef = useRef<HTMLSpanElement>(null);
  const traveledKmRef = useRef(0);
  const totalDistanceKmRef = useRef(0);
  const legLengthsKmRef = useRef<number[]>([]);

  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "empty">("loading");
  const [playing, setPlaying] = useState(false);
  const [legIndex, setLegIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [stopPhotos, setStopPhotos] = useState<{ label: string; urls: string[] } | null>(null);
  const [stopPhotoIndex, setStopPhotoIndex] = useState(0);
  const stopPhotoUrlsRef = useRef<string[]>([]);

  const legsRef = useRef<FlightLeg[]>([]);

  /** Alla fine di una tratta, se la tappa raggiunta ha foto le mostra brevemente. */
  const maybeShowStopPhotos = async (stopLabel: string, photoKey: string) => {
    const raw = (await getPhotosForTrip(photoKey)).slice(0, STOP_PHOTO_LIMIT);
    if (raw.length === 0 || !mountedRef.current || !playingRef.current) return;
    const urls = raw.map(p => URL.createObjectURL(photoToBlob(p)));
    // Image() separate dall'<img> React: servono per disegnare la foto sul
    // canvas di registrazione anche mentre l'overlay a schermo è nel DOM.
    const imgs = urls.map(u => { const img = new Image(); img.src = u; return img; });
    stopPhotoUrlsRef.current = urls;
    stopPhotoImgsRef.current = { label: stopLabel, imgs };
    stopPhotoIndexRef.current = 0;
    setStopPhotoIndex(0);
    setStopPhotos({ label: stopLabel, urls });
    await wait(urls.length * STOP_PHOTO_DISPLAY_MS);
    urls.forEach(u => URL.revokeObjectURL(u));
    stopPhotoUrlsRef.current = [];
    stopPhotoImgsRef.current = null;
    if (mountedRef.current) setStopPhotos(null);
  };

  useEffect(() => {
    if (!stopPhotos || stopPhotos.urls.length <= 1) return;
    const id = setInterval(() => {
      setStopPhotoIndex(i => {
        const next = (i + 1) % stopPhotos.urls.length;
        stopPhotoIndexRef.current = next;
        return next;
      });
    }, STOP_PHOTO_DISPLAY_MS);
    return () => clearInterval(id);
  }, [stopPhotos]);

  /**
   * Ridisegna ogni frame, sul canvas separato usato per la registrazione:
   * il canvas WebGL della mappa (via drawImage), il marker del mezzo e la
   * foto-tappa (entrambi elementi HTML altrimenti invisibili a captureStream()).
   */
  const drawRecordFrame = () => {
    recordRafIdRef.current = requestAnimationFrame(drawRecordFrame);
    const map = mapRef.current;
    const mapCanvas = containerRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    const recordCanvas = recordCanvasRef.current;
    if (!map || !mapCanvas || !recordCanvas || !mapCanvas.clientWidth) return;
    if (recordCanvas.width !== mapCanvas.width || recordCanvas.height !== mapCanvas.height) {
      recordCanvas.width = mapCanvas.width;
      recordCanvas.height = mapCanvas.height;
    }
    const ctx = recordCanvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(mapCanvas, 0, 0, recordCanvas.width, recordCanvas.height);
    const dpr = mapCanvas.width / mapCanvas.clientWidth;

    if (markerRef.current) {
      const el = markerRef.current.getElement();
      const { x, y } = map.project(markerRef.current.getLngLat());
      ctx.beginPath();
      ctx.arc(x * dpr, y * dpr, 14 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = el.style.backgroundColor || "#60a5fa";
      ctx.fill();
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
      ctx.font = `${14 * dpr}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(el.textContent || "", x * dpr, y * dpr + dpr);
    }

    // Contatore km persistente, in alto — stessa informazione della pillola a schermo.
    const counterText = `${formatKm(traveledKmRef.current)} / ${formatKm(totalDistanceKmRef.current)} km`;
    ctx.font = `600 ${13 * dpr}px sans-serif`;
    const counterW = ctx.measureText(counterText).width + 20 * dpr;
    ctx.fillStyle = "rgba(10,22,40,0.8)";
    roundRectPath(ctx, recordCanvas.width / 2 - counterW / 2, 14 * dpr, counterW, 28 * dpr, 14 * dpr);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(counterText, recordCanvas.width / 2, 14 * dpr + 14 * dpr + dpr);

    const stopInfo = stopPhotoImgsRef.current;
    if (stopInfo && stopInfo.imgs.length > 0) {
      const img = stopInfo.imgs[stopPhotoIndexRef.current % stopInfo.imgs.length];
      if (img.complete && img.naturalWidth > 0) {
        drawImageCover(ctx, img, 0, 0, recordCanvas.width, recordCanvas.height);
        const capH = 90 * dpr;
        const gradient = ctx.createLinearGradient(0, recordCanvas.height - capH, 0, recordCanvas.height);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "rgba(0,0,0,0.8)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, recordCanvas.height - capH, recordCanvas.width, capH);
        ctx.fillStyle = "#fff";
        ctx.font = `600 ${16 * dpr}px sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(stopInfo.label, 20 * dpr, recordCanvas.height - 20 * dpr);
      }
    }
  };

  const startRecording = () => {
    if (!canRecordVideo() || !containerRef.current) return;
    const mapCanvas = containerRef.current.querySelector("canvas") as HTMLCanvasElement | null;
    if (!mapCanvas) return;
    try {
      const recordCanvas = document.createElement("canvas");
      recordCanvas.width = mapCanvas.width;
      recordCanvas.height = mapCanvas.height;
      recordCanvasRef.current = recordCanvas;
      recordRafIdRef.current = requestAnimationFrame(drawRecordFrame);

      const stream = (recordCanvas as any).captureStream(30);
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
    if (recordRafIdRef.current != null) { cancelAnimationFrame(recordRafIdRef.current); recordRafIdRef.current = null; }
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorder.onstop = () => {
      if (!mountedRef.current) return;
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      videoBlobRef.current = blob;
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setDownloadUrl(url);
    };
    recorder.stop();
    recorderRef.current = null;
  };

  /** Condivide il video con il foglio di condivisione nativo (mobile), invece di scaricarlo e basta. */
  const handleShareVideo = async () => {
    const blob = videoBlobRef.current;
    if (!blob) return;
    const file = new File([blob], "viaggio-3d.webm", { type: "video/webm" });
    try {
      await navigator.share({ files: [file], title: trips.length > 1 ? "Il mio viaggio in 3D" : trips[0].title });
    } catch {
      // utente ha annullato la condivisione: nessuna azione necessaria
    }
  };

  const playFrom = async (startIndex: number, map: any) => {
    const legs = legsRef.current;
    let i = startIndex;
    while (i < legs.length) {
      if (!playingRef.current) { legIndexRef.current = i; return; }
      if (!mountedRef.current) return;
      setLegIndex(i);
      const traveledBeforeKm = legLengthsKmRef.current.slice(0, i).reduce((sum, km) => sum + km, 0);
      await flyLeg(map, legs[i], markerRef.current, markerRafIdRef, mountedRef, playingRef, {
        legKm: legLengthsKmRef.current[i] ?? 0,
        traveledBeforeKm,
        totalKm: totalDistanceKmRef.current,
        traveledKmRef,
        counterEl: counterElRef.current,
      });
      if (!mountedRef.current) return;
      // Se nel frattempo è arrivata una pausa, il tick loop di flyLeg l'ha
      // già rilevata e ha risolto questa promise in anticipo: la tratta non
      // è davvero conclusa, quindi alla ripresa va rifatta (non saltata),
      // proseguendo dalla posizione in cui camera e marker si sono fermati.
      if (!playingRef.current) { legIndexRef.current = i; return; }
      await maybeShowStopPhotos(legs[i].to.label, legs[i].to.photoKey);
      if (!mountedRef.current || !playingRef.current) { legIndexRef.current = i; return; }
      i++;
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
    // Variabile locale alla singola invocazione dell'effetto (non un ref
    // condiviso): in React StrictMode (dev) ogni effetto viene montato,
    // smontato e rimontato una volta per verificare la cleanup. Con un ref
    // condiviso, la cleanup del primo montaggio "finto" azzererebbe lo stato
    // usato anche dal secondo (reale), e l'init asincrono del primo — che
    // arriva a creare la mappa solo dopo gli await — la creerebbe comunque,
    // lasciando due istanze MapLibre orfane sullo stesso container invece di
    // una sola. Ogni chiusura di questa closure ha la propria `cancelled`.
    let cancelled = false;

    const stops = buildFlightPath(trips);
    const legs = buildFlightLegs(stops);
    legsRef.current = legs;
    legLengthsKmRef.current = legs.map(leg => pathLengthKm(leg.pathCoords));
    totalDistanceKmRef.current = legLengthsKmRef.current.reduce((sum, km) => sum + km, 0);

    if (legs.length === 0) {
      setPhase("empty");
      return;
    }

    let map: any;

    const init = async () => {
      try {
        const ml = await import("maplibre-gl");
        const maplibregl = (ml as any).default || ml;
        if (cancelled) return;

        if (!document.getElementById("ml-css")) {
          const link = document.createElement("link");
          link.id = "ml-css"; link.rel = "stylesheet";
          link.href = "https://cdn.jsdelivr.net/npm/maplibre-gl@5.0.0/dist/maplibre-gl.css";
          document.head.appendChild(link);
        }

        const style = await fetchMapStyle();
        if (cancelled) return;
        style.projection = { type: "globe" };
        style.glyphs = `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${MAPTILER_KEY}`;

        if (!containerRef.current || cancelled) return;
        map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: [stops[0].lon, stops[0].lat],
          zoom: 2,
          attributionControl: false,
        });
        if (cancelled) { map.remove(); return; }
        mapRef.current = map;

        map.on("load", () => {
          if (cancelled || !mountedRef.current) return;

          map.addSource("flyover-route", {
            type: "geojson",
            data: { type: "Feature", geometry: { type: "LineString", coordinates: buildFlyoverRouteCoords(stops, legs) } },
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

          const markerEl = createFlyoverMarkerEl();
          styleMarkerForMode(markerEl, null);
          markerRef.current = new maplibregl.Marker({ element: markerEl })
            .setLngLat([stops[0].lon, stops[0].lat])
            .addTo(map);

          setPhase("ready");
          setTimeout(() => { map.resize(); }, 100);

          startRecording();
          playingRef.current = true;
          setPlaying(true);
          playFrom(0, map);
        });
      } catch {
        if (!cancelled && mountedRef.current) setPhase("error");
      }
    };

    init();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      playingRef.current = false;
      if (recordRafIdRef.current != null) { cancelAnimationFrame(recordRafIdRef.current); recordRafIdRef.current = null; }
      if (recorderRef.current) {
        try { recorderRef.current.stop(); } catch { /* già fermo */ }
        recorderRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (markerRafIdRef.current != null) { cancelAnimationFrame(markerRafIdRef.current); markerRafIdRef.current = null; }
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
      stopPhotoUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
      stopPhotoUrlsRef.current = [];
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const legs = legsRef.current;
  const currentLabel = legs[Math.min(legIndex, legs.length - 1)]?.to.label ?? "";
  const tripsCount = trips.length;
  const dateRangeLabel = tripsCount === 1
    ? (trips[0].trip_date === trips[0].date_end
      ? formatTripDate(trips[0].trip_date)
      : `${formatTripDate(trips[0].trip_date)} → ${formatTripDate(trips[0].date_end)}`)
    : null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.9)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ position: "absolute", inset: 0 }} ref={containerRef} />

      <button onClick={onClose} aria-label="Chiudi"
        style={{
          position: "absolute", top: 16, right: 16, width: 34, height: 34, borderRadius: 10, zIndex: 30,
          background: "rgba(10,22,40,0.8)", border: "0.5px solid #1a2d4a", cursor: "pointer",
          color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
        <X className="w-4 h-4" />
      </button>

      {phase === "ready" && !finished && (
        <div style={{
          position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 20,
          background: "rgba(10,22,40,0.8)", border: "0.5px solid #1a2d4a", borderRadius: 999,
          padding: "6px 14px", fontSize: 13, fontWeight: 600, color: "#fff",
        }}>
          <span ref={counterElRef}>0 / 0 km</span>
        </div>
      )}

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

      {phase === "ready" && !finished && (
        <div style={{
          position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 15,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
            Tappa {Math.min(legIndex + 1, legs.length)} di {legs.length} — {currentLabel}
          </div>
          <button onClick={handleTogglePlay} aria-label={playing ? "Pausa" : "Riproduci"}
            style={{
              width: 40, height: 40, borderRadius: "50%", background: "#60a5fa", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#0a1628",
            }}>
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        </div>
      )}

      {stopPhotos && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "#060e1e" }}>
          <img src={stopPhotos.urls[stopPhotoIndex]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 20px",
            background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
            fontSize: 16, color: "#fff", fontWeight: 600,
          }}>
            {stopPhotos.label}
          </div>
        </div>
      )}

      {finished && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 25, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(6,14,30,0.55)",
        }}>
          <div style={{
            width: 280, background: "#0e1c33", border: "1px solid #1a2d4a", borderRadius: 16,
            padding: "24px 24px 20px", textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
              {tripsCount > 1 ? `${tripsCount} viaggi rivissuti` : trips[0].title}
            </div>
            {dateRangeLabel && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{dateRangeLabel}</div>
            )}
            <div style={{ display: "flex", justifyContent: "center", gap: 24, margin: "18px 0" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{formatKm(totalDistanceKmRef.current)}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.5 }}>km</div>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{legs.length}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.5 }}>tappe</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={onClose}
                style={{
                  padding: "8px 16px", borderRadius: 999, background: "rgba(255,255,255,0.08)",
                  border: "0.5px solid #1a2d4a", color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>
                Chiudi
              </button>
              {downloadUrl && videoBlobRef.current && canShareFile(new File([videoBlobRef.current], "viaggio-3d.webm", { type: "video/webm" })) ? (
                <button onClick={handleShareVideo}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    padding: "8px 16px", borderRadius: 999, background: "rgba(96,165,250,0.15)",
                    border: "1px solid #60a5fa", color: "#60a5fa",
                  }}>
                  <Share2 className="w-3.5 h-3.5" /> Condividi
                </button>
              ) : downloadUrl && (
                <a href={downloadUrl} download="viaggio-3d.webm"
                  style={{
                    display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
                    padding: "8px 16px", borderRadius: 999, background: "rgba(96,165,250,0.15)",
                    border: "1px solid #60a5fa", color: "#60a5fa", textDecoration: "none",
                  }}>
                  <Download className="w-3.5 h-3.5" /> Video
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
