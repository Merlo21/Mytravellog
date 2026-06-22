export type Trip = {
  id: string;
  title: string;
  country: string;
  city: string;
  trip_date: string; // YYYY-MM-DD
  notes: string | null;
  latitude: number;
  longitude: number;
  home_latitude: number;
  home_longitude: number;
  home_label: string;
  temperature_c: number | null;
  altitude_m: number | null;
  distance_from_home_km: number | null;
  country_code: string;
  created_at: string;
};

const KEY = "atlas.trips.v1";

export function loadTrips(): Trip[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Trip[];
    return arr.sort((a, b) => b.trip_date.localeCompare(a.trip_date));
  } catch {
    return [];
  }
}

export function saveTrips(trips: Trip[]): void {
  localStorage.setItem(KEY, JSON.stringify(trips));
}

export function addTrip(t: Omit<Trip, "id" | "created_at">): Trip {
  const full: Trip = { ...t, id: crypto.randomUUID(), created_at: new Date().toISOString() };
  const all = loadTrips();
  all.unshift(full);
  saveTrips(all);
  return full;
}

export function updateTrip(id: string, patch: Partial<Omit<Trip, "id" | "created_at">>): Trip | null {
  const all = loadTrips();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const updated = { ...all[idx], ...patch };
  all[idx] = updated;
  saveTrips(all);
  return updated;
}

export function deleteTrip(id: string): void {
  saveTrips(loadTrips().filter((t) => t.id !== id));
}

/** Parse a YYYY-MM-DD string as local midnight (avoids UTC off-by-one). */
export function parseLocalDate(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

export function formatTripDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}