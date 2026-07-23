import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trip, formatTripDate } from "@/lib/storage";
import { buildFlightPath, buildFlightLegs, tripTotalKm, FlightLeg } from "@/lib/flyover";
import { fetchMapStyle } from "@/components/WorldMap";
import { getPhotosForTrip, photoToBlob, saveReliefImage } from "@/lib/photoStorage";
import { X, Share2, Loader2 } from "lucide-react";

const MAPTILER_KEY = "J3c87wVeji5QqN7DSqJX";

/** Rettangolo con angoli arrotondati (per comporre il poster su canvas). */
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Emula object-fit:cover disegnando l'immagine sul canvas del poster. */
function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale, sh = h / scale;
  const sx = (img.naturalWidth - sw) / 2, sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/**
 * Immagine di una "puntina da mappa" (testa tonda ambra + punta), disegnata su
 * canvas e usata come icon-image di un symbol layer per le tappe. Essendo un
 * layer WebGL della mappa finisce automaticamente anche nello snapshot del
 * poster. icon-anchor "bottom" mette la punta sulla coordinata; pitch-alignment
 * viewport la tiene "in piedi" sulla mappa inclinata, come uno spillo.
 */
function createPinImageData(): ImageData {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = s; c.height = s;
  const ctx = c.getContext("2d")!;
  const cx = s / 2, headCy = s * 0.32, headR = s * 0.24, tipY = s * 0.92;
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
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#fff";
  ctx.beginPath(); ctx.arc(cx, headCy, headR, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(cx, headCy, headR * 0.42, 0, Math.PI * 2); ctx.fill();
  return ctx.getImageData(0, 0, s, s);
}

/** Coordinate [lon,lat] dell'intera rotta, tratto stradale reale quando disponibile. */
function buildFlyoverRouteCoords(stops: { lat: number; lon: number }[], legs: FlightLeg[]): [number, number][] {
  const coords: [number, number][] = [[stops[0].lon, stops[0].lat]];
  for (const leg of legs) coords.push(...leg.pathCoords.slice(1));
  return coords;
}

/**
 * true solo se il browser supporta davvero la condivisione di un file (Web
 * Share API con `files`, tipicamente mobile) — su desktop `navigator.share`
 * spesso manca o non accetta file, quindi si ricade sul download.
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

/** Formatta un numero di km con separatore delle migliaia in stile italiano. */
function formatKm(km: number): string {
  return Math.round(km).toLocaleString("it-IT");
}

// Quante foto (una per tappa, in ordine) entrano nel ventaglio del poster.
const FINALE_PHOTO_LIMIT = 5;
// Margini (px) attorno al tracciato nel poster. Con fitBounds questi margini
// fissi fanno sì che il percorso riempia SEMPRE il frame allo stesso modo,
// qualunque sia la lunghezza (lo zoom si adatta): più sotto per non finire
// dietro al ventaglio foto in basso a sinistra.
const FINALE_PADDING = { top: 50, right: 60, bottom: 110, left: 60 };
// Ventaglio "francobolli": carte ben distanziate così si vedono TUTTE le foto.
const FINALE_CARD_W = 132;   // larghezza carta (px "a schermo"; il canvas scala per dpr)
const FINALE_FAN_STEP = 126; // scostamento ≈ larghezza → praticamente affiancate

/** Layout di una carta nel ventaglio: spread ampio (tutte visibili), leggero arco simmetrico. */
export function finaleFanLayout(i: number, n: number) {
  const center = (n - 1) / 2;
  return {
    tx: i * FINALE_FAN_STEP,
    ty: Math.abs(i - center) * 3,
    rotate: (i - center) * 3,
    z: i,
  };
}

interface Props {
  trips: Trip[];
  onClose: () => void;
}

/**
 * Poster statico del viaggio in 3D: mappa satellitare inclinata con il tracciato
 * (giallo) e le tappe a puntine con i nomi città, inquadrata sull'intero
 * percorso. Sopra: dati del viaggio (con bandiere dei paesi a ventaglio) e le
 * foto a ventaglio. L'utente può zoomare/spostare, poi "Salva" (lo snapshot
 * diventa il foglio sul biglietto in "I miei viaggi") o "Condividi" (immagine).
 *
 * Sostituisce il vecchio flyover animato + video .webm (rimosso, ripescabile
 * dal tag git `flyover-animato-v1`): più leggero, robusto e condivisibile ovunque.
 */
export function TripFlyover({ trips, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const allCoordsRef = useRef<[number, number][]>([]);
  const finalePhotoKeysRef = useRef<string[]>([]);
  const finaleImgsRef = useRef<HTMLImageElement[]>([]);
  const finaleUrlsRef = useRef<string[]>([]);
  const totalKmRef = useRef(0);
  const legsRef = useRef<FlightLeg[]>([]);

  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "empty">("loading");
  const [poster, setPoster] = useState(false); // overlay del poster pronti (dopo l'inquadratura)
  const [finalePhotos, setFinalePhotos] = useState<string[]>([]);
  const [savingRelief, setSavingRelief] = useState(false);

  const tripsCount = trips.length;
  const legs = legsRef.current;
  const dateRangeLabel = tripsCount === 1
    ? (trips[0].trip_date === trips[0].date_end
      ? formatTripDate(trips[0].trip_date)
      : `${formatTripDate(trips[0].trip_date)} → ${formatTripDate(trips[0].date_end)}`)
    : null;

  // Codici bandiera dei paesi TOCCATI (destinazione + tappe), in ordine di
  // percorso, deduplicati per nome (IT/Italia non si ripete) tenendo il codice.
  const flagCodes = useMemo(() => {
    const seen = new Set<string>();
    const codes: string[] = [];
    const add = (name?: string, code?: string) => {
      const key = (name || code || "").trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      if (code) codes.push(code.toLowerCase());
    };
    for (const t of trips) {
      for (const w of t.waypoints ?? []) add(w.country, w.country_code);
      add(t.country, t.country_code);
    }
    return codes.slice(0, 5);
  }, [trips]);

  // Esc chiude il poster (oltre a click fuori / X).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Inquadra l'intero tracciato con fitBounds: il percorso riempie sempre il
   *  frame allo stesso modo (margini fissi), qualunque sia la lunghezza. */
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
        pitch: 45, bearing: 0, padding: FINALE_PADDING, duration: 1400, maxZoom: 12,
      });
    } catch { finish(); return; }
    setTimeout(finish, 2200); // salvagente se moveend non scatta
  });

  /** Carica fino a FINALE_PHOTO_LIMIT foto (una per tappa) per il ventaglio. */
  const collectFinalePhotos = async (): Promise<void> => {
    const urls: string[] = [];
    for (const key of finalePhotoKeysRef.current) {
      if (urls.length >= FINALE_PHOTO_LIMIT) break;
      const raw = await getPhotosForTrip(key);
      if (raw.length > 0) urls.push(URL.createObjectURL(photoToBlob(raw[0])));
    }
    if (!mountedRef.current) { urls.forEach(u => URL.revokeObjectURL(u)); return; }
    finaleUrlsRef.current = urls;
    finaleImgsRef.current = urls.map(u => { const img = new Image(); img.src = u; return img; });
    setFinalePhotos(urls);
  };

  /**
   * Compone il POSTER su un canvas: mappa (tracciato + puntine, dal canvas WebGL
   * grazie a preserveDrawingBuffer) + ventaglio foto in basso a sinistra +
   * pillola dati in alto a destra. Restituisce il canvas pronto per toBlob.
   */
  const composePoster = (mapCanvas: HTMLCanvasElement, flagImgs: HTMLImageElement[]): HTMLCanvasElement => {
    const c = document.createElement("canvas");
    c.width = mapCanvas.width; c.height = mapCanvas.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(mapCanvas, 0, 0);
    const dpr = mapCanvas.width / (mapCanvas.clientWidth || mapCanvas.width);

    // Ventaglio foto (basso a sinistra), scalato per stare nel frame.
    const imgs = finaleImgsRef.current.filter(im => im.complete && im.naturalWidth > 0);
    if (imgs.length > 0) {
      const n = imgs.length;
      const fanCssW = FINALE_CARD_W + (n - 1) * FINALE_FAN_STEP;
      const fit = Math.min(1, (c.width / dpr - 40) / fanCssW);
      const u = dpr * fit;
      const cardW = FINALE_CARD_W * u;
      const frame = 6 * u;
      const photoW = cardW - frame * 2;
      const photoH = photoW * 3 / 4;
      const cardH = photoH + frame * 2;
      const baseX = 20 * dpr;
      const pivotY = c.height - 26 * dpr;
      const order = imgs.map((_, i) => i).sort((a, b) => finaleFanLayout(a, n).z - finaleFanLayout(b, n).z);
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
        drawImageCover(ctx, imgs[i], frame, -cardH + frame, photoW, photoH);
        ctx.restore();
        ctx.restore();
      }
    }

    // Card dati in alto a destra — FEDELE a quella a schermo (bandiere a
    // ventaglio + titolo + date + pill km/tappe), così il poster salvato è
    // identico a ciò che si vede.
    const u = dpr;
    const innerPad = 14 * u;
    const flagW = 24 * u, flagH = 17 * u, flagStep = 15 * u; // ~9px di sovrapposizione
    const title = tripsCount > 1 ? `${tripsCount} viaggi rivissuti` : trips[0].title;
    const flags = flagImgs.filter(im => im.complete && im.naturalWidth > 0);

    ctx.font = `700 ${15 * u}px "Space Grotesk", sans-serif`;
    const titleW = ctx.measureText(title).width;
    const flagsW = flags.length > 0 ? (flagW + (flags.length - 1) * flagStep + 8 * u) : 0;
    const headerW = flagsW + titleW;

    ctx.font = `400 ${11 * u}px sans-serif`;
    const datesW = dateRangeLabel ? ctx.measureText(dateRangeLabel).width : 0;

    const pills = [
      { v: formatKm(totalKmRef.current), l: "KM" },
      { v: String(legsRef.current.length), l: "TAPPE" },
    ];
    const pillWs = pills.map(p => {
      ctx.font = `700 ${15 * u}px "JetBrains Mono", monospace`;
      const nw = ctx.measureText(p.v).width;
      ctx.font = `700 ${9 * u}px sans-serif`;
      const lw = ctx.measureText(p.l).width;
      return Math.max(nw, lw) + 24 * u;
    });
    const pillsW = pillWs[0] + 8 * u + pillWs[1];

    const contentW = Math.max(headerW, datesW, pillsW);
    const cardW = contentW + innerPad * 2;
    const headerH = 22 * u, dateH = dateRangeLabel ? 16 * u : 0, gap = 8 * u, pillH = 42 * u;
    const cardH = innerPad * 2 + headerH + dateH + gap + pillH;
    const cardX = c.width - cardW - 16 * u;
    const cardY = 16 * u;

    ctx.fillStyle = "rgba(10,22,40,0.92)";
    roundRectPath(ctx, cardX, cardY, cardW, cardH, 14 * u);
    ctx.fill();
    ctx.lineWidth = Math.max(1, 0.5 * u); ctx.strokeStyle = "#1a2d4a"; ctx.stroke();

    // header: bandiere a ventaglio + titolo, centrati verticalmente
    const headerCy = cardY + innerPad + headerH / 2;
    const hx = cardX + innerPad;
    for (let i = 0; i < flags.length; i++) {
      ctx.save();
      ctx.translate(hx + flagW / 2 + i * flagStep, headerCy);
      ctx.rotate(((i - (flags.length - 1) / 2) * 7 * Math.PI) / 180);
      ctx.fillStyle = "#fff";
      roundRectPath(ctx, -flagW / 2 - 1.5 * u, -flagH / 2 - 1.5 * u, flagW + 3 * u, flagH + 3 * u, 3 * u);
      ctx.fill();
      ctx.save();
      roundRectPath(ctx, -flagW / 2, -flagH / 2, flagW, flagH, 2.5 * u);
      ctx.clip();
      drawImageCover(ctx, flags[i], -flagW / 2, -flagH / 2, flagW, flagH);
      ctx.restore();
      ctx.restore();
    }
    ctx.font = `700 ${15 * u}px "Space Grotesk", sans-serif`;
    ctx.fillStyle = "#f0f4ff";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(title, hx + flagsW, headerCy);

    // date
    let cursorY = cardY + innerPad + headerH;
    if (dateRangeLabel) {
      ctx.font = `400 ${11 * u}px sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.textBaseline = "top";
      ctx.fillText(dateRangeLabel, hx, cursorY);
      cursorY += dateH;
    }

    // pill km / tappe
    const pillY = cursorY + gap;
    let px = hx;
    for (let i = 0; i < pills.length; i++) {
      const pw = pillWs[i];
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      roundRectPath(ctx, px, pillY, pw, pillH, 10 * u);
      ctx.fill();
      ctx.lineWidth = Math.max(1, 0.5 * u); ctx.strokeStyle = "#1a2d4a"; ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = `700 ${15 * u}px "JetBrains Mono", monospace`;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(pills[i].v, px + pw / 2, pillY + 20 * u);
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = `700 ${9 * u}px sans-serif`;
      ctx.fillText(pills[i].l, px + pw / 2, pillY + 33 * u);
      px += pw + 8 * u;
    }
    ctx.textAlign = "left";

    return c;
  };

  /** Carica le bandiere dei paesi con crossOrigin (per non "sporcare" il canvas
   *  e permettere toBlob): se una non arriva CORS-clean viene semplicemente
   *  saltata, così il salvataggio non fallisce mai. */
  const loadFlagImages = (): Promise<HTMLImageElement[]> => Promise.all(
    flagCodes.map(code => new Promise<HTMLImageElement | null>(res => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      let done = false;
      const finish = (ok: boolean) => { if (done) return; done = true; res(ok ? img : null); };
      img.onload = () => finish(true);
      img.onerror = () => finish(false);
      setTimeout(() => finish(img.complete && img.naturalWidth > 0), 2500);
      img.src = `https://flagcdn.com/w80/${code}.png`;
    }))
  ).then(arr => arr.filter((x): x is HTMLImageElement => !!x));

  /** Cattura il poster come JPEG. Forza un render fresco della mappa appena prima
   *  di leggerne il canvas: senza il vecchio loop di registrazione che
   *  ridisegnava di continuo, a mappa ferma il buffer WebGL può essere
   *  vuoto/nero anche con preserveDrawingBuffer, e drawImage catturerebbe nero. */
  const captureSnapshotBlob = async (): Promise<Blob | null> => {
    try {
      const map = mapRef.current;
      const mapCanvas = containerRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
      if (!mapCanvas) return null;
      const flagImgs = await loadFlagImages();
      // Attendi un frame appena renderizzato prima di catturare.
      await new Promise<void>(res => {
        if (!map) { res(); return; }
        let done = false;
        const fin = () => { if (done) return; done = true; res(); };
        map.once("render", fin);
        map.triggerRepaint();
        setTimeout(fin, 400); // salvagente se "render" non scatta
      });
      const posterCanvas = composePoster(mapCanvas, flagImgs);
      return await new Promise(res => posterCanvas.toBlob(res, "image/jpeg", 0.9));
    } catch {
      return null;
    }
  };

  // "Salva": cattura la vista corrente (dopo eventuali zoom/spostamenti) come
  // rilievo del viaggio → foglio sul biglietto in "I miei viaggi". Poi chiude.
  const handleSaveRelief = async () => {
    if (savingRelief) return;
    setSavingRelief(true);
    const blob = await captureSnapshotBlob();
    if (blob && trips.length === 1) {
      try { await saveReliefImage(trips[0].id, blob); } catch { /* IndexedDB non disponibile: non bloccare la chiusura */ }
    }
    onClose();
  };

  // "Condividi": condivide l'immagine del poster (o la scarica se il browser non supporta la condivisione file).
  const handleSharePoster = async () => {
    const blob = await captureSnapshotBlob();
    if (!blob) return;
    const name = (tripsCount === 1 ? trips[0].title : "viaggio").replace(/[^\w.-]+/g, "_").slice(0, 40) || "viaggio";
    const file = new File([blob], `${name}-3d.jpg`, { type: "image/jpeg" });
    if (canShareFile(file)) {
      try { await navigator.share({ files: [file], title: tripsCount > 1 ? "Il mio viaggio in 3D" : trips[0].title }); } catch { /* annullato */ }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    // `cancelled` locale (non un ref condiviso): in StrictMode ogni effetto è
    // montato/smontato/rimontato una volta; con un ref condiviso l'init async
    // del primo montaggio creerebbe comunque una seconda mappa orfana. Vedi
    // storia in git (fix leak WebGL).
    let cancelled = false;

    const stops = buildFlightPath(trips);
    const legsLocal = buildFlightLegs(stops);
    legsRef.current = legsLocal;
    // Km percorsi: stessa fonte UNICA di Home/Statistiche/card (tripTotalKm =
    // stradali reali dove c'è route_geometry, linea d'aria altrimenti).
    totalKmRef.current = trips.reduce((sum, t) => sum + tripTotalKm(t), 0);
    allCoordsRef.current = buildFlyoverRouteCoords(stops, legsLocal);
    finalePhotoKeysRef.current = Array.from(new Set(stops.map(s => s.photoKey)));

    if (legsLocal.length === 0) {
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
          // Necessario per lo snapshot del poster (drawImage/toBlob dal canvas
          // WebGL a mappa ferma): senza, il buffer si svuota → immagine nera.
          preserveDrawingBuffer: true,
        });
        if (cancelled) { map.remove(); return; }
        mapRef.current = map;

        map.on("load", async () => {
          if (cancelled || !mountedRef.current) return;

          map.addSource("flyover-route", {
            type: "geojson",
            data: { type: "Feature", geometry: { type: "LineString", coordinates: allCoordsRef.current } },
          });
          // Contorno scuro (casing) SOTTO la linea: fa staccare il tracciato dal satellite.
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
          // Tappe come puntine da mappa (symbol layer) + nome città sopra, con alone.
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

          setPhase("ready");
          setTimeout(() => { map.resize(); }, 100);

          // Nessuna animazione di volo: carica le foto e inquadra subito il
          // poster sull'intero percorso, poi mostra gli overlay.
          await collectFinalePhotos();
          if (cancelled || !mountedRef.current) return;
          await flyToOverview(map);
          if (cancelled || !mountedRef.current) return;
          setPoster(true);
        });
      } catch {
        if (!cancelled && mountedRef.current) setPhase("error");
      }
    };

    init();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      finaleUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
      finaleUrlsRef.current = [];
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Portal su document.body: senza, il modale (position:fixed) verrebbe confinato
  // al primo antenato con `transform` (es. il wrapper .animate-fade-up della card
  // in MieiViaggi) e clippato dentro la card invece che sul viewport.
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "relative", width: "100%", height: "100%", maxWidth: 880, maxHeight: 600,
          background: "#060e1e", border: "0.5px solid #1a2d4a", borderRadius: 16,
          overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          animation: "flyoverModalIn 0.28s cubic-bezier(0.22,1,0.36,1) both",
        }}>
        <div style={{ position: "absolute", inset: 0 }} ref={containerRef} />

        {/* Chiudi in alto a sinistra (la card dati sta in alto a destra). */}
        <button onClick={onClose} aria-label="Chiudi"
          style={{
            position: "absolute", top: 16, left: 16, width: 34, height: 34, borderRadius: 10, zIndex: 30,
            background: "rgba(10,22,40,0.8)", border: "0.5px solid #1a2d4a", cursor: "pointer",
            color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          <X className="w-4 h-4" />
        </button>

        {phase === "loading" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)", fontSize: 13, gap: 8 }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Caricamento della mappa…
          </div>
        )}

        {phase === "error" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            Impossibile caricare la mappa.
          </div>
        )}

        {phase === "empty" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", padding: 24 }}>
            Questo viaggio non ha punti sufficienti per la mappa 3D (manca la posizione di casa o della destinazione).
          </div>
        )}

        {poster && (
          <>
            {/* Dati viaggio, in alto a destra, con bandiere dei paesi a ventaglio. */}
            <div style={{
              position: "absolute", top: 16, right: 16, zIndex: 25, maxWidth: "70%",
              background: "rgba(10,22,40,0.92)", border: "0.5px solid #1a2d4a", borderRadius: 14,
              padding: "12px 14px", boxShadow: "0 8px 24px rgba(0,0,0,0.45)", backdropFilter: "blur(2px)",
              animation: "flyoverCardIn 0.35s cubic-bezier(0.22,1,0.36,1) both",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {flagCodes.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                    {flagCodes.map((c, i) => (
                      <img key={c + i} src={"https://flagcdn.com/w40/" + c + ".png"} alt="" width="24" height="17"
                        style={{
                          borderRadius: 3, objectFit: "cover",
                          border: "1.5px solid rgba(255,255,255,0.9)", boxShadow: "0 1px 4px rgba(0,0,0,0.45)",
                          marginLeft: i === 0 ? 0 : -9,
                          transform: `rotate(${(i - (flagCodes.length - 1) / 2) * 7}deg)`,
                          transformOrigin: "bottom center", position: "relative", zIndex: i,
                        }}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ))}
                  </div>
                )}
                <div className="font-display" style={{ fontSize: 15, fontWeight: 700, color: "#f0f4ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {tripsCount > 1 ? `${tripsCount} viaggi rivissuti` : trips[0].title}
                </div>
              </div>
              {dateRangeLabel && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>{dateRangeLabel}</div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {[{ v: formatKm(totalKmRef.current), l: "km" }, { v: String(legs.length), l: "tappe" }].map(s => (
                  <div key={s.l} style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid #1a2d4a", borderRadius: 10, padding: "5px 12px", textAlign: "center" }}>
                    <div className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>{s.v}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 2 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ventaglio foto in basso a sinistra. */}
            {finalePhotos.length > 0 && (() => {
              const n = finalePhotos.length;
              const fanW = FINALE_CARD_W + (n - 1) * FINALE_FAN_STEP;
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

            {/* Azioni: Salva (solo single-trip, → biglietto) + Condividi (immagine). */}
            <div style={{ position: "absolute", right: 16, bottom: 20, zIndex: 26, display: "flex", gap: 10 }}>
              {tripsCount === 1 && (
                <button onClick={handleSaveRelief} disabled={savingRelief}
                  style={{
                    padding: "8px 16px", borderRadius: 999, background: "rgba(96,165,250,0.15)",
                    border: "1px solid #60a5fa", color: "#60a5fa", fontSize: 12, fontWeight: 600,
                    cursor: savingRelief ? "default" : "pointer",
                  }}>
                  {savingRelief ? "Salvo…" : "Salva"}
                </button>
              )}
              <button onClick={handleSharePoster}
                style={{
                  display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  padding: "8px 16px", borderRadius: 999,
                  background: tripsCount === 1 ? "rgba(10,22,40,0.85)" : "rgba(96,165,250,0.15)",
                  border: tripsCount === 1 ? "0.5px solid #1a2d4a" : "1px solid #60a5fa",
                  color: tripsCount === 1 ? "rgba(255,255,255,0.8)" : "#60a5fa",
                }}>
                <Share2 className="w-3.5 h-3.5" /> Condividi
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
