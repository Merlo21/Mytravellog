import {
  requestAccessToken, readSharedFile, writeSharedFile, shareSharedFile,
  fetchUserEmail, SHARED_VERSION, SharedMap,
} from "@/lib/googleDrive";
import { sharedTrips, Trip } from "@/lib/storage";

// Chiavi localStorage della "nostra mappa" (viaggi di coppia).
const LS_FILE = "atlas.shared.fileId";     // id del file Drive condiviso (dal proprietario o dal Picker)
const LS_EMAIL = "atlas.shared.myEmail";   // la mia email (per timbrare sharedBy)
const LS_CACHE = "atlas.shared.cache.v1";  // ultima mappa condivisa vista (miei + partner), per la vista offline

export function sharedFileId(): string | null { return localStorage.getItem(LS_FILE); }
export function setSharedFileId(id: string): void { localStorage.setItem(LS_FILE, id); }
export function hasSharedMap(): boolean { return !!sharedFileId(); }

export function loadSharedCache(): Trip[] {
  try { return JSON.parse(localStorage.getItem(LS_CACHE) || "[]"); } catch { return []; }
}
function saveSharedCache(trips: Trip[]): void {
  try { localStorage.setItem(LS_CACHE, JSON.stringify(trips)); } catch { /* quota */ }
}

// Token silenzioso se possibile, altrimenti interattivo (popup di consenso).
async function token(interactive = false): Promise<string> {
  try { return (await requestAccessToken(false)).token; }
  catch { if (!interactive) throw new Error("not_connected"); return (await requestAccessToken(true)).token; }
}

async function myEmail(tok: string): Promise<string> {
  let e = localStorage.getItem(LS_EMAIL);
  if (!e) { e = (await fetchUserEmail(tok)) || "me"; localStorage.setItem(LS_EMAIL, e); }
  return e;
}

/**
 * Cuore della sincronizzazione (puro, testabile): la nuova mappa condivisa =
 * viaggi del PARTNER lasciati intatti + i MIEI viaggi condivisi timbrati.
 * Sostituendo i miei per intero, "condividi" e "togli" si propagano senza
 * bisogno di tombstone; i viaggi legacy senza timbro (sharedBy assente) vengono
 * riassorbiti dai miei timbrati. Non tocca mai i viaggi del partner.
 */
export function mergeSharedContribution(remote: Trip[], mine: Trip[], me: string): Trip[] {
  const partner = remote.filter(t => t.sharedBy && t.sharedBy !== me);
  const stamped = mine.map(t => ({ ...t, sharedBy: me }));
  return [...partner, ...stamped];
}

/**
 * Push: scrive nel file condiviso i miei viaggi condivisi lasciando intatti
 * quelli del partner. Aggiorna la cache locale.
 */
export async function pushSharedMap(interactive = false): Promise<Trip[]> {
  const fileId = sharedFileId();
  if (!fileId) throw new Error("no_shared_file");
  const tok = await token(interactive);
  const me = await myEmail(tok);
  const remote = await readSharedFile(tok, fileId);
  const merged = mergeSharedContribution(remote?.trips ?? [], sharedTrips(), me);
  await writeSharedFile(tok, fileId, { version: SHARED_VERSION, updatedAt: Date.now(), trips: merged });
  saveSharedCache(merged);
  return merged;
}

/** Pull: legge il file condiviso e aggiorna la cache locale (per la vista). */
export async function pullSharedMap(interactive = false): Promise<Trip[]> {
  const fileId = sharedFileId();
  if (!fileId) return loadSharedCache();
  const tok = await token(interactive);
  const remote = await readSharedFile(tok, fileId);
  const trips = remote?.trips ?? [];
  saveSharedCache(trips);
  return trips;
}

/** Invita il partner (email) come editor del file condiviso. */
export async function invitePartner(email: string): Promise<void> {
  const fileId = sharedFileId();
  if (!fileId) throw new Error("no_shared_file");
  const tok = await token(true);
  await shareSharedFile(tok, fileId, email);
}

/** La "nostra mappa" da mostrare: cache (miei + partner) se c'è, altrimenti i
 *  miei flaggati (prima del primo sync). */
export function sharedMapView(): Trip[] {
  const cache = loadSharedCache();
  return cache.length ? cache : sharedTrips();
}
