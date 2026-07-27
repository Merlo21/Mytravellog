import { feature } from "topojson-client";

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

/** Un pannello del "quadro componibile": posizione/dimensione in FRAZIONI
 *  (0..1) del poster, più uno sfasamento verticale `dy` (frazione dell'altezza)
 *  che stacca il pezzo dagli altri (effetto quadro a più tele). */
export interface PanelSpec { x: number; y: number; w: number; h: number; dy: number }

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
  /** "Quadro componibile": spezza la mappa in pannelli sfalsati (con ombra) che
   *  insieme ricompongono il planisfero. Se presente, il poster è reso a
   *  pannelli (fondo trasparente, nessuna didascalia). */
  panels?: PanelSpec[];
  width?: number;
  height?: number;
}

const RAD = Math.PI / 180;
const mercX = (lon: number) => lon;
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / RAD;

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

/**
 * Scarica i confini dei paesi (world-atlas 110m) e ne estrae gli anelli
 * [lon,lat][] che intersecano il riquadro. Coarse ma leggero: sono contorni di
 * stato, un filo grossolani rispetto alle vector-tiles a schermo (accettato).
 */
export async function loadCountryRings(bounds: { lonMin: number; lonMax: number; latMin: number; latMax: number }): Promise<[number, number][][]> {
  const res = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
  const topo: any = await res.json();
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

/** Costruisce la stringa SVG completa del poster (puro). */
export function buildPosterSvg(input: PosterSvgInput): string {
  const W = input.width ?? 1600;
  const H = input.height ?? 1000;
  const pad = 120;
  const { routeCoords = [], routeSegments, stops, borders = [], title, dateLabel, stats, hideLabels = false, panels } = input;
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
  const mapGroup = confiniG + tracciatoG + stelleG + etichetteG;

  // "Quadro componibile": la mappa (proiettata su tutto W×H) viene spezzata in
  // pannelli sfalsati che insieme la ricompongono. Ogni pannello: ombra + tela
  // nera + ritaglio della mappa traslato di `dy` (così i pezzi si "staccano").
  if (panels && panels.length) {
    const shadows = panels.map(p => {
      const x = p.x * W, y = p.y * H + p.dy * H, w = p.w * W, h = p.h * H;
      return `<rect x="${n(x + 6)}" y="${n(y + 14)}" width="${n(w)}" height="${n(h)}" rx="4" fill="rgba(0,0,0,0.55)"/>`;
    }).join("");
    const tiles = panels.map(p => {
      const x = p.x * W, y = p.y * H + p.dy * H, w = p.w * W, h = p.h * H;
      return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="4" fill="#050505" stroke="#ffffff" stroke-opacity="0.10" stroke-width="1"/>`;
    }).join("");
    const clips = panels.map((p, i) => {
      const x = p.x * W, y = p.y * H + p.dy * H, w = p.w * W, h = p.h * H;
      return `<clipPath id="qp${i}"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"/></clipPath>`;
    }).join("");
    // La mappa è definita UNA volta (#qmap) e riusata via <use> in ogni
    // pannello (traslata di dy e ritagliata) → SVG leggero, niente duplicati.
    const maps = panels.map((p, i) => `<g clip-path="url(#qp${i})"><use href="#qmap" transform="translate(0,${n(p.dy * H)})"/></g>`).join("");
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
      `<defs>${starGlowDef}<g id="qmap">${mapGroup}</g>${clips}</defs>`,
      shadows,
      tiles,
      maps,
      `</svg>`,
    ].join("");
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    `<defs>${starGlowDef}</defs>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="#000000"/>`,
    confiniG,
    tracciatoG,
    stelleG,
    etichetteG,
    dividerEl,
    `<g id="titolo">${titleEls.join("")}</g>`,
    `</svg>`,
  ].join("");
}
