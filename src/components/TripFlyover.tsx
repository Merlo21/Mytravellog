import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trip, formatTripDate } from "@/lib/storage";
import { buildFlightPath, buildFlightLegs, pointAlongPath, easeInOutCubic, lerpBearing, pathLengthKm, FlightLeg } from "@/lib/flyover";
import { fetchMapStyle } from "@/components/WorldMap";
import { getPhotosForTrip, photoToBlob, saveReliefImage } from "@/lib/photoStorage";
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

/**
 * Layout di una carta nel "ventaglio" (mano di carte) quando una tappa ha più
 * foto. Le carte si aprono verso destra da un pivot in basso a sinistra; la
 * carta `current` si fa avanti dritta, ingrandita e sollevata. Al variare di
 * `current` (ogni STOP_PHOTO_DISPLAY_MS) le carte transitano tra il loro slot e
 * il primo piano → effetto "sfoglia". Valori in px/gradi "a schermo"; il canvas
 * di registrazione li scala per dpr. `z`: la carta corrente sopra a tutte.
 */
export function fanCardLayout(i: number, current: number, n: number) {
  const isFront = i === current;
  return {
    tx: i * 16,
    ty: (isFront ? -12 : 0) + i * 2,
    rotate: isFront ? 0 : 4 + i * 5,
    scale: isFront ? 1.08 : 1,
    z: isFront ? n + 1 : i,
  };
}

/**
 * Immagine di una "puntina da mappa" (testa tonda ambra + punta), disegnata su
 * canvas e usata come icon-image di un symbol layer per le tappe. Essendo un
 * layer WebGL della mappa (non un marker HTML) finisce automaticamente anche
 * nel video registrato, senza compositing manuale. icon-anchor "bottom" mette
 * la punta sulla coordinata; icon-pitch-alignment viewport la tiene "in piedi"
 * sulla mappa inclinata, come uno spillo su una mappa di sughero.
 */
