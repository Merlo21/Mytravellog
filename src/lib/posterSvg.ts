import { feature } from "topojson-client";
import { LOGO_DATA_URI } from "./brandLogo";

/**
 * Generatore del MASTER DI STAMPA in SVG per la vista "Costellazione":
 * vettoriale, a livelli separati (confini / tracciato / stelle / etichette /
 * titolo), fondo nero + tutto bianco. Pensato per stampa in resina + LED:
 * - il livello `stelle` (le tappe) marca i PUNTI-LED (attributo data-led),
 * - i livelli sono separati così il fornitore incide/illumina ciò che vuole.
 *
 * Le funzioni di costruzione sono PURE (coordinate → stringa) per essere
 * testabili; il fetch dei confini (world-atlas) è a parte e asincrono.
 */

export interface Stop { lon: number; lat: number; label: string }

export interface PosterSvgInput {
  /** Percorso completo [lon,lat] (tracciato stradale reale dove disponibile). */
  routeCoords?: [number, number][];
  /** Più percorsi separati (uno per viaggio) per la "Mappa della vita": ognuno
   *  diventa un `<path>` a sé, senza linee di collegamento tra loro. Se presente
   *  ha la precedenza su `routeCoords`. */
  routeSegments?: [number, number][][];
  /** Tappe (nodi-stella) con etichetta. */
  stops: Stop[];
  /** Anelli dei confini [lon,lat][] già selezionati per il riquadro (opzionale). */
  borders?: [number, number][][];
  title: string;
  dateLabel?: string | null;
  /** Es. "1315 km · 6 tappe". */
  stats?: string | null;
  /** Nasconde i nomi delle tappe (Mappa della vita: costellazione pulita). */
  hideLabels?: boolean;
  width?: number;
  height?: number;
}

const RAD = Math.PI / 180;
const mercX = (lon: number) => lon;
export const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / RAD;
/** Inverso di mercY: latitudine (gradi) da una coordinata mercatore Y. */
export const latFromMercY = (y: number) => (2 * Math.atan(Math.exp(y * RAD)) - Math.PI / 2) / RAD;

/** Riquadro geografico (lon/lat) del percorso, con un margine in gradi. */
export function routeBounds(pts: [number, number][], marginDeg = 1.5) {
  let lonMin = Infinity, lonMax = -Infinity, latMin = Infinity, latMax = -Infinity;
  for (const [lon, lat] of pts) {
    lonMin = Math.min(lonMin, lon); lonMax = Math.max(lonMax, lon);
    latMin = Math.min(latMin, lat); latMax = Math.max(latMax, lat);
  }
  return { lonMin: lonMin - marginDeg, lonMax: lonMax + marginDeg, latMin: latMin - marginDeg, latMax: latMax + marginDeg };
}

function bboxIntersects(ring: [number, number][], b: { lonMin: number; lonMax: number; latMin: number; latMax: number }): boolean {
  let lonMin = Infinity, lonMax = -Infinity, latMin = Infinity, latMax = -Infinity;
  for (const [lon, lat] of ring) {
    lonMin = Math.min(lonMin, lon); lonMax = Math.max(lonMax, lon);
    latMin = Math.min(latMin, lat); latMax = Math.max(latMax, lat);
  }
  return !(lonMax < b.lonMin || lonMin > b.lonMax || latMax < b.latMin || latMin > b.latMax);
}

// Cache in memoria (per sessione) del topojson per risoluzione: il file 50m
// pesa ~1,4 MB e l'editor del quadro lo richiederebbe a ogni ingresso. Si
// cache la PROMISE così anche richieste concorrenti condividono un solo fetch;
// in caso di errore la voce viene rimossa (nessuna cache avvelenata).
const topoCache = new Map<string, Promise<any>>();

