import { Trip } from "./storage";
import { getPhotosForTrip, savePhoto, photoToBlob, stopPhotoKeys } from "./photoStorage";

const LAST_BACKUP_AT_KEY = "navta.last_backup_at";
const LAST_BACKUP_COUNT_KEY = "navta.last_backup_trip_count";
const STALE_DAYS = 30;
const STALE_NEW_TRIPS = 5;

// @supabase/supabase-js caricato solo quando serve davvero (backup/ripristino
// avvengono solo su azione esplicita dell'utente loggato) — stesso motivo
// del dynamic import in auth.tsx: non appesantire il bundle di ogni pagina.
function getSupabase() {
  return import("@/integrations/supabase/client").then(m => m.supabase);
}

export interface BackupResult {
  error?: string;
}

export interface RestoreResult {
  trips?: Trip[];
  error?: string;
}

export function getLastBackupInfo(): { at: string | null; tripCount: number } {
  return {
    at: localStorage.getItem(LAST_BACKUP_AT_KEY),
    tripCount: Number(localStorage.getItem(LAST_BACKUP_COUNT_KEY) ?? "0"),
  };
}

function setLastBackupInfo(tripCount: number) {
  localStorage.setItem(LAST_BACKUP_AT_KEY, new Date().toISOString());
  localStorage.setItem(LAST_BACKUP_COUNT_KEY, String(tripCount));
}

/** Vero se sono passati troppi giorni, o troppi viaggi nuovi, dall'ultimo backup. */
export function isBackupStale(currentTripCount: number, now: Date = new Date()): boolean {
  const { at, tripCount } = getLastBackupInfo();
  if (!at) return currentTripCount > 0;
  const daysSince = (now.getTime() - new Date(at).getTime()) / 86400000;
  if (daysSince > STALE_DAYS) return true;
  return currentTripCount - tripCount >= STALE_NEW_TRIPS;
}

/**
 * Backup manuale (non sync in tempo reale): carica tutte le foto di ogni
 * tappa di ogni viaggio (casa, ogni waypoint, destinazione) nel bucket
 * Storage e l'intero elenco viaggi come JSON in `backups`. Ricarica sempre
 * tutte le foto correnti (upsert) invece di tracciare quali sono già state
 * caricate — più semplice, accettabile per un'azione manuale e non frequente.
 */
export async function backupNow(userId: string, trips: Trip[]): Promise<BackupResult> {
  const supabase = await getSupabase();

  for (const trip of trips) {
    for (const stopKey of stopPhotoKeys(trip)) {
      const photos = await getPhotosForTrip(stopKey);
      for (const photo of photos) {
        const path = `${userId}/${stopKey}/${photo.id}`;
        const { error } = await supabase.storage
          .from("trip-photos")
          .upload(path, photoToBlob(photo), { upsert: true, contentType: photo.type });
        if (error) return { error: `Errore nel caricamento di una foto: ${error.message}` };
      }
    }
  }

  const { error } = await supabase.from("backups").upsert({ user_id: userId, trips_json: trips as never });
  if (error) return { error: `Errore nel salvataggio dei viaggi: ${error.message}` };

  setLastBackupInfo(trips.length);
  return {};
}

/** Scarica l'ultimo backup (viaggi + foto di tutte le tappe) per l'utente indicato. */
export async function restoreBackup(userId: string): Promise<RestoreResult> {
  const supabase = await getSupabase();

  const { data, error } = await supabase.from("backups").select("trips_json").eq("user_id", userId).maybeSingle();
  if (error) return { error: `Errore nel recupero del backup: ${error.message}` };
  if (!data) return { error: "Nessun backup trovato per questo account." };

  const trips = data.trips_json as unknown as Trip[];

  for (const trip of trips) {
    for (const stopKey of stopPhotoKeys(trip)) {
      const { data: files } = await supabase.storage.from("trip-photos").list(`${userId}/${stopKey}`);
      for (const file of files ?? []) {
        const { data: blob } = await supabase.storage.from("trip-photos").download(`${userId}/${stopKey}/${file.name}`);
        // file.name è l'id originale della foto (path di backup .../{stopKey}/{photo.id}):
        // riusandolo, un secondo restore sovrascrive invece di duplicare.
        if (blob) await savePhoto(stopKey, blob, file.name);
      }
    }
  }

  return { trips };
}
