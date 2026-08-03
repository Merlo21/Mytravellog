/**
 * Distanza haversine in km, NON arrotondata — pensata per SOMMARE tanti
 * segmenti corti (una traccia GPX o un percorso stradale denso). `distanceKm`
 * (geo.ts) arrotonda al km intero: giusto per mostrare una singola distanza,
 * ma sommandola su migliaia di segmenti da pochi metri ognuno collassa a 0 e
 * il totale sparisce. Qui niente arrotondamento: si arrotonda semmai il
 * totale finale, al momento di mostrarlo.
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