/**
 * Scarica i confini dei paesi (world-atlas) e ne estrae gli anelli [lon,lat][]
 * che intersecano il riquadro. `res` sceglie la risoluzione: 110m (leggero,
 * default) o 50m (più dettagliato, per il quadro a pannelli dove serve che gli
 * stati si vedano bene).
 */
export async function loadCountryRings(
  bounds: { lonMin: number; lonMax: number; latMin: number; latMax: number },
  resolution: "110m" | "50m" = "110m",
): Promise<[number, number][][]> {
  let topoP = topoCache.get(resolution);
  if (!topoP) {
    topoP = fetch(`https://cdn.jsdelivr.net/npm/world-atlas@2/countries-${resolution}.json`).then(r => r.json());
    topoCache.set(resolution, topoP);
    topoP.catch(() => { topoCache.delete(resolution); });
  }
  const topo: any = await topoP;
  const geo: any = feature(topo, topo.objects.countries);
  const rings: [number, number][][] = [];
  for (const f of geo.features) {
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const poly of polys) {
      for (const ring of poly) {
        if (bboxIntersects(ring as [number, number][], bounds)) rings.push(ring as [number, number][]);
      }
    }
  }
  return rings;
}

const escapeXml = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] as string));

/** Firma "By 🐻" in basso a destra, condivisa da TUTTI gli export SVG (poster
 *  del viaggio, mappa della vita, quadro). Il logo è incorporato come data-URI
 *  con `xlink:href` (compatibile con browser, Illustrator e stampanti); i root
 *  SVG che la usano dichiarano perciò anche xmlns:xlink. `bottomY` = Y del
 *  bordo inferiore della firma (per stare sopra la didascalia dove c'è). */
/** Luminanza relativa di un colore #RRGGBB (0 scuro … 1 chiaro). */
function isLightColor(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6;
}

/**
 * Firma "By 🐻". `opts.ink` = colore del testo (default bianco); `opts.invertLogo`
 * inverte il logo (bianco → scuro) via filtro SVG, per i fondi CHIARI dove la
 * versione bianca sparirebbe. Senza opts, resta la firma bianca originale.
 */
function brandSignatureSvg(W: number, bottomY: number, opts?: { ink?: string; invertLogo?: boolean }): string {
  const size = 42, pad = 26, gap = 10;
  const top = bottomY - size;
  const logoX = W - pad - size;
  const r = (v: number) => (Math.round(v * 10) / 10).toString();
  const ink = opts?.ink ?? "#ffffff";
  const invert = opts?.invertLogo ?? false;
  const filterDef = invert
    ? `<defs><filter id="brandInk"><feColorMatrix type="matrix" values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0"/></filter></defs>`
    : "";
  const imgFilter = invert ? ` filter="url(#brandInk)"` : "";
  return `<g id="firma" opacity="0.72">`
    + filterDef
    + `<text x="${r(logoX - gap)}" y="${r(top + size * 0.7)}" text-anchor="end" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="24" fill="${ink}">By</text>`
    + `<image x="${r(logoX)}" y="${r(top)}" width="${size}" height="${size}"${imgFilter} xlink:href="${LOGO_DATA_URI}"/>`
    + `</g>`;
}

