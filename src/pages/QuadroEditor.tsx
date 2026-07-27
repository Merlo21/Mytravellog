import { useEffect, useMemo, useRef, useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, ZoomIn, ZoomOut, Download, Hand, Move, RotateCcw, Loader2 } from "lucide-react";
import { loadTrips } from "@/lib/storage";
import { buildFlightPath } from "@/lib/flyover";
import {
  EditorPanel, projectInPanel, panelGeoBounds, pickPanelIndex, panelBorderPath,
  buildEditorQuadroSvg, loadCountryRings, mercY, latFromMercY,
} from "@/lib/posterSvg";

/**
 * EDITOR DEL "QUADRO" (mini-Illustrator dentro l'app).
 *
 * Si parte dalla mappa-mondo continua di TUTTI i viaggi e la si RITAGLIA a mano
 * in più pannelli-tela: ognuno inquadra la sua porzione di mondo con zoom
 * indipendente (così l'Europa, piccola ma piena di stati, la ingrandisci quanto
 * vuoi). Le linee dei viaggi sono disegnate SOPRA, collegando le città da una
 * tela all'altra: restano sempre continue e perfette, qualunque sia la scala
 * dei singoli pannelli (i confini tra tele a scale diverse invece non
 * combaciano — compromesso voluto: "le linee devono essere perfette").
 *
 * Operazioni (mouse o dito):
 *  - Disponi: trascini il pannello per spostarlo, angoli per ridimensionare la
 *    tela (ritaglio: la mappa resta ferma, la cornice rivela di più o di meno);
 *  - Inquadra: trascini per fare pan del contenuto dentro la tela;
 *  - rotellina / +− : zoom del contenuto della tela selezionata;
 *  - + aggiunge una tela, cestino la elimina, ↺ ripristina il layout iniziale.
 *
 * Il render interattivo e l'export SVG usano la STESSA proiezione
 * (posterSvg.ts) così ciò che vedi è ciò che esporti.
 */

const VBW = 1600;
const VBH = 980;
const MIN_SIZE = 120;      // lato minimo di una tela (px canvas)
const HANDLE = 26;         // lato delle maniglie d'angolo (px canvas)
const SCALE_MIN = 0.25;
const SCALE_MAX = 600;
const STORAGE_KEY = "atlas.quadro.layout.v1";

type Mode = "arrange" | "frame";
type Corner = "nw" | "ne" | "sw" | "se";
type Geo = { lonMin: number; lonMax: number; latMin: number; latMax: number };

/** Inquadra un riquadro geografico dentro un rettangolo-tela (fit, centrato). */
function fitPanel(id: string, x: number, y: number, w: number, h: number, geo: Geo, padPx = 22): EditorPanel {
  const x0 = geo.lonMin, x1 = geo.lonMax;
  const y0 = mercY(geo.latMin), y1 = mercY(geo.latMax);
  const spanX = Math.max(1e-6, x1 - x0), spanY = Math.max(1e-6, y1 - y0);
  const scale = Math.max(SCALE_MIN, Math.min((w - 2 * padPx) / spanX, (h - 2 * padPx) / spanY));
  const centerLon = (x0 + x1) / 2, centerMercY = (y0 + y1) / 2;
  const refLon = centerLon - (w / 2) / scale;
  const refLat = latFromMercY(centerMercY + (h / 2) / scale);
  return { id, x, y, w, h, refLon, refLat, scale };
}

/** Riquadro geografico che racchiude tutte le tappe, con un margine. */
function tripsGeoBounds(stops: { lon: number; lat: number }[]): Geo {
  if (!stops.length) return { lonMin: -170, lonMax: 170, latMin: -55, latMax: 78 };
  let lonMin = Infinity, lonMax = -Infinity, latMin = Infinity, latMax = -Infinity;
  for (const s of stops) {
    lonMin = Math.min(lonMin, s.lon); lonMax = Math.max(lonMax, s.lon);
    latMin = Math.min(latMin, s.lat); latMax = Math.max(latMax, s.lat);
  }
  const mLon = Math.max(4, (lonMax - lonMin) * 0.12);
  const mLat = Math.max(4, (latMax - latMin) * 0.12);
  return {
    lonMin: lonMin - mLon, lonMax: lonMax + mLon,
    latMin: Math.max(-84, latMin - mLat), latMax: Math.min(84, latMax + mLat),
  };
}

function isPanel(v: unknown): v is EditorPanel {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return ["x", "y", "w", "h", "refLon", "refLat", "scale"].every(k => typeof p[k] === "number" && Number.isFinite(p[k] as number))
    && typeof p.id === "string";
}

/** Una tela renderizzata (ombra + fondo + confini ritagliati). Il path dei
 *  confini è in coordinate LOCALI (origine = angolo della tela) e la tela è
 *  traslata con `transform`: così SPOSTARE il pannello non ricostruisce la
 *  stringa del path (fino a ~90k comandi per una tela-mondo) a ogni frame —
 *  si ricalcola solo per pan/zoom/resize, dove la geometria cambia davvero. */
const PanelTile = memo(function PanelTile({ p, borders }: { p: EditorPanel; borders: [number, number][][] }) {
  const d = useMemo(
    () => panelBorderPath({ ...p, x: 0, y: 0 }, borders),
    // deliberatamente SENZA p.x/p.y: il path locale non dipende dalla posizione
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.refLon, p.refLat, p.scale, p.w, p.h, borders],
  );
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      <rect x={6} y={12} width={p.w} height={p.h} rx={6} fill="rgba(0,0,0,0.55)" />
      <clipPath id={`clip-${p.id}`}><rect x={0} y={0} width={p.w} height={p.h} rx={6} /></clipPath>
      <rect x={0} y={0} width={p.w} height={p.h} rx={6} fill="#050505" stroke="#ffffff" strokeOpacity={0.12} strokeWidth={1} />
      <g clipPath={`url(#clip-${p.id})`} fill="none" stroke="#ffffff" strokeOpacity={0.38} strokeWidth={0.6} strokeLinejoin="round">
        <path d={d} />
      </g>
    </g>
  );
});

