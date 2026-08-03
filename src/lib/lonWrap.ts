/**
 * Antimeridiano: "srotolamento" delle longitudini.
 *
 * Modulo minimo e senza dipendenze di proposito: lo usano sia posterSvg
 * (che tira dentro topojson) sia WorldMap, che è nel bundle iniziale — tenerlo
 * a parte evita di far pagare topojson alla Home.
 */

/**
 * Riporta `lon` nella finestra di ±180° centrata su `anchor`, aggiungendo o
 * togliendo giri interi di 360°. Senza, Tokyo (139) e Los Angeles (-118)
 * distano "257°" e tutto (inquadratura e linea) prende il verso lungo
 * attraverso Europa/Atlantico invece del Pacifico: qui LA diventa 242 → 103°
 * dal lato giusto. O(1) e a prova di valori non finiti (un `while` avrebbe
 * ciclato all'infinito su Infinity).
 */
export function unwrapNear(lon: number, anchor: number): number {
  if (!Number.isFinite(lon) || !Number.isFinite(anchor)) return lon;
  return lon - 360 * Math.round((lon - anchor) / 360);
}

/**
 * "Srotola" un percorso: ogni punto viene portato entro ±180° dal precedente,
 * così due punti consecutivi prendono sempre l'arco più corto. Le longitudini
 * risultanti possono uscire da [-180,180] — è VOLUTO: MapLibre le avvolge da sé
 * e la proiezione lineare del poster le gestisce; è ciò che tiene la linea
 * continua invece di farla attraversare tutta la mappa.
 */
export function unwrapPath(coords: [number, number][]): [number, number][] {
  if (coords.length < 2) return coords;
  const out: [number, number][] = [coords[0]];
  let prev = coords[0][0];
  for (let i = 1; i < coords.length; i++) {
    const lon = unwrapNear(coords[i][0], prev);
    out.push([lon, coords[i][1]]);
    prev = lon;
  }
  return out;
}

/**
 * Srotola PIÙ segmenti in un'unica catena: il primo punto di ogni segmento
 * viene portato vicino all'ULTIMO punto del segmento precedente, poi il
 * segmento prosegue punto-per-punto come unwrapPath. Equivale a srotolare la
 * concatenazione e rispezzarla.
 *
 * Senza, ogni segmento viveva nella propria finestra di 360°: nella Mappa
 * della vita due viaggi ai lati opposti dell'antimeridiano (Auckland→Samoa e
 * LA→Hawaii) finivano a un giro di distanza — fitBounds inquadrava il mondo
 * intero e nel poster lo stesso oceano compariva in due punti diversi.
 * Idempotente: ri-applicata a segmenti già srotolati non cambia nulla.
 */
export function unwrapSegments(segs: [number, number][][]): [number, number][][] {
  let prevEnd: number | null = null;
  return segs.map(seg => {
    if (!seg.length) return seg;
    const start = prevEnd == null ? seg[0][0] : unwrapNear(seg[0][0], prevEnd);
    const out: [number, number][] = [[start, seg[0][1]]];
    let p = start;
    for (let i = 1; i < seg.length; i++) {
      const lon = unwrapNear(seg[i][0], p);
      out.push([lon, seg[i][1]]);
      p = lon;
    }
    prevEnd = p;
    return out;
  });
}
