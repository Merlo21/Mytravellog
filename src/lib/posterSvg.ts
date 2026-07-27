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
 * Scarica i confini dei paesi (world-atlas) e ne estrae gli anelli [lon,lat][]
 * che intersecano il riquadro. `res` sceglie la risoluzione: 110m (leggero,
 * default) o 50m (più dettagliato, per il quadro a pannelli dove serve che gli
 * stati si vedano bene).
 */
export async function loadCountryRings(
  bounds: { lonMin: number; lonMax: number; latMin: number; latMax: number },
  resolution: "110m" | "50m" = "110m",
): Promise<[number, number][][]> {
  const res = await fetch(`https://cdn.jsdelivr.net/npm/world-atlas@2/countries-${resolution}.json`);
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

/** Una regione del "quadro collage": riquadro-tela (px) + riquadro geografico
 *  (lon/lat) che quella tela inquadra, con sfasamento verticale `dy`. */
export interface CollageRegion {
  name: string;
  x: number; y: number; w: number; h: number;
  lonMin: number; latMin: number; lonMax: number; latMax: number;
  dy: number;
}

export interface CollageInput {
  /** Anelli confini del mondo intero [lon,lat][] (idealmente 50m). */
  borders: [number, number][][];
  /** Una polilinea per viaggio: coordinate ordinate delle sole TAPPE (non il
   *  tracciato stradale). Le linee sono disegnate SOPRA, collegando le tessere. */
  links: [number, number][][];
  /** Città visitate (nodi-stella). */
  stops: { lon: number; lat: number }[];
  regions: CollageRegion[];
  width?: number;
  height?: number;
}

/**
 * Master SVG del "quadro componibile" a REGIONI: ogni regione è una tela nera
 * sfalsata che inquadra (zoom indipendente) la sua porzione di mondo, così
 * anche l'Europa — piccola ma piena di stati — diventa grande e leggibile
 * (proporzioni "d'autore", NON in scala reale). Le linee dei viaggi sono
 * disegnate sopra, collegando le città da una tessera all'altra: la
 * costellazione non si perde. Fondo trasparente, bianco su nero.
 */
export function buildCollagePosterSvg(input: CollageInput): string {
  const W = input.width ?? 1600;
  const H = input.height ?? 980;
  const { borders, links, stops, regions } = input;
  const pad = 10;
  const nn = (v: number) => (Math.round(v * 10) / 10).toString();

  type Proj = (lon: number, lat: number) => [number, number];
  const built = regions.map(r => {
    const px = r.x, py = r.y + r.dy, pw = r.w, ph = r.h;
    const x0 = mercX(r.lonMin), x1 = mercX(r.lonMax);
    const y0 = mercY(r.latMin), y1 = mercY(r.latMax);
    const spanX = Math.max(1e-6, x1 - x0), spanY = Math.max(1e-6, y1 - y0);
    // scala uniforme (come fitExtent): la regione riempie la tela mantenendo le
    // proporzioni geografiche interne, centrata.
    const s = Math.min((pw - 2 * pad) / spanX, (ph - 2 * pad) / spanY);
    const offX = px + (pw - spanX * s) / 2;
    const offY = py + (ph - spanY * s) / 2;
    const proj: Proj = (lon, lat) => [offX + (mercX(lon) - x0) * s, offY + (y1 - mercY(lat)) * s];
    return { r, px, py, pw, ph, proj };
  });

  const shadows = built.map(b => `<rect x="${nn(b.px + 6)}" y="${nn(b.py + 12)}" width="${nn(b.pw)}" height="${nn(b.ph)}" rx="6" fill="rgba(0,0,0,0.55)"/>`).join("");
  const tiles = built.map(b => `<rect x="${nn(b.px)}" y="${nn(b.py)}" width="${nn(b.pw)}" height="${nn(b.ph)}" rx="6" fill="#050505" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1"/>`).join("");
  const clips = built.map((b, i) => `<clipPath id="rc${i}"><rect x="${nn(b.px)}" y="${nn(b.py)}" width="${nn(b.pw)}" height="${nn(b.ph)}"/></clipPath>`).join("");
  const maps = built.map((b, i) => {
    const bnd = { lonMin: b.r.lonMin, lonMax: b.r.lonMax, latMin: b.r.latMin, latMax: b.r.latMax };
    const d = borders.filter(ring => bboxIntersects(ring, bnd))
      .map(ring => "M" + ring.map(([lon, lat]) => { const [X, Y] = b.proj(lon, lat); return `${nn(X)},${nn(Y)}`; }).join("L"))
      .join("");
    return `<g clip-path="url(#rc${i})" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="0.9" stroke-linejoin="round"><path d="${d}"/></g>`;
  }).join("");

  // Posizione a schermo di una città = proiezione della PRIMA regione che la
  // contiene (ordine dei regions = priorità). Usata per linee e stelle sopra.
  const screen = (lon: number, lat: number): [number, number] | null => {
    for (const b of built) {
      if (lon >= b.r.lonMin && lon <= b.r.lonMax && lat >= b.r.latMin && lat <= b.r.latMax) return b.proj(lon, lat);
    }
    return null;
  };
  const lineEls = links.map(seg => {
    const pts = seg.map(([lon, lat]) => screen(lon, lat)).filter((p): p is [number, number] => !!p);
    return pts.length >= 2 ? `<path d="M${pts.map(p => `${nn(p[0])},${nn(p[1])}`).join("L")}"/>` : "";
  }).join("");
  const starEls = stops.map(s => {
    const sc = screen(s.lon, s.lat);
    return sc ? `<circle cx="${nn(sc[0])}" cy="${nn(sc[1])}" r="14" fill="url(#cGlow)"/><circle data-led="1" cx="${nn(sc[0])}" cy="${nn(sc[1])}" r="5" fill="#ffffff"/>` : "";
  }).join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    `<defs><radialGradient id="cGlow"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="40%" stop-color="#ffffff" stop-opacity="0.3"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient>${clips}</defs>`,
    `<g id="ombre">${shadows}</g>`,
    `<g id="tele">${tiles}</g>`,
    `<g id="regioni">${maps}</g>`,
    `<g id="tratte" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-opacity="0.9" stroke-linecap="round" stroke-linejoin="round">${lineEls}</g>`,
    `<g id="stelle">${starEls}</g>`,
    `</svg>`,
  ].join("");
}
