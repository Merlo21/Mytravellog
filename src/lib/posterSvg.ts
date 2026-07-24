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
  routeCoords: [number, number][];
  /** Tappe (nodi-stella) con etichetta. */
  stops: Stop[];
  /** Anelli dei confini [lon,lat][] già selezionati per il riquadro (opzionale). */
  borders?: [number, number][][];
  title: string;
  dateLabel?: string | null;
  /** Es. "1315 km · 6 tappe". */
  stats?: string | null;
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
  const { routeCoords, stops, borders = [], title, dateLabel, stats } = input;

  // Fascia inferiore RISERVATA alla didascalia (titolo/date/stats): la mappa
  // disegna solo SOPRA, così le scritte non si sovrappongono mai al tracciato
  // (com'era col titolo in un angolo). Layout classico da poster/stampa.
  const hasCaption = !!(title || dateLabel || stats);
  const bandH = hasCaption ? (30 + 46 + (dateLabel ? 30 : 0) + (stats ? 34 : 0) + 28) : 0;
  const mapH = H - bandH;

  // Riquadro (in mercatore) sul solo percorso+tappe: il tracciato riempie
  // sempre l'area-mappa allo stesso modo; i confini che sforano vengono
  // ritagliati dal viewBox.
  const framePts: [number, number][] = [...routeCoords, ...stops.map(s => [s.lon, s.lat] as [number, number])];
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

  const routePath = routeCoords.length > 1
    ? "M" + routeCoords.map(([lon, lat]) => { const [x, y] = project(lon, lat); return `${n(x)},${n(y)}`; }).join("L")
    : "";

  const starEls = stops.map(s => {
    const [x, y] = project(s.lon, s.lat);
    return `<circle cx="${n(x)}" cy="${n(y)}" r="16" fill="url(#starGlow)"/><circle data-led="1" cx="${n(x)}" cy="${n(y)}" r="5" fill="#ffffff"/>`;
  }).join("");

  const labelEls = stops.map(s => {
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

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    `<defs><radialGradient id="starGlow"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="35%" stop-color="#ffffff" stop-opacity="0.35"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="#000000"/>`,
    `<g id="confini" fill="none" stroke="#ffffff" stroke-opacity="0.32" stroke-width="1.1" stroke-linejoin="round">${bordersPaths}</g>`,
    routePath ? `<g id="tracciato" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="${routePath}"/></g>` : "",
    `<g id="stelle">${starEls}</g>`,
    `<g id="etichette">${labelEls}</g>`,
    dividerEl,
    `<g id="titolo">${titleEls.join("")}</g>`,
    `</svg>`,
  ].join("");
}
