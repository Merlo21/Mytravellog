/**
 * Una coppia lat/lon è utilizzabile?
 *
 * Esiste per un motivo preciso: il test "naturale" `lat && lon` scarta lo ZERO,
 * che è una coordinata perfettamente valida — l'equatore (Quito, Nairobi,
 * Pontianak) e il meridiano di Greenwich (Accra, Londra a 0.1°). Con quel
 * controllo un viaggio o una tappa lì sparivano dal globo, o la rotta non
 * veniva disegnata. `Number.isFinite` copre in un colpo NaN e Infinity.
 */
export function hasCoords(lat: number | null | undefined, lon: number | null | undefined): boolean {
  return lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon);
}
