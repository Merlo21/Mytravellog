import { Trip } from "./storage";
import { distanceKm } from "./geo";
import { destinationPhotoKey, homePhotoKey, waypointPhotoKey } from "./photoStorage";

export type TransportMode = "plane" | "train" | "car" | "ship" | "walk";

export interface FlightStop {
  lat: number;
  lon: number;
  label: string;
  tripId: string;
  /** Chiave IndexedDB delle foto di questa tappa (destinazione/casa/waypoint). */
  photoKey: string;
  /** Mezzo usato per ARRIVARE a questa tappa (null per la prima, es. casa). */
  transportMode: TransportMode | null;
  /** Percorso stradale reale per arrivare qui, se disponibile (solo mezzo "car"). */
  routeGeometry: [number, number][] | null;
}

export interface LegCamera {
  zoom: number;
  pitch: number;
  bearing: number;
  durationMs: number;
}

export interface FlightLeg {
  from: FlightStop;
  to: FlightStop;
  camera: LegCamera;
  /**
   * Punti [lon,lat] da percorrere per questa tratta: il tracciato stradale
   * reale (from `to.routeGeometry`) quando disponibile, altrimenti una linea
   * retta da `from` a `to`. Usata per disegnare il percorso e per animare
   * l'icona del mezzo — la telecamera invece vola sempre dritta verso `to`
   * (vedi computeLegCamera), non segue le curve.
   */
  pathCoords: [number, number][];
}

const COORD_EPSILON = 1e-6;

function sameCoords(a: { lat: number; lon: number }, lat: number, lon: number): boolean {
  return Math.abs(a.lat - lat) < COORD_EPSILON && Math.abs(a.lon - lon) < COORD_EPSILON;
}

/**
 * Sequenza di tappe (casa → waypoint → destinazione) per uno o più viaggi,
 * ordinati per data — per il recap multi-viaggio è la stessa funzione,
 * semplicemente con più di un trip in ingresso. Tappe consecutive con le
 * stesse coordinate (es. la destinazione di un viaggio coincide con la casa
 * di quello successivo) vengono unite in una sola, altrimenti la tratta
 * risultante avrebbe lunghezza zero e bearing/zoom indefiniti.
 */
export function buildFlightPath(trips: Trip[]): FlightStop[] {
  const sorted = [...trips].sort((a, b) => a.trip_date.localeCompare(b.trip_date));
  const stops: FlightStop[] = [];

  const push = (
    lat: number, lon: number, label: string, tripId: string,
    photoKey: string, transportMode: TransportMode | null, routeGeometry: [number, number][] | null,
  ) => {
    const last = stops[stops.length - 1];
    if (last && sameCoords(last, lat, lon)) return;
    stops.push({ lat, lon, label, tripId, photoKey, transportMode, routeGeometry });
  };

  for (const t of sorted) {
    if (t.home_latitude != null && t.home_longitude != null) {
      push(t.home_latitude, t.home_longitude, t.home_label ?? "Casa", t.id, homePhotoKey(t.id), null, null);
    }
    for (const w of t.waypoints ?? []) {
      if (w.lat != null && w.lon != null) {
        const photoKey = w.id ? waypointPhotoKey(t.id, w.id) : destinationPhotoKey(t.id);
        push(w.lat, w.lon, w.city, t.id, photoKey, w.transport_mode, w.route_geometry ?? null);
      }
    }
    push(t.latitude, t.longitude, t.city, t.id, destinationPhotoKey(t.id), t.transport_mode, t.route_geometry ?? null);
  }

  return stops;
}

/** Bearing iniziale (0-360°, 0=nord) da percorrere per andare da a a b. */
export function bearingBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * Camera per la tratta a→b: più la distanza è corta più si vola vicini al
 * suolo con inclinazione forte (effetto "cinematografico"), più è lunga
 * (intercontinentale) più si sale di quota restando sul globo. La durata
 * è proporzionale alla distanza ma restA in un range godibile (3.5-7.5s).
 */
export function computeLegCamera(from: { lat: number; lon: number }, to: { lat: number; lon: number }): LegCamera {
  const bearing = bearingBetween(from, to);
  const km = distanceKm(from.lat, from.lon, to.lat, to.lon);

  let zoom: number;
  let pitch: number;
  if (km < 50) { zoom = 11; pitch = 60; }
  else if (km < 500) { zoom = 7; pitch = 55; }
  else if (km < 3000) { zoom = 4.5; pitch = 45; }
  else { zoom = 2.5; pitch = 30; }

  const durationMs = Math.min(7500, Math.max(3500, km * 4));

  return { zoom, pitch, bearing, durationMs };
}

/**
 * Easing condiviso tra camera e icona del mezzo, applicato a mano al `t` di
 * entrambe prima di interpolare posizione/zoom/pitch/bearing (camera) e
 * pointAlongPath (icona). Necessario pilotare la camera a mano frame per
 * frame (invece del `flyTo` nativo di MapLibre) perché la sua curva di volo
 * predefinita non avanza in modo geograficamente lineare nemmeno passandole
 * un easing custom (lo zoom-out/in intermedio distorce comunque il
 * progresso: misurato dal vivo, a metà durata la camera nativa era già al
 * 97% del tragitto mentre l'icona a velocità costante era solo al 50%).
 * Con la STESSA easeInOutCubic e la STESSA interpolazione lineare a guidare
 * entrambe, restano allineate per l'intera tratta.
 */
export function easeInOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

/** Interpola un bearing (0-360°) da `from` a `to` seguendo il verso più breve. */
export function lerpBearing(from: number, to: number, t: number): number {
  const c = Math.min(1, Math.max(0, t));
  const delta = ((to - from + 540) % 360) - 180;
  return (from + delta * c + 360) % 360;
}

/**
 * Punti da percorrere per arrivare a `to`: il tracciato stradale reale se
 * presente (solo tratte in auto con route_geometry salvata), altrimenti la
 * linea retta from→to.
 */
function legPathCoords(from: FlightStop, to: FlightStop): [number, number][] {
  if (to.routeGeometry && to.routeGeometry.length > 1) return to.routeGeometry;
  return [[from.lon, from.lat], [to.lon, to.lat]];
}

/** Spezza la sequenza di tappe in tratte, ciascuna con la propria camera e il proprio percorso. */
export function buildFlightLegs(stops: FlightStop[]): FlightLeg[] {
  const legs: FlightLeg[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i];
    const to = stops[i + 1];
    legs.push({ from, to, camera: computeLegCamera(from, to), pathCoords: legPathCoords(from, to) });
  }
  return legs;
}

/** Lunghezza approssimata (km) di un percorso [lon,lat][], sommando ogni segmento. */
function pathLengthKm(path: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += distanceKm(path[i - 1][1], path[i - 1][0], path[i][1], path[i][0]);
  }
  return total;
}

/**
 * Punto [lon,lat] alla frazione `t` (0-1) di un percorso, camminando a
 * velocità costante lungo i suoi segmenti (non semplicemente interpolando
 * tra il primo e l'ultimo punto) — usata per animare l'icona del mezzo
 * lungo un tracciato stradale con molti punti ravvicinati in modo ineguale.
 */
export function pointAlongPath(path: [number, number][], t: number): [number, number] {
  if (path.length === 0) return [0, 0];
  if (path.length === 1 || t <= 0) return path[0];
  if (t >= 1) return path[path.length - 1];

  const total = pathLengthKm(path);
  if (total === 0) return path[0];

  const targetKm = total * t;
  let covered = 0;
  for (let i = 1; i < path.length; i++) {
    const segKm = distanceKm(path[i - 1][1], path[i - 1][0], path[i][1], path[i][0]);
    if (covered + segKm >= targetKm || i === path.length - 1) {
      const segT = segKm === 0 ? 0 : (targetKm - covered) / segKm;
      const clampedT = Math.min(1, Math.max(0, segT));
      const [lon1, lat1] = path[i - 1];
      const [lon2, lat2] = path[i];
      return [lon1 + (lon2 - lon1) * clampedT, lat1 + (lat2 - lat1) * clampedT];
    }
    covered += segKm;
  }
  return path[path.length - 1];
}
