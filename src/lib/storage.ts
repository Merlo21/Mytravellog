export type LocalTrip = {
  id: string;
  title: string;
  country: string;
  city: string;
  trip_date: string;
  notes: string | null;
  latitude: number;
  longitude: number;
  home_latitude: number;
  home_longitude: number;
  home_label: string | null;
  temperature_c: number | null;
  altitude_m: number | null;
  distance_from_home_km: number | null;
  country_code?: string;
  created_at: string;
};

const KEY = "atlas.trips.v1";

export function loadTrips(): LocalTrip[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as LocalTrip[];
    return arr.sort((a, b) => b.trip_date.localeCompare(a.trip_date));
  } catch {
    return [];
  }
}

export function saveTrips(trips: LocalTrip[]) {
  localStorage.setItem(KEY, JSON.stringify(trips));
}

export function addTrip(trip: Omit<LocalTrip, "id" | "created_at">): LocalTrip {
  const full: LocalTrip = {
    ...trip,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };
  const all = loadTrips();
  all.unshift(full);
  saveTrips(all);
  return full;
}

export function deleteTrip(id: string) {
  saveTrips(loadTrips().filter((t) => t.id !== id));
}

export function updateTrip(id: string, patch: Partial<Omit<LocalTrip, "id" | "created_at">>): LocalTrip | null {
  const all = loadTrips();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const updated = { ...all[idx], ...patch };
  all[idx] = updated;
  saveTrips(all);
  return updated;
}