export default function QuadroEditor() {
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);
  const idRef = useRef(1);
  const nextId = () => `p${idRef.current++}`;

  const trips = useMemo(() => loadTrips(), []);
  const { links, stops } = useMemo(() => {
    const links = trips
      .map(t => buildFlightPath([t]).map(s => [s.lon, s.lat] as [number, number]))
      .filter(seg => seg.length > 0);
    // Città DEDUPLICATE per coordinata: buildFlightPath ripete la casa per ogni
    // viaggio → senza dedup l'hub avrebbe N aloni sovrapposti (glow sparato) e
    // N punti-LED coincidenti nel master di stampa.
    const seen = new Set<string>();
    const stops: { lon: number; lat: number }[] = [];
    for (const s of buildFlightPath(trips)) {
      const k = `${s.lon.toFixed(5)},${s.lat.toFixed(5)}`;
      if (!seen.has(k)) { seen.add(k); stops.push({ lon: s.lon, lat: s.lat }); }
    }
    return { links, stops };
  }, [trips]);

  const [borders, setBorders] = useState<[number, number][][] | null>(null);
  const [panels, setPanels] = useState<EditorPanel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("arrange");

  // Confini del mondo intero (50m): servono ben dettagliati perché ogni tela
  // inquadra la sua porzione a sé.
  useEffect(() => {
    let cancelled = false;
    loadCountryRings({ lonMin: -180, lonMax: 180, latMin: -60, latMax: 85 }, "50m")
      .then(r => { if (!cancelled) setBorders(r); })
      .catch(() => { if (!cancelled) setBorders([]); });
    return () => { cancelled = true; };
  }, []);

  // Layout iniziale: quello salvato (se valido) oppure UNA tela con l'intera
  // costellazione dei viaggi — da lì l'utente ritaglia/aggiunge pannelli.
  useEffect(() => {
    let restored: EditorPanel[] | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length && parsed.every(isPanel)) restored = parsed;
      }
    } catch { /* layout salvato illeggibile: si riparte dal default */ }
    if (restored) {
      // idRef DEVE ripartire oltre il massimo id esistente (non da length+1: dopo
      // cancellazioni gli id non sono contigui e si genererebbero chiavi duplicate).
      const maxId = restored.reduce((m, p) => {
        const n = /^p(\d+)$/.exec(p.id);
        return n ? Math.max(m, parseInt(n[1], 10)) : m;
      }, 0);
      idRef.current = maxId + 1;
      setPanels(restored);
    } else {
      setPanels([fitPanel(nextId(), 70, 70, VBW - 140, VBH - 140, tripsGeoBounds(stops))]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistenza del layout (così sopravvive alla navigazione).
  useEffect(() => {
    if (!panels.length) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(panels)); } catch { /* quota piena: pazienza */ }
  }, [panels]);

  const selected = panels.find(p => p.id === selectedId) ?? null;

  // Linee dei viaggi + nodi-stella (overlay sopra le tele). Ricalcolo economico
  // (poche città) rispetto ai confini.
  const overlay = useMemo(() => {
    const screen = (lon: number, lat: number): [number, number] | null => {
      if (!panels.length) return null;
      const i = pickPanelIndex(panels, lon, lat);
      return i >= 0 ? projectInPanel(panels[i], lon, lat) : null;
    };
    const lines = links
      .map(seg => seg.map(([lo, la]) => screen(lo, la)).filter((pt): pt is [number, number] => !!pt))
      .filter(pts => pts.length >= 2)
      .map(pts => "M" + pts.map(pt => `${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join("L"));
    const stars = stops.map(s => screen(s.lon, s.lat)).filter((pt): pt is [number, number] => !!pt);
    return { lines, stars };
  }, [panels, links, stops]);

  // ---- coordinate canvas da un evento puntatore (gestisce scala + letterbox)
  const toCanvas = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const loc = pt.matrixTransform(ctm.inverse());
    return { x: loc.x, y: loc.y };
  };

  const inRect = (p: EditorPanel, x: number, y: number) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;

  const hitHandle = (p: EditorPanel, x: number, y: number): Corner | null => {
    const near = (cx: number, cy: number) => Math.abs(x - cx) <= HANDLE && Math.abs(y - cy) <= HANDLE;
    if (near(p.x, p.y)) return "nw";
    if (near(p.x + p.w, p.y)) return "ne";
    if (near(p.x, p.y + p.h)) return "sw";
    if (near(p.x + p.w, p.y + p.h)) return "se";
    return null;
  };

  const updatePanel = (id: string, patch: Partial<EditorPanel>) =>
    setPanels(ps => ps.map(p => (p.id === id ? { ...p, ...patch } : p)));

  // ---- zoom del contenuto di una tela attorno a un punto-canvas (px)
  const zoomPanelAt = (p: EditorPanel, cx: number, cy: number, factor: number) => {
    const newScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, p.scale * factor));
    if (newScale === p.scale) return;
    const geoLon = p.refLon + (cx - p.x) / p.scale;
    const geoMercY = mercY(p.refLat) - (cy - p.y) / p.scale;
    const refLon = geoLon - (cx - p.x) / newScale;
    const refLat = latFromMercY(geoMercY + (cy - p.y) / newScale);
    updatePanel(p.id, { scale: newScale, refLon, refLat });
  };

  // ---- interazione drag (move / resize / pan) + PIZZICO a due dita
  const dragRef = useRef<
    | null
    | { kind: "move" | "pan"; id: string; start: { x: number; y: number }; p0: EditorPanel }
    | { kind: "resize"; id: string; corner: Corner; p0: EditorPanel }
  >(null);
  // Dita attive sul canvas (coordinate-canvas correnti per pointerId).
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  // Pizzico in corso: pannello bersaglio + stato iniziale (p0, distanza tra le
  // dita, punto geografico sotto il centro del pizzico). Ogni move ricalcola
  // scala e ref DALLO STATO INIZIALE (niente errori cumulativi) tenendo il
  // punto-ancora sotto il centro delle dita: zoom e pan insieme, come su mappa.
  const pinchRef = useRef<
    | null
    | { id: string; p0: EditorPanel; dist0: number; anchorLon: number; anchorMercY: number }
  >(null);

  const pinchDist = () => {
    const pts = [...pointersRef.current.values()];
    return Math.max(20, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
  };
  const pinchMid = () => {
    const pts = [...pointersRef.current.values()];
    return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const c = toCanvas(e.clientX, e.clientY);
    if (!c) return;
    pointersRef.current.set(e.pointerId, c);
    try { svgRef.current?.setPointerCapture(e.pointerId); } catch { /* puntatore sintetico nei test */ }

    // Secondo dito → si passa al pizzico (zoom contenuto); il drag in corso si chiude.
    if (pointersRef.current.size === 2) {
      const mid = pinchMid();
      const target = dragRef.current
        ? panels.find(p => p.id === dragRef.current!.id) ?? null
        : [...panels].reverse().find(p => inRect(p, mid.x, mid.y)) ?? null;
      dragRef.current = null;
      if (target) {
        setSelectedId(target.id);
        pinchRef.current = {
          id: target.id, p0: target, dist0: pinchDist(),
          anchorLon: target.refLon + (mid.x - target.x) / target.scale,
          anchorMercY: mercY(target.refLat) - (mid.y - target.y) / target.scale,
        };
      }
      return;
    }
    if (pointersRef.current.size > 2) return; // terzo dito: ignorato

    // 1) maniglia d'angolo della tela selezionata → ridimensiona
    if (selected) {
      const corner = hitHandle(selected, c.x, c.y);
      if (corner) {
        dragRef.current = { kind: "resize", id: selected.id, corner, p0: selected };
        return;
      }
    }
    // 2) tela più in alto che contiene il punto → seleziona + move/pan
    for (let i = panels.length - 1; i >= 0; i--) {
      const p = panels[i];
      if (inRect(p, c.x, c.y)) {
        setSelectedId(p.id);
        dragRef.current = { kind: mode === "frame" ? "pan" : "move", id: p.id, start: c, p0: p };
        return;
      }
    }
    // 3) vuoto → deseleziona
    setSelectedId(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const c = toCanvas(e.clientX, e.clientY);
    if (!c) return;
    if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, c);

    const pinch = pinchRef.current;
    if (pinch) {
      if (pointersRef.current.size < 2) return;
      const mid = pinchMid();
      const { p0 } = pinch;
      const newScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, p0.scale * (pinchDist() / pinch.dist0)));
      const refLon = pinch.anchorLon - (mid.x - p0.x) / newScale;
      const refLat = latFromMercY(pinch.anchorMercY + (mid.y - p0.y) / newScale);
      updatePanel(pinch.id, { scale: newScale, refLon, refLat });
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const { p0 } = drag;

    if (drag.kind === "move") {
      const nx = Math.max(0, Math.min(VBW - p0.w, p0.x + (c.x - drag.start.x)));
      const ny = Math.max(0, Math.min(VBH - p0.h, p0.y + (c.y - drag.start.y)));
      updatePanel(drag.id, { x: nx, y: ny });
      return;
    }
    if (drag.kind === "pan") {
      const dx = c.x - drag.start.x, dy = c.y - drag.start.y;
      const refLon = p0.refLon - dx / p0.scale;
      const refLat = latFromMercY(mercY(p0.refLat) + dy / p0.scale);
      updatePanel(drag.id, { refLon, refLat });
      return;
    }
    // resize: nuovo rettangolo dal corner trascinato (l'angolo opposto resta
    // fermo); la mappa resta ANCORATA (ref si adegua allo spostamento di x/y).
    const right = p0.x + p0.w, bottom = p0.y + p0.h;
    let nx = p0.x, ny = p0.y, nw = p0.w, nh = p0.h;
    const corner = drag.corner;
    if (corner === "se") {
      nw = Math.max(MIN_SIZE, Math.min(VBW - p0.x, c.x - p0.x));
      nh = Math.max(MIN_SIZE, Math.min(VBH - p0.y, c.y - p0.y));
    } else if (corner === "ne") {
      ny = Math.max(0, Math.min(bottom - MIN_SIZE, c.y));
      nh = bottom - ny;
      nw = Math.max(MIN_SIZE, Math.min(VBW - p0.x, c.x - p0.x));
    } else if (corner === "sw") {
      nx = Math.max(0, Math.min(right - MIN_SIZE, c.x));
      nw = right - nx;
      nh = Math.max(MIN_SIZE, Math.min(VBH - p0.y, c.y - p0.y));
    } else { // nw
      nx = Math.max(0, Math.min(right - MIN_SIZE, c.x));
      ny = Math.max(0, Math.min(bottom - MIN_SIZE, c.y));
      nw = right - nx;
      nh = bottom - ny;
    }
    const refLon = p0.refLon + (nx - p0.x) / p0.scale;
    const refLat = latFromMercY(mercY(p0.refLat) - (ny - p0.y) / p0.scale);
    updatePanel(drag.id, { x: nx, y: ny, w: nw, h: nh, refLon, refLat });
  };

  const endDrag = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    // Il pizzico finisce quando resta meno di due dita; il dito rimasto NON
    // riprende un drag (deve risollevarsi): meno sorprese a fine gesto.
    if (pinchRef.current && pointersRef.current.size < 2) pinchRef.current = null;
    dragRef.current = null;
    try { svgRef.current?.releasePointerCapture(e.pointerId); } catch { /* già rilasciato */ }
  };

  const onWheel = (e: React.WheelEvent) => {
    const c = toCanvas(e.clientX, e.clientY);
    if (!c) return;
    for (let i = panels.length - 1; i >= 0; i--) {
      const p = panels[i];
      if (inRect(p, c.x, c.y)) {
        zoomPanelAt(p, c.x, c.y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
        return;
      }
    }
  };

  // ---- comandi toolbar
  const zoomSelected = (factor: number) => {
    const p = selected ?? panels[panels.length - 1];
    if (!p) return;
    if (!selected) setSelectedId(p.id);
    zoomPanelAt(p, p.x + p.w / 2, p.y + p.h / 2, factor);
  };

  const addPanel = () => {
    const geo = selected ? panelGeoBounds(selected) : tripsGeoBounds(stops);
    const id = nextId();
    // nuova tela media, un po' sfalsata così non copre esattamente le altre
    const off = (panels.length % 4) * 26;
    setPanels(ps => [...ps, fitPanel(id, 120 + off, 120 + off, 480, 380, geo)]);
    setSelectedId(id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setPanels(ps => ps.filter(p => p.id !== selectedId));
    setSelectedId(null);
  };

  const resetLayout = () => {
    const id = nextId();
    setPanels([fitPanel(id, 70, 70, VBW - 140, VBH - 140, tripsGeoBounds(stops))]);
    setSelectedId(id);
  };

  // Sincrono e istantaneo (i confini sono già in memoria): niente stato
  // "esporto…", sarebbe uno spinner che non si vede mai.
  const exportSvg = () => {
    if (!borders) return;
    try {
      const svg = buildEditorQuadroSvg({ panels, borders, links, stops, width: VBW, height: VBH });
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "mappa-della-vita-quadro.svg"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch { /* export fallito: non bloccare */ }
  };

  const btn = (extra?: React.CSSProperties): React.CSSProperties => ({
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    height: 40, padding: "0 12px", borderRadius: 10, cursor: "pointer",
    background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.18)",
    color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600, flexShrink: 0,
    ...extra,
  });

  return (
    <main style={{ position: "fixed", inset: 0, background: "#060e1e", display: "flex", flexDirection: "column", color: "#f0f4ff" }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", flexWrap: "wrap",
        borderBottom: "0.5px solid rgba(255,255,255,0.1)", background: "rgba(6,14,30,0.9)",
      }}>
        <button type="button" onClick={() => navigate("/miei-viaggi")} style={btn()} aria-label="Torna a I miei viaggi">
          <ArrowLeft style={{ width: 16, height: 16 }} />
        </button>
        <div style={{ fontWeight: 700, fontSize: 14, marginRight: 4 }}>Editor quadro</div>

        <button type="button" onClick={() => setMode(m => (m === "arrange" ? "frame" : "arrange"))}
          style={btn(mode === "frame" ? { background: "rgba(96,165,250,0.16)", borderColor: "#60a5fa", color: "#60a5fa" } : undefined)}
          title={mode === "frame" ? "Modalità: Inquadra (trascina = pan del contenuto)" : "Modalità: Disponi (trascina = sposta la tela)"}>
          {mode === "frame" ? <Hand style={{ width: 15, height: 15 }} /> : <Move style={{ width: 15, height: 15 }} />}
          {mode === "frame" ? "Inquadra" : "Disponi"}
        </button>

        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.12)", margin: "0 2px" }} />

        <button type="button" onClick={addPanel} style={btn()} title="Aggiungi una tela"><Plus style={{ width: 15, height: 15 }} /> Tela</button>
        <button type="button" onClick={deleteSelected} disabled={!selectedId}
          style={btn(!selectedId ? { opacity: 0.4, cursor: "default" } : undefined)} title="Elimina la tela selezionata">
          <Trash2 style={{ width: 15, height: 15 }} />
        </button>
        <button type="button" onClick={() => zoomSelected(1 / 1.2)} style={btn()} title="Zoom indietro"><ZoomOut style={{ width: 15, height: 15 }} /></button>
        <button type="button" onClick={() => zoomSelected(1.2)} style={btn()} title="Zoom avanti"><ZoomIn style={{ width: 15, height: 15 }} /></button>
        <button type="button" onClick={resetLayout} style={btn()} title="Ripristina il layout iniziale"><RotateCcw style={{ width: 15, height: 15 }} /></button>

        <div style={{ flex: 1 }} />

        <button type="button" onClick={exportSvg} disabled={!borders}
          style={btn(borders
            ? { background: "rgba(96,165,250,0.16)", borderColor: "#60a5fa", color: "#60a5fa" }
            : { opacity: 0.5, cursor: "default" })}>
          <Download style={{ width: 15, height: 15 }} /> Esporta SVG
        </button>
      </div>

      {/* Suggerimento */}
      <div style={{ padding: "6px 14px", fontSize: 11.5, color: "rgba(255,255,255,0.45)", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
        {mode === "frame"
          ? "Trascina dentro una tela per inquadrare · rotellina, pizzico o ＋− per lo zoom · «Disponi» per spostare e ridimensionare"
          : "Trascina una tela per spostarla · angoli per ridimensionare · rotellina, pizzico o ＋− per lo zoom · «Inquadra» per il pan del contenuto"}
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflow: "hidden" }}>
        {trips.length === 0 ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 14, maxWidth: 360, lineHeight: 1.6 }}>
            <p>Qui ritagli la mappa dei tuoi viaggi in un quadro a più tele — ma non c'è ancora nessun viaggio da disegnare.</p>
            <button type="button" onClick={() => navigate("/nuovo-viaggio")}
              style={btn({ margin: "14px auto 0", background: "rgba(96,165,250,0.16)", borderColor: "#60a5fa", color: "#60a5fa" })}>
              <Plus style={{ width: 15, height: 15 }} /> Nuovo viaggio
            </button>
          </div>
        ) : borders === null ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" /> Carico la mappa del mondo…
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VBW} ${VBH}`}
            style={{ width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%", touchAction: "none", userSelect: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onWheel={onWheel}
          >
            <defs>
              <radialGradient id="cGlow">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.95} />
                <stop offset="40%" stopColor="#ffffff" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
              </radialGradient>
              <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation={4} />
              </filter>
            </defs>

            {/* Tele + confini */}
            {panels.map(p => <PanelTile key={p.id} p={p} borders={borders} />)}

            {/* Linee dei viaggi: bagliore + linea nitida (sempre continue) */}
            <g fill="none" stroke="#ffffff" strokeWidth={6} strokeOpacity={0.4} strokeLinecap="round" strokeLinejoin="round" filter="url(#lineGlow)">
              {overlay.lines.map((d, i) => <path key={i} d={d} />)}
            </g>
            <g fill="none" stroke="#ffffff" strokeWidth={2.2} strokeOpacity={0.95} strokeLinecap="round" strokeLinejoin="round">
              {overlay.lines.map((d, i) => <path key={i} d={d} />)}
            </g>

            {/* Nodi-stella */}
            <g>
              {overlay.stars.map((s, i) => (
                <g key={i}>
                  <circle cx={s[0]} cy={s[1]} r={20} fill="url(#cGlow)" />
                  <circle cx={s[0]} cy={s[1]} r={5.5} fill="#ffffff" />
                </g>
              ))}
            </g>

            {/* Selezione: contorno + maniglie d'angolo */}
            {selected && (
              <g>
                <rect x={selected.x} y={selected.y} width={selected.w} height={selected.h} rx={6}
                  fill="none" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="7 5" />
                {([["nw", selected.x, selected.y], ["ne", selected.x + selected.w, selected.y],
                   ["sw", selected.x, selected.y + selected.h], ["se", selected.x + selected.w, selected.y + selected.h]] as [Corner, number, number][])
                  .map(([c, hx, hy]) => (
                    <rect key={c} x={hx - HANDLE / 2} y={hy - HANDLE / 2} width={HANDLE} height={HANDLE} rx={4}
                      fill="#60a5fa" stroke="#0b1220" strokeWidth={1.5} />
                  ))}
              </g>
            )}
          </svg>
        )}
      </div>
    </main>
  );
}