function createPinImageData(): ImageData {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = s; c.height = s;
  const ctx = c.getContext("2d")!;
  const cx = s / 2, headCy = s * 0.32, headR = s * 0.24, tipY = s * 0.92;
  // corpo (testa + punta) in un'unica sagoma ambra, con ombra
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.moveTo(cx - headR * 0.7, headCy + headR * 0.6);
  ctx.lineTo(cx, tipY);
  ctx.lineTo(cx + headR * 0.7, headCy + headR * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // anello bianco + foro centrale
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#fff";
  ctx.beginPath(); ctx.arc(cx, headCy, headR, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(cx, headCy, headR * 0.42, 0, Math.PI * 2); ctx.fill();
  return ctx.getImageData(0, 0, s, s);
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

/**
 * Inquadratura d'arrivo sul punto di PARTENZA prima che il viaggio inizi.
 * Senza, la mappa partiva dalla vista mondo (zoom 2) e la prima tratta
 * zoomava e traslava insieme: quando l'inquadratura era finalmente leggibile,
 * il marker era già a metà tratta ("quando il video inizia siamo molto avanti
 * nel percorso"). Qui la camera vola prima a inquadrare stops[0] con lo
 * zoom/pitch/bearing della prima tratta, marker fermo sulla partenza; poi il
 * viaggio parte con la camera già a posto (nessuno zoom simultaneo alla
 * traslazione). Pilotata a mano come flyLeg per coerenza. */
function flyIntro(
  map: any,
  target: { center: [number, number]; zoom: number; pitch: number; bearing: number },
  mountedRef: { current: boolean }, playingRef: { current: boolean },
  rafIdRef: { current: number | null }, durationMs: number,
): Promise<void> {
  return new Promise(resolve => {
    const fromCenter = map.getCenter();
    const fromZoom = map.getZoom();
    const fromPitch = map.getPitch();
    const fromBearing = map.getBearing();
    const start = performance.now();
    const tick = () => {
      if (!mountedRef.current || !playingRef.current) { resolve(); return; }
      const rawT = Math.min(1, (performance.now() - start) / durationMs);
      const t = easeInOutCubic(rawT);
      map.jumpTo({
        center: [
          fromCenter.lng + (target.center[0] - fromCenter.lng) * t,
          fromCenter.lat + (target.center[1] - fromCenter.lat) * t,
        ],
        zoom: fromZoom + (target.zoom - fromZoom) * t,
        pitch: fromPitch + (target.pitch - fromPitch) * t,
        bearing: lerpBearing(fromBearing, target.bearing, t),
      });
      if (rawT < 1) { rafIdRef.current = requestAnimationFrame(tick); }
      else { rafIdRef.current = null; resolve(); }
    };
    rafIdRef.current = requestAnimationFrame(tick);
  });
}

/**
 * Fa orbitare lentamente la camera attorno al punto attuale (ruota solo il
 * bearing, tenendo fermi centro/zoom/pitch) per durationMs. Usata mentre a
 * schermo è mostrata la cartolina foto della tappa: così il 3D resta vivo
 * invece di congelarsi. Velocità angolare costante (niente easing): un'orbita
 * che accelera/decelera sembrerebbe uno scatto. Il bearing finale diventa il
 * punto di partenza del flyLeg successivo (che legge map.getBearing()), quindi
 * la ripresa del volo è senza salti.
 */
function orbitStop(
  map: any,
  mountedRef: { current: boolean }, playingRef: { current: boolean },
  rafIdRef: { current: number | null }, durationMs: number, degrees = 40,
): Promise<void> {
  return new Promise(resolve => {
    const fromBearing = map.getBearing();
    const start = performance.now();
    const tick = () => {
      if (!mountedRef.current || !playingRef.current) { rafIdRef.current = null; resolve(); return; }
      const rawT = Math.min(1, (performance.now() - start) / durationMs);
      map.setBearing(fromBearing + degrees * rawT);
      if (rawT < 1) { rafIdRef.current = requestAnimationFrame(tick); }
      else { rafIdRef.current = null; resolve(); }
    };
    rafIdRef.current = requestAnimationFrame(tick);
  });
}

const STOP_PHOTO_LIMIT = 5;
const STOP_PHOTO_DISPLAY_MS = 1500;
// Quante foto (una per tappa, in ordine) entrano nel ventaglio della panoramica finale.
const FINALE_PHOTO_LIMIT = 5;
// Quanto resta a schermo/registrata la panoramica finale prima di fermare il video.
const FINALE_HOLD_MS = 3000;
// Ventaglio "francobolli" del finale: carte più grandi e ben distanziate del
// ventaglio-tappa (STOP), così nel fermo-immagine si vedono TUTTE le foto.
const FINALE_CARD_W = 132;   // larghezza carta (px "a schermo"; il canvas scala per dpr)
const FINALE_FAN_STEP = 126; // scostamento orizzontale per carta ≈ larghezza → praticamente affiancate (niente sovrapposizione)

/** Layout di una carta nel ventaglio finale: spread ampio (tutte visibili),
 *  leggero arco simmetrico. Nessuna carta "in primo piano" (a differenza del
 *  ventaglio-tappa che si sfoglia). */
export function finaleFanLayout(i: number, n: number) {
  const center = (n - 1) / 2;
  return {
    tx: i * FINALE_FAN_STEP,
    ty: Math.abs(i - center) * 3,
    rotate: (i - center) * 3,
    z: i,
  };
}

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
  const orbitRafIdRef = useRef<number | null>(null);
  // Panoramica finale: coordinate dell'intero tracciato (per inquadrare tutto),
  // chiavi foto di ogni tappa (per il ventaglio finale) e le immagini/URL
  // caricati, da comporre nel video e da revocare al cleanup.
  const allCoordsRef = useRef<[number, number][]>([]);
  const finalePhotoKeysRef = useRef<string[]>([]);
  const finaleImgsRef = useRef<HTMLImageElement[] | null>(null);
  const finaleUrlsRef = useRef<string[]>([]);
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
  // URL delle foto mostrate a ventaglio nella panoramica finale (on-screen).
  const [finalePhotos, setFinalePhotos] = useState<string[]>([]);

  const legsRef = useRef<FlightLeg[]>([]);

  /**
   * Alla fine di una tratta, se la tappa raggiunta ha foto le mostra come
   * cartolina in un angolo mentre la camera orbita lentamente sul punto (il
   * 3D resta vivo, non si congela a schermo intero come prima).
   */
  const maybeShowStopPhotos = async (stopLabel: string, photoKey: string) => {
    const raw = (await getPhotosForTrip(photoKey)).slice(0, STOP_PHOTO_LIMIT);
    if (raw.length === 0 || !mountedRef.current || !playingRef.current) return;
    const urls = raw.map(p => URL.createObjectURL(photoToBlob(p)));
    // Image() separate dall'<img> React: servono per disegnare la foto sul
    // canvas di registrazione anche mentre la cartolina a schermo è nel DOM.
    const imgs = urls.map(u => { const img = new Image(); img.src = u; return img; });
    stopPhotoUrlsRef.current = urls;
    stopPhotoImgsRef.current = { label: stopLabel, imgs };
    stopPhotoIndexRef.current = 0;
    setStopPhotoIndex(0);
    setStopPhotos({ label: stopLabel, urls });
    const durationMs = urls.length * STOP_PHOTO_DISPLAY_MS;
    const map = mapRef.current;
    if (map) await orbitStop(map, mountedRef, playingRef, orbitRafIdRef, durationMs);
    else await wait(durationMs);
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
    if (stopInfo && stopInfo.imgs.length > 0 && stopInfo.imgs.every(im => im.complete && im.naturalWidth > 0)) {
      const n = stopInfo.imgs.length;
      const current = stopPhotoIndexRef.current % n;
      const pad = 16 * dpr;
      const topY = 56 * dpr;               // sotto la pillola del contatore (top:16 + ~28 alto)

      if (n === 1) {
        // Foto singola: cartolina/polaroid con etichetta interna (come a schermo).
        const cardW = Math.min(208 * dpr, recordCanvas.width * 0.46);
        const frame = 8 * dpr;
        const photoW = cardW - frame * 2;
        const photoH = photoW * 3 / 4;
        const labelH = 24 * dpr;
        const cardH = frame * 2 + photoH + labelH;
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 16 * dpr; ctx.shadowOffsetY = 6 * dpr;
        ctx.fillStyle = "#fbfbf7";
        roundRectPath(ctx, pad, topY, cardW, cardH, 6 * dpr);
        ctx.fill();
        ctx.restore();
        ctx.save();
        roundRectPath(ctx, pad + frame, topY + frame, photoW, photoH, 3 * dpr);
        ctx.clip();
        drawImageCover(ctx, stopInfo.imgs[0], pad + frame, topY + frame, photoW, photoH);
        ctx.restore();
        ctx.fillStyle = "#1a1a1a";
        ctx.font = `700 ${13 * dpr}px sans-serif`;
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(stopInfo.label, pad + frame, topY + frame + photoH + labelH / 2, photoW);
      } else {
        // Più foto: ventaglio "mano di carte" (stesso layout dell'overlay a
        // schermo, vedi fanCardLayout), pivot in basso a sinistra.
        const cardW = Math.min(140 * dpr, recordCanvas.width * 0.34);
        const frame = 6 * dpr;
        const photoW = cardW - frame * 2;
        const photoH = photoW * 3 / 4;
        const cardH = photoH + frame * 2;
        const pivotY = topY + cardH;        // bordo inferiore delle carte
        // Disegna dal fondo del ventaglio verso la carta corrente (z crescente).
        const order = stopInfo.imgs.map((_, i) => i).sort((a, b) => fanCardLayout(a, current, n).z - fanCardLayout(b, current, n).z);
        for (const i of order) {
          const t = fanCardLayout(i, current, n);
          ctx.save();
          ctx.translate(pad + t.tx * dpr, pivotY + t.ty * dpr);
          ctx.rotate((t.rotate * Math.PI) / 180);
          ctx.scale(t.scale, t.scale);
          // carta con bordo inferiore-sinistro nell'origine: rettangolo (0,-cardH)→(cardW,0)
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 12 * dpr; ctx.shadowOffsetY = 4 * dpr;
          ctx.fillStyle = "#fbfbf7";
          roundRectPath(ctx, 0, -cardH, cardW, cardH, 5 * dpr);
          ctx.fill();
          ctx.restore();
          ctx.save();
          roundRectPath(ctx, frame, -cardH + frame, photoW, photoH, 3 * dpr);
          ctx.clip();
          drawImageCover(ctx, stopInfo.imgs[i], frame, -cardH + frame, photoW, photoH);
          ctx.restore();
          ctx.restore();
        }
        // Etichetta città in una pillola scura sotto il ventaglio (le carte non
        // hanno più una didascalia interna condivisa).
        const labelText = stopInfo.label;
        ctx.font = `700 ${13 * dpr}px sans-serif`;
        const lw = ctx.measureText(labelText).width + 20 * dpr;
        const ly = pivotY + 16 * dpr;
        ctx.fillStyle = "rgba(10,22,40,0.85)";
        roundRectPath(ctx, pad, ly, lw, 24 * dpr, 12 * dpr);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(labelText, pad + 10 * dpr, ly + 12 * dpr + dpr);
      }
    }

    // Panoramica finale nel video: dettagli del viaggio in una pillola in alto
    // e le foto a ventaglio "francobollo" in basso a sinistra (angolo fisso, la
    // camera ha già inquadrato il tracciato nello spazio libero — vedi flyToOverview).
    const finaleImgs = finaleImgsRef.current;
    if (finaleImgs) {
      if (finaleImgs.length > 0 && finaleImgs.every(im => im.complete && im.naturalWidth > 0)) {
        const n = finaleImgs.length;
        // Scala il ventaglio per farlo stare sempre nel frame (schermi stretti).
        const fanCssW = FINALE_CARD_W + (n - 1) * FINALE_FAN_STEP;
        const fit = Math.min(1, (recordCanvas.width / dpr - 40) / fanCssW);
        const u = dpr * fit;
        const cardW = FINALE_CARD_W * u;
        const frame = 6 * u;
        const photoW = cardW - frame * 2;
        const photoH = photoW * 3 / 4;
        const cardH = photoH + frame * 2;
        const baseX = 20 * dpr;
        const pivotY = recordCanvas.height - 26 * dpr;
        const order = finaleImgs.map((_, i) => i).sort((a, b) => finaleFanLayout(a, n).z - finaleFanLayout(b, n).z);
        for (const i of order) {
          const t = finaleFanLayout(i, n);
          ctx.save();
          ctx.translate(baseX + t.tx * u, pivotY + t.ty * u);
          ctx.rotate((t.rotate * Math.PI) / 180);
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 12 * dpr; ctx.shadowOffsetY = 4 * dpr;
          ctx.fillStyle = "#fbfbf7";
          roundRectPath(ctx, 0, -cardH, cardW, cardH, 5 * dpr);
          ctx.fill();
          ctx.restore();
          ctx.save();
          roundRectPath(ctx, frame, -cardH + frame, photoW, photoH, 3 * dpr);
          ctx.clip();
          drawImageCover(ctx, finaleImgs[i], frame, -cardH + frame, photoW, photoH);
          ctx.restore();
          ctx.restore();
        }
      }
      // pillola dettagli in alto a DESTRA (coerente con la card a schermo)
      const title = trips.length > 1 ? `${trips.length} viaggi` : trips[0].title;
      const details = `${title}  ·  ${formatKm(totalDistanceKmRef.current)} km  ·  ${legsRef.current.length} tappe`;
      ctx.font = `700 ${15 * dpr}px sans-serif`;
      const dw = ctx.measureText(details).width + 28 * dpr;
      const dx = recordCanvas.width - dw - 16 * dpr;
      const dy = 16 * dpr;
      ctx.fillStyle = "rgba(10,22,40,0.9)";
      roundRectPath(ctx, dx, dy, dw, 30 * dpr, 15 * dpr);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(details, dx + 14 * dpr, dy + 15 * dpr + dpr);
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

  /** Stacca all'indietro e inquadra l'intero tracciato in prospettiva 3D,
   *  lasciando libero l'angolo in basso a sinistra (padding asimmetrico) per il
   *  ventaglio foto + i dettagli. Risolve a fine transizione. */
  const flyToOverview = (map: any): Promise<void> => new Promise(resolve => {
    const coords = allCoordsRef.current;
    if (!coords.length) { resolve(); return; }
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    for (const [lon, lat] of coords) {
      minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    }
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(); };
    try {
      map.once("moveend", finish);
      map.fitBounds([[minLon, minLat], [maxLon, maxLat]], {
        // Centrato e ZOOMATO stretto sul territorio del percorso (riempie il
        // frame, poco globo): padding ridotto e simmetrico ai lati, solo un po'
        // più sotto per non finire dietro al ventaglio foto; tilt basso e
        // maxZoom alto per stare vicini alla zona attraversata.
        pitch: 45, bearing: 0,
        padding: { top: 50, right: 60, bottom: 110, left: 60 },
        duration: 2600, maxZoom: 12,
      });
    } catch { finish(); return; }
    setTimeout(finish, 3400); // salvagente se moveend non scatta
  });

  /** Carica fino a FINALE_PHOTO_LIMIT foto (una per tappa) per il ventaglio finale. */
  const collectFinalePhotos = async (): Promise<void> => {
    const urls: string[] = [];
    for (const key of finalePhotoKeysRef.current) {
      if (urls.length >= FINALE_PHOTO_LIMIT) break;
      const raw = await getPhotosForTrip(key);
      if (raw.length > 0) urls.push(URL.createObjectURL(photoToBlob(raw[0])));
    }
    finaleUrlsRef.current = urls;
    finaleImgsRef.current = urls.map(u => { const img = new Image(); img.src = u; return img; });
    setFinalePhotos(urls);
  };

  /** Cattura uno snapshot della panoramica (mappa + tracciato + puntine) e lo
   *  salva come "rilievo 3D" del viaggio — solo per i flyover di un singolo
   *  viaggio (per un recap multi-viaggio non c'è una card a cui legarlo). */
  const captureReliefSnapshot = async (map: any): Promise<void> => {
    if (trips.length !== 1) return;
    try {
      const mapCanvas = containerRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
      if (!mapCanvas) return;
      const snap = document.createElement("canvas");
      snap.width = mapCanvas.width; snap.height = mapCanvas.height;
      const sctx = snap.getContext("2d");
      if (!sctx) return;
      // drawImage dal canvas WebGL va fatto nello stesso frame (prima del clear):
      // qui il record loop sta ancora girando, quindi il buffer è valido.
      sctx.drawImage(mapCanvas, 0, 0);
      const blob: Blob | null = await new Promise(res => snap.toBlob(res, "image/jpeg", 0.85));
      if (blob) await saveReliefImage(trips[0].id, blob);
    } catch {
      // snapshot non riuscito (es. contesto WebGL perso): non bloccare il finale.
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
    // Panoramica finale: carica le foto per il ventaglio, stacca all'indietro
    // per inquadrare tutto il tracciato con le puntine, poi mostra dettagli +
    // ventaglio (compositi anche nel video), cattura lo snapshot del rilievo e
    // infine ferma la registrazione.
    await collectFinalePhotos();
    if (!mountedRef.current) return;
    await flyToOverview(map);
    if (!mountedRef.current) return;
    setFinished(true);
    setPlaying(false);
    playingRef.current = false;
    // Finale a mappa FERMA (niente orbita): il fermo-immagine riassuntivo è più
    // leggibile. Con preserveDrawingBuffer la registrazione tiene comunque anche
    // a mappa statica; un repaint esplicito assicura l'ultimo frame nel buffer.
    map.triggerRepaint();
    await wait(FINALE_HOLD_MS);
    if (!mountedRef.current) return;
    await captureReliefSnapshot(map);
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
    allCoordsRef.current = buildFlyoverRouteCoords(stops, legs);
    // Una foto per tappa (chiavi uniche) per il ventaglio della panoramica finale.
    finalePhotoKeysRef.current = Array.from(new Set(stops.map(s => s.photoKey)));

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
          // Necessario per catturare lo snapshot del rilievo (drawImage/toBlob
          // dal canvas WebGL) anche quando la mappa è ferma a fine volo — senza,
          // il buffer viene svuotato dopo il compositing e uscirebbe nero.
          preserveDrawingBuffer: true,
        });
        if (cancelled) { map.remove(); return; }
        mapRef.current = map;

        map.on("load", async () => {
          if (cancelled || !mountedRef.current) return;

          map.addSource("flyover-route", {
            type: "geojson",
            data: { type: "Feature", geometry: { type: "LineString", coordinates: buildFlyoverRouteCoords(stops, legs) } },
          });
          // Contorno scuro (casing) SOTTO la linea: fa staccare il tracciato dal
          // satellite (prima una linea blu sottile si perdeva sullo sfondo).
          map.addLayer({
            id: "flyover-route-casing", type: "line", source: "flyover-route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "rgba(6,14,30,0.65)", "line-width": 8.5 },
          });
          // Tracciato in risalto: giallo/ambra (come le puntine), spesso e pieno.
          map.addLayer({
            id: "flyover-route", type: "line", source: "flyover-route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#fbbf24", "line-width": 4.5, "line-opacity": 1 },
          });

          map.addSource("flyover-stops", {
            type: "geojson",
            data: { type: "FeatureCollection", features: stops.map(s => ({ type: "Feature", geometry: { type: "Point", coordinates: [s.lon, s.lat] }, properties: { name: s.label } })) },
          });
          // Tappe come puntine da mappa (symbol layer con icona disegnata),
          // non più semplici pallini: la punta poggia sulla coordinata e lo
          // spillo resta "in piedi" sulla mappa inclinata. Sopra ogni puntina il
          // nome della città (label con alone scuro per leggerla sul satellite).
          if (!map.hasImage("flyover-pin")) map.addImage("flyover-pin", createPinImageData(), { pixelRatio: 2 });
          map.addLayer({
            id: "flyover-stops", type: "symbol", source: "flyover-stops",
            layout: {
              "icon-image": "flyover-pin",
              "icon-size": 0.9,
              "icon-anchor": "bottom",
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
              "icon-pitch-alignment": "viewport",
              "text-field": ["get", "name"],
              "text-font": ["Open Sans Bold"],
              "text-size": 13,
              "text-anchor": "bottom",
              "text-offset": [0, -2.6],
              "text-allow-overlap": true,
              "text-ignore-placement": true,
              "text-optional": true,
              "text-pitch-alignment": "viewport",
            },
            paint: {
              "text-color": "#ffffff",
              "text-halo-color": "rgba(6,14,30,0.9)",
              "text-halo-width": 1.6,
              "text-halo-blur": 0.5,
            },
          });

          const markerEl = createFlyoverMarkerEl();
          styleMarkerForMode(markerEl, null);
          markerRef.current = new maplibregl.Marker({ element: markerEl })
            .setLngLat([stops[0].lon, stops[0].lat])
            .addTo(map);

          setPhase("ready");
          setTimeout(() => { map.resize(); }, 100);
          // Mostra subito il totale reale invece di "0 / 0 km" durante l'intro.
          if (counterElRef.current) counterElRef.current.textContent = `0 / ${formatKm(totalDistanceKmRef.current)} km`;

          startRecording();
          playingRef.current = true;
          setPlaying(true);

          // Inquadratura d'arrivo sulla partenza, poi il viaggio parte da lì.
          const first = legs[0].camera;
          await flyIntro(
            map,
            { center: [stops[0].lon, stops[0].lat], zoom: first.zoom, pitch: first.pitch, bearing: first.bearing },
            mountedRef, playingRef, markerRafIdRef, 1400,
          );
          if (cancelled || !mountedRef.current || !playingRef.current) return;
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
      if (orbitRafIdRef.current != null) { cancelAnimationFrame(orbitRafIdRef.current); orbitRafIdRef.current = null; }
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
      stopPhotoUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
      stopPhotoUrlsRef.current = [];
      finaleUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
      finaleUrlsRef.current = [];
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

  // Portal su document.body: senza, il modale (position:fixed) viene confinato
  // al primo antenato con un `transform` — es. il wrapper .animate-fade-up della
  // card viaggio in MieiViaggi (translateY resta applicato con fill:both) —
  // che diventa il blocco di contenimento e clippa il popup dentro la card
  // invece che sul viewport. Il portal lo rende figlio diretto di body.
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}>
      {/* Card grande centrata (non più a tutto schermo bordo-a-bordo): stesso
          linguaggio del popup regioni (scrim scuro sfocato, angoli arrotondati,
          apertura fade+scale, chiusura cliccando fuori) ma GRANDE, per non
          sacrificare l'immersione 3D né la risoluzione del video esportato. */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "relative", width: "100%", height: "100%", maxWidth: 880, maxHeight: 600,
          background: "#060e1e", border: "0.5px solid #1a2d4a", borderRadius: 16,
          overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          animation: "flyoverModalIn 0.28s cubic-bezier(0.22,1,0.36,1) both",
        }}>
        <div style={{ position: "absolute", inset: 0 }} ref={containerRef} />

      {/* Chiudi in alto a SINISTRA: la card dei dati viaggio ora sta in alto a destra. */}
      <button onClick={onClose} aria-label="Chiudi"
        style={{
          position: "absolute", top: 16, left: 16, width: 34, height: 34, borderRadius: 10, zIndex: 30,
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

      {/* Foto della tappa in alto a sinistra, sotto il contatore km: la camera
          orbita sulla tappa dietro (vedi orbitStop), quindi le foto arricchiscono
          la scena 3D invece di sostituirla. In alto (non in basso) per non
          sovrapporsi ai controlli play/pausa centrati in fondo. */}
      {stopPhotos && stopPhotos.urls.length === 1 && (
        // Una sola foto: cartolina/polaroid con etichetta interna.
        <div style={{
          position: "absolute", left: 16, top: 60, zIndex: 15, width: "min(208px, 46vw)",
          background: "#fbfbf7", borderRadius: 6, padding: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)", transform: "rotate(-3deg)",
          animation: "flyoverCardIn 0.35s cubic-bezier(0.22,1,0.36,1) both",
        }}>
          <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", borderRadius: 3, overflow: "hidden", background: "#000" }}>
            <img src={stopPhotos.urls[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "6px 2px 2px" }}>
            {stopPhotos.label}
          </div>
        </div>
      )}

      {stopPhotos && stopPhotos.urls.length > 1 && (
        // Più foto: ventaglio "mano di carte" che si sfoglia (vedi fanCardLayout).
        <div style={{
          position: "absolute", left: 16, top: 60, zIndex: 15,
          animation: "flyoverCardIn 0.35s cubic-bezier(0.22,1,0.36,1) both",
        }}>
          <div style={{ position: "relative", width: 140 + (stopPhotos.urls.length - 1) * 16, height: 135 }}>
            {stopPhotos.urls.map((u, i) => {
              const t = fanCardLayout(i, stopPhotoIndex, stopPhotos.urls.length);
              return (
                <div key={i} style={{
                  position: "absolute", left: 0, bottom: 0, width: 140,
                  transformOrigin: "bottom left",
                  transform: `translate(${t.tx}px, ${t.ty}px) rotate(${t.rotate}deg) scale(${t.scale})`,
                  transition: "transform 0.5s cubic-bezier(0.22,1,0.36,1)",
                  zIndex: t.z,
                  background: "#fbfbf7", borderRadius: 5, padding: 6,
                  boxShadow: "0 6px 16px rgba(0,0,0,0.45)",
                }}>
                  <div style={{ width: "100%", aspectRatio: "4 / 3", borderRadius: 3, overflow: "hidden", background: "#000" }}>
                    <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{
            display: "inline-block", marginTop: 8, fontSize: 12, fontWeight: 700, color: "#fff",
            background: "rgba(10,22,40,0.85)", borderRadius: 999, padding: "4px 10px",
            maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {stopPhotos.label}
          </div>
        </div>
      )}

      {/* Panoramica finale: NON copre la mappa (il tracciato in 3D con le
          puntine resta visibile). Dettagli in alto, foto a ventaglio in basso a
          sinistra (angolo fisso, non sul percorso), bottoni in basso a destra. */}
      {finished && (
        <>
          <div style={{
            position: "absolute", top: 16, right: 16, zIndex: 25, maxWidth: "70%",
            background: "rgba(10,22,40,0.92)", border: "0.5px solid #1a2d4a", borderRadius: 14,
            padding: "12px 14px", boxShadow: "0 8px 24px rgba(0,0,0,0.45)", backdropFilter: "blur(2px)",
            animation: "flyoverCardIn 0.35s cubic-bezier(0.22,1,0.36,1) both",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {tripsCount === 1 && trips[0].country_code && (
                <img src={"https://flagcdn.com/w40/" + trips[0].country_code.toLowerCase() + ".png"} alt="" width="22" height="16"
                  style={{ borderRadius: 3, objectFit: "cover", flexShrink: 0 }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
              <div className="font-display" style={{ fontSize: 15, fontWeight: 700, color: "#f0f4ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {tripsCount > 1 ? `${tripsCount} viaggi rivissuti` : trips[0].title}
              </div>
            </div>
            {dateRangeLabel && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>{dateRangeLabel}</div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {[{ v: formatKm(totalDistanceKmRef.current), l: "km" }, { v: String(legs.length), l: "tappe" }].map(s => (
                <div key={s.l} style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid #1a2d4a", borderRadius: 10, padding: "5px 12px", textAlign: "center" }}>
                  <div className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>{s.v}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {finalePhotos.length > 0 && (() => {
            const n = finalePhotos.length;
            const fanW = FINALE_CARD_W + (n - 1) * FINALE_FAN_STEP;
            // scala per stare nel viewport su schermi stretti (pivot in basso a sinistra)
            const fanScale = Math.min(1, (window.innerWidth * 0.9 - 40) / fanW);
            return (
              <div style={{ position: "absolute", left: 20, bottom: 20, zIndex: 25, transformOrigin: "bottom left", transform: `scale(${fanScale})` }}>
                <div style={{ position: "relative", width: fanW, height: FINALE_CARD_W * 0.75 + 30 }}>
                  {finalePhotos.map((u, i) => {
                    const t = finaleFanLayout(i, n);
                    return (
                      <div key={i} style={{
                        position: "absolute", left: 0, bottom: 0, width: FINALE_CARD_W, transformOrigin: "bottom left",
                        transform: `translate(${t.tx}px, ${t.ty}px) rotate(${t.rotate}deg)`, zIndex: t.z,
                        background: "#fbfbf7", borderRadius: 6, padding: 6, boxShadow: "0 6px 16px rgba(0,0,0,0.45)",
                      }}>
                        <div style={{ width: "100%", aspectRatio: "4 / 3", borderRadius: 3, overflow: "hidden", background: "#000" }}>
                          <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <div style={{ position: "absolute", right: 16, bottom: 20, zIndex: 26, display: "flex", gap: 10 }}>
            <button onClick={onClose}
              style={{
                padding: "8px 16px", borderRadius: 999, background: "rgba(10,22,40,0.85)",
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
        </>
      )}
      </div>
    </div>,
    document.body
  );
}
