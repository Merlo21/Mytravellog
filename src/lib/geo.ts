// Open-Meteo APIs (no key required)
// Geocoding: https://geocoding-api.open-meteo.com
// Forecast: https://api.open-meteo.com/v1/forecast
// Elevation: https://api.open-meteo.com/v1/elevation

export type GeoResult = {
  id: number;
  name: string;
  country: string;
  country_code?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
};

export async function searchPlaces(query: string, count = 6): Promise<GeoResult[]> {
  if (!query.trim()) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=${count}&language=it&format=json`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const data = await r.json();
  return (data.results ?? []) as GeoResult[];
}

export async function fetchElevation(lat: number, lon: number): Promise<number | null> {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d?.elevation?.[0] ?? null;
  } catch {
    return null;
  }
}

// Returns avg temperature in °C for the given date (or current if today/future-no-data)
export async function fetchTemperature(lat: number, lon: number, dateISO: string): Promise<number | null> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const isPast = dateISO < today;
    if (isPast) {
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${dateISO}&end_date=${dateISO}&daily=temperature_2m_mean&timezone=auto`;
      const r = await fetch(url);
      if (!r.ok) return null;
      const d = await r.json();
      return d?.daily?.temperature_2m_mean?.[0] ?? null;
    } else {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&timezone=auto`;
      const r = await fetch(url);
      if (!r.ok) return null;
      const d = await r.json();
      return d?.current?.temperature_2m ?? null;
    }
  } catch {
    return null;
  }
}

// Haversine distance in km
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

// Convert ISO country (e.g. "IT") to flag emoji
export function countryFlag(code?: string): string {
  if (!code || code.length !== 2) return '🌍';
  const A = 0x1f1e6;
  return String.fromCodePoint(...code.toUpperCase().split('').map(c => A + c.charCodeAt(0) - 65));
}
