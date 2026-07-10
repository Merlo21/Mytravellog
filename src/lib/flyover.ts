import { Trip } from "./storage";
import { distanceKm } from "./geo";

export interface FlightStop {
  lat: number;
  lon: number;
  label: string;
  tripId: string;
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

  const push = (lat: number, lon: number, label: string, tripId: string) => {
    const last = stops[stops.length - 1];
    if (last && sameCoords(last, lat, lon)) return;
    stops.push({ lat, lon, label, tripId });
  };

  for (const t of sorted) {
    if (t.home_latitude != null && t.home_longitude != null) {
      push(t.home_latitude, t.home_longitude, t.home_label ?? "Casa", t.id);
    }
    for (const w of t.waypoints ?? []) {
      if (w.lat != null && w.lon != null) push(w.lat, w.lon, w.city, t.id);
    }
    push(t.latitude, t.longitude, t.city, t.id);
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
 * è proporzionale alla distanza ma restA in un range godibile (2.5-6s).
 */
export function computeLegCamera(from: FlightStop, to: FlightStop): LegCamera {
  const bearing = bearingBetween(from, to);
  const km = distanceKm(from.lat, from.lon, to.lat, to.lon);

  let zoom: number;
  let pitch: number;
  if (km < 50) { zoom = 11; pitch = 60; }
  else if (km < 500) { zoom = 7; pitch = 55; }
  else if (km < 3000) { zoom = 4.5; pitch = 45; }
  else { zoom = 2.5; pitch = 30; }

  const durationMs = Math.min(6000, Math.max(2500, km * 4));

  return { zoom, pitch, bearing, durationMs };
}

/** Spezza la sequenza di tappe in tratte, ciascuna con la propria camera. */
export function buildFlightLegs(stops: FlightStop[]): FlightLeg[] {
  const legs: FlightLeg[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    legs.push({ from: stops[i], to: stops[i + 1], camera: computeLegCamera(stops[i], stops[i + 1]) });
  }
  return legs;
}