/** Costruisce la stringa SVG completa del poster (puro). */
export function buildPosterSvg(input: PosterSvgInput): string {
  const W = input.width ?? 1600;
  const H = input.height ?? 1000;
  const pad = 120;
  const { routeCoords = [], routeSegments, stops, borders = [], title, dateLabel, stats, hideLabels = false } = input;
  // Uno o più tracciati: la Mappa della vita passa un percorso per viaggio; gli
  // altri poster un singolo percorso. Normalizzati qui in una lista di segmenti.
  const segments: [number, number][][] = routeSegments && routeSegments.length
    ? routeSegments
    : (routeCoords.length ? [routeCoords] : []);
  const routePts = segments.flat();

  // Fascia inferiore RISERVATA alla didascalia (titolo/date/stats): la mappa
  // disegna solo SOPRA, così le scritte non si sovrappongono mai al tracciato
  // (com'era col titolo in un angolo). Layout classico da poster/stampa.
  const hasCaption = !!(title || dateLabel || stats);
  const bandH = hasCaption ? (30 + 46 + (dateLabel ? 30 : 0) + (stats ? 34 : 0) + 28) : 0;
  const mapH = H - bandH;

  // Riquadro (in mercatore) sul solo percorso+tappe: il tracciato riempie
  // sempre l'area-mappa allo stesso modo; i confini che sforano vengono
  // ritagliati dal viewBox.
  const framePts: [number, number][] = [...routePts, ...stops.map(s => [s.lon, s.lat] as [number, number])];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [lon, lat] of framePts) {
    const x = mercX(lon), y = mercY(lat);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);
  const scale = Math.min((W - 2 * pad) / spanX, (mapH - 2 * pad) / spanY);
  const offX = (W - spanX * scale) / 2;
  const offY = (mapH - spanY * scale) / 2;
  const project = (lon: number, lat: number): [number, number] => {
    const x = (mercX(lon) - minX) * scale + offX;
    const y = mapH - ((mercY(lat) - minY) * scale + offY); // flip Y (nord in alto), dentro l'area-mappa
    return [x, y];
  };
  const n = (v: number) => (Math.round(v * 10) / 10).toString();

  const ringToPath = (ring: [number, number][]): string =>
    "M" + ring.map(([lon, lat]) => { const [x, y] = project(lon, lat); return `${n(x)},${n(y)}`; }).join("L") + "Z";

  const bordersPaths = borders
    .map(r => `<path d="${ringToPath(r)}"/>`)
    .join("");

  const routePaths = segments
    .filter(seg => seg.length > 1)
    .map(seg => "M" + seg.map(([lon, lat]) => { const [x, y] = project(lon, lat); return `${n(x)},${n(y)}`; }).join("L"));

  const starEls = stops.map(s => {
    const [x, y] = project(s.lon, s.lat);
    return `<circle cx="${n(x)}" cy="${n(y)}" r="16" fill="url(#starGlow)"/><circle data-led="1" cx="${n(x)}" cy="${n(y)}" r="5" fill="#ffffff"/>`;
  }).join("");

  const labelEls = hideLabels ? "" : stops.map(s => {
    const [x, y] = project(s.lon, s.lat);
    return `<text x="${n(x)}" y="${n(y - 14)}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="20" fill="#ffffff">${escapeXml(s.label)}</text>`;
  }).join("");

  // Didascalia centrata nella fascia inferiore riservata.
  const titleEls: string[] = [];
  const cx = W / 2;
  let ty = mapH + 30 + 36;
  if (title) titleEls.push(`<text x="${cx}" y="${n(ty)}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="bold" font-size="40" fill="#ffffff">${escapeXml(title)}</text>`);
  if (dateLabel) { ty += 30; titleEls.push(`<text x="${cx}" y="${n(ty)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="20" fill="#ffffff" opacity="0.7">${escapeXml(dateLabel)}</text>`); }
  if (stats) { ty += 34; titleEls.push(`<text x="${cx}" y="${n(ty)}" text-anchor="middle" font-family="Georgia, serif" font-size="24" fill="#ffffff" opacity="0.9">${escapeXml(stats)}</text>`); }
  // Sottile linea divisoria mappa / didascalia.
  const dividerEl = hasCaption ? `<line x1="${pad}" y1="${n(mapH)}" x2="${W - pad}" y2="${n(mapH)}" stroke="#ffffff" stroke-opacity="0.2" stroke-width="1"/>` : "";

  const starGlowDef = `<radialGradient id="starGlow"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="35%" stop-color="#ffffff" stop-opacity="0.35"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient>`;
  const confiniG = `<g id="confini" fill="none" stroke="#ffffff" stroke-opacity="0.32" stroke-width="1.1" stroke-linejoin="round">${bordersPaths}</g>`;
  const tracciatoG = routePaths.length ? `<g id="tracciato" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${routePaths.map(d => `<path d="${d}"/>`).join("")}</g>` : "";
  const stelleG = `<g id="stelle">${starEls}</g>`;
  const etichetteG = `<g id="etichette">${labelEls}</g>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    `<defs>${starGlowDef}</defs>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="#000000"/>`,
    confiniG,
    tracciatoG,
    stelleG,
    etichetteG,
    dividerEl,
    `<g id="titolo">${titleEls.join("")}</g>`,
    // Firma nell'angolo in basso a destra dell'AREA MAPPA (sopra la didascalia).
    brandSignatureSvg(W, mapH - 10),
    `</svg>`,
  ].join("");
}

/**
 * Un PANNELLO editabile del "quadro" (editor interattivo tipo Illustrator):
 * un riquadro-tela sul canvas (x,y,w,h in px) che inquadra una porzione di
 * mondo con zoom indipendente. La proiezione è ancorata al punto geografico
 * `(refLon, refLat)` che cade nell'ANGOLO IN ALTO A SINISTRA del riquadro, più
 * la `scale` (px per unità mercatore). Questo modello rende semplici e senza
 * scatti tutte le operazioni dell'editor:
 *  - spostare il pannello  → cambia solo x,y (la mappa segue la tela);
 *  - ritagliare (resize)    → cambia il riquadro tenendo la mappa ferma;
 *  - inquadrare (pan)       → sposta ref, riquadro fermo;
 *  - zoom attorno al cursore → cambia scale + ref per tenere fermo il punto.
 */
export interface EditorPanel {
  id: string;
  x: number; y: number; w: number; h: number;
  refLon: number; refLat: number;
  scale: number;
}

/** Proietta [lon,lat] nelle coordinate-canvas del pannello. */
export function projectInPanel(p: EditorPanel, lon: number, lat: number): [number, number] {
  return [
    p.x + (mercX(lon) - mercX(p.refLon)) * p.scale,
    p.y + (mercY(p.refLat) - mercY(lat)) * p.scale,
  ];
}

/** Riquadro geografico (lon/lat) inquadrato dal pannello. */
export function panelGeoBounds(p: EditorPanel): { lonMin: number; lonMax: number; latMin: number; latMax: number } {
  return {
    lonMin: p.refLon,
    lonMax: p.refLon + p.w / p.scale,
    latMax: p.refLat,
    latMin: latFromMercY(mercY(p.refLat) - p.h / p.scale),
  };
}

/**
 * A quale pannello "appartiene" una città (per disegnarci sopra il nodo e le
 * linee): fra i pannelli che la contengono si sceglie quello più ZOOMATO (area
 * geografica minore = inquadratura più specifica); se nessuno la contiene, il
 * più vicino per centro — così nessuna città/linea di viaggio sparisce mai.
 */
export function pickPanelIndex(panels: EditorPanel[], lon: number, lat: number): number {
  let best = -1, bestArea = Infinity;
  panels.forEach((p, i) => {
    const b = panelGeoBounds(p);
    if (lon >= b.lonMin && lon <= b.lonMax && lat >= b.latMin && lat <= b.latMax) {
      const area = (b.lonMax - b.lonMin) * (mercY(b.latMax) - mercY(b.latMin));
      if (area < bestArea) { bestArea = area; best = i; }
    }
  });
  if (best >= 0) return best;
  let nb = -1, nd = Infinity;
  panels.forEach((p, i) => {
    const b = panelGeoBounds(p);
    const cLon = (b.lonMin + b.lonMax) / 2, cMercY = (mercY(b.latMin) + mercY(b.latMax)) / 2;
    const dx = mercX(lon) - cLon, dy = mercY(lat) - cMercY;
    const d = dx * dx + dy * dy;
    if (d < nd) { nd = d; nb = i; }
  });
  return nb;
}

const round1 = (v: number) => (Math.round(v * 10) / 10).toString();

/** Path SVG (attributo d) dei confini che cadono nel pannello, già proiettati.
 *  Riusato sia dal render interattivo (React) sia dall'export, così sono identici. */
export function panelBorderPath(p: EditorPanel, borders: [number, number][][]): string {
  const b = panelGeoBounds(p);
  return borders
    .filter(ring => bboxIntersects(ring, b))
    .map(ring => "M" + ring.map(([lon, lat]) => { const [X, Y] = projectInPanel(p, lon, lat); return `${round1(X)},${round1(Y)}`; }).join("L"))
    .join("");
}

export interface EditorQuadroInput {
  panels: EditorPanel[];
  /** Anelli confini del mondo intero [lon,lat][] (idealmente 50m). */
  borders: [number, number][][];
  /** Una polilinea per viaggio (coordinate delle sole TAPPE), disegnate sopra. */
  links: [number, number][][];
  /** Città visitate (nodi-stella). */
  stops: { lon: number; lat: number }[];
  width: number;
  height: number;
  /**
   * Pagina di STAMPA opzionale: se data, il contenuto (arrangiato in
   * width×height) viene inquadrato e centrato dentro una pagina di questa
   * proporzione, con un fondo pieno (per un file autoconsistente da stampare).
   * Senza, resta il comportamento originale (viewBox = contenuto, fondo
   * trasparente). `bg` = colore del fondo pagina.
   */
  page?: { width: number; height: number; bg?: string };
  /**
   * Palette colore per la stampa: `bg` = fondo pagina/tele, `ink` = colore di
   * terre, confini, linee e stelle. Senza, resta bianco su near-black (Notte).
   * (Palette a fondo CHIARO non ancora supportate: la firma "By" bianca
   * sparirebbe — servirebbe un logo scuro.)
   */
  palette?: { bg: string; ink: string };
}

/**
 * Master SVG del "quadro componibile" costruito dall'EDITOR: i pannelli sono
 * scelti/inquadrati a mano dall'utente. Ogni pannello è una tela nera che
 * ritaglia la sua porzione di mondo (confini sottili grigi, sfondo); le linee
 * dei viaggi sono disegnate SOPRA collegando le città da una tela all'altra
 * (bagliore + linea nitida) — sempre continue, indipendenti dalle scale. Fondo
 * trasparente. Stessa gerarchia visiva del vecchio collage.
 */
export function buildEditorQuadroSvg(input: EditorQuadroInput): string {
  const { panels, borders, links, stops, width: W, height: H, page, palette } = input;
  const nn = round1;
  // Colori: `ink` = terre/confini/linee/stelle; `tileFill` = fondo delle tele.
  // Senza palette restano i valori originali (bianco su near-black), così
  // l'export legacy e i test non cambiano.
  const ink = palette?.ink ?? "#ffffff";
  const tileFill = palette?.bg ?? "#050505";

  const shadows = panels.map(p => `<rect x="${nn(p.x + 6)}" y="${nn(p.y + 12)}" width="${nn(p.w)}" height="${nn(p.h)}" rx="6" fill="rgba(0,0,0,0.55)"/>`).join("");
  const tiles = panels.map(p => `<rect x="${nn(p.x)}" y="${nn(p.y)}" width="${nn(p.w)}" height="${nn(p.h)}" rx="6" fill="${tileFill}" stroke="${ink}" stroke-opacity="0.12" stroke-width="1"/>`).join("");
  const clips = panels.map((p, i) => `<clipPath id="ep${i}"><rect x="${nn(p.x)}" y="${nn(p.y)}" width="${nn(p.w)}" height="${nn(p.h)}"/></clipPath>`).join("");
  // Resa "D — corpo + gerarchia" (scelta utente 2026-07-27): le terre hanno un
  // riempimento grigio tenue (evenodd per i buchi: laghi/enclave) così i
  // continenti hanno massa e l'oceano resta nero; i confini sono appena più
  // presenti del vecchio wireframe. Un SOLO path con fill+stroke insieme:
  // nessun raddoppio di peso dell'SVG.
  const maps = panels.map((p, i) =>
    `<g clip-path="url(#ep${i})"><path d="${panelBorderPath(p, borders)}" fill="${ink}" fill-opacity="0.055" fill-rule="evenodd" stroke="${ink}" stroke-opacity="0.5" stroke-width="0.75" stroke-linejoin="round"/></g>`
  ).join("");

  const screen = (lon: number, lat: number): [number, number] | null => {
    if (!panels.length) return null;
    const i = pickPanelIndex(panels, lon, lat);
    return i >= 0 ? projectInPanel(panels[i], lon, lat) : null;
  };
  const lineEls = links.map(seg => {
    const pts = seg.map(([lon, lat]) => screen(lon, lat)).filter((pt): pt is [number, number] => !!pt);
    return pts.length >= 2 ? `<path d="M${pts.map(pt => `${nn(pt[0])},${nn(pt[1])}`).join("L")}"/>` : "";
  }).join("");
  const starEls = stops.map(s => {
    const sc = screen(s.lon, s.lat);
    return sc ? `<circle cx="${nn(sc[0])}" cy="${nn(sc[1])}" r="20" fill="url(#cGlow)"/><circle data-led="1" cx="${nn(sc[0])}" cy="${nn(sc[1])}" r="5.5" fill="${ink}"/>` : "";
  }).join("");

  // Pagina di stampa: contenuto (W×H) inquadrato e centrato dentro la pagina
  // scelta, con fondo pieno. Senza `page`, viewBox = contenuto e nessun fondo
  // (comportamento originale). Il clipPath è userSpaceOnUse: le sue coordinate
  // vivono nello stesso spazio trasformato del contenuto, quindi il ritaglio
  // resta allineato anche con la scala della pagina.
  const outW = page?.width ?? W;
  const outH = page?.height ?? H;
  let open = "", close = "", bg = "";
  if (page) {
    const s = Math.min(outW / W, outH / H);
    const tx = (outW - W * s) / 2, ty = (outH - H * s) / 2;
    bg = `<rect x="0" y="0" width="${nn(outW)}" height="${nn(outH)}" fill="${palette?.bg ?? page.bg ?? "#05080f"}"/>`;
    open = `<g transform="translate(${nn(tx)} ${nn(ty)}) scale(${s.toFixed(4)})">`;
    close = `</g>`;
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${nn(outW)} ${nn(outH)}" width="${nn(outW)}" height="${nn(outH)}">`,
    `<defs><radialGradient id="cGlow"><stop offset="0%" stop-color="${ink}" stop-opacity="0.95"/><stop offset="40%" stop-color="${ink}" stop-opacity="0.3"/><stop offset="100%" stop-color="${ink}" stop-opacity="0"/></radialGradient>`,
    `<filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>`,
    `${clips}</defs>`,
    bg,
    open,
    `<g id="ombre">${shadows}</g>`,
    `<g id="tele">${tiles}</g>`,
    `<g id="regioni">${maps}</g>`,
    `<g id="tratte-glow" fill="none" stroke="${ink}" stroke-width="6" stroke-opacity="0.4" stroke-linecap="round" stroke-linejoin="round" filter="url(#lineGlow)">${lineEls}</g>`,
    `<g id="tratte" fill="none" stroke="${ink}" stroke-width="2.2" stroke-opacity="0.95" stroke-linecap="round" stroke-linejoin="round">${lineEls}</g>`,
    `<g id="stelle">${starEls}</g>`,
    close,
    // Su palette a fondo CHIARO la firma bianca sparirebbe: testo scuro + logo invertito.
    brandSignatureSvg(outW, outH - 10, palette && isLightColor(palette.bg) ? { ink: palette.ink, invertLogo: true } : undefined),
    `</svg>`,
  ].join("");
}
