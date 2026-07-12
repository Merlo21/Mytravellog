import { openDB, DBSchema, IDBPDatabase } from "idb";
import type { Trip } from "./storage";

export interface Photo {
  id: string;
  /**
   * Non è (più) sempre l'id del viaggio in senso stretto: è la chiave della
   * "tappa" a cui la foto è associata. Per compatibilità con le foto già
   * salvate prima che esistesse il concetto di tappa, la destinazione usa
   * ancora l'id del viaggio nudo — casa e ogni tappa intermedia usano invece
   * destinationPhotoKey/homePhotoKey/waypointPhotoKey qui sotto.
   */
  tripId: string;
  data: ArrayBuffer;
  type: string;
  createdAt: string;
}

/** Chiave foto della destinazione — invariata (id del viaggio) per restare compatibile con le foto già salvate. */
export function destinationPhotoKey(tripId: string): string {
  return tripId;
}

/** Chiave foto della tappa "casa" (partenza) di un viaggio. */
export function homePhotoKey(tripId: string): string {
  return `${tripId}:home`;
}

/** Chiave foto di una singola tappa intermedia, identificata dal suo id stabile. */
export function waypointPhotoKey(tripId: string, waypointId: string): string {
  return `${tripId}:waypoint:${waypointId}`;
}

/** Tutte le possibili chiavi foto di un viaggio (destinazione, casa, ogni tappa con id). */
export function stopPhotoKeys(trip: Pick<Trip, "id" | "waypoints">): string[] {
  const keys = [destinationPhotoKey(trip.id), homePhotoKey(trip.id)];
  for (const w of trip.waypoints ?? []) {
    if (w.id) keys.push(waypointPhotoKey(trip.id, w.id));
  }
  return keys;
}

interface PhotoDB extends DBSchema {
  photos: {
    key: string;
    value: Photo;
    indexes: { "by-trip": string };
  };
}

const DB_NAME = "mytravellog-photos";
const DB_VERSION = 1;
const STORE_NAME = "photos";

// localStorage ha un limite di pochi MB per l'intera app: sufficiente per i
// dati dei viaggi (testo), non per le foto (binarie, migliaia di volte più
// pesanti). IndexedDB non ha questo limite pratico e salva i Blob nativamente,
// senza doverli prima convertire in base64.
let dbPromise: Promise<IDBPDatabase<PhotoDB>> | null = null;

function getDB(): Promise<IDBPDatabase<PhotoDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PhotoDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("by-trip", "tripId");
      },
    });
  }
  return dbPromise;
}

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

export async function savePhoto(tripId: string, blob: Blob): Promise<string> {
  const id = crypto.randomUUID();
  const data = await blobToArrayBuffer(blob);
  const db = await getDB();
  await db.put(STORE_NAME, { id, tripId, data, type: blob.type, createdAt: new Date().toISOString() });
  return id;
}

export async function getPhotosForTrip(tripId: string): Promise<Photo[]> {
  const db = await getDB();
  return db.getAllFromIndex(STORE_NAME, "by-trip", tripId);
}

/** Ricostruisce un Blob visualizzabile/scaricabile da una Photo salvata. */
export function photoToBlob(photo: Photo): Blob {
  return new Blob([photo.data], { type: photo.type });
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

/** Cancella le foto di tutte le tappe del viaggio (casa, ogni waypoint, destinazione). */
export async function deletePhotosForTrip(trip: Pick<Trip, "id" | "waypoints">): Promise<void> {
  const db = await getDB();
  for (const key of stopPhotoKeys(trip)) {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const index = tx.store.index("by-trip");
    let cursor = await index.openCursor(key);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }
}

/** Test-only: forza una nuova connessione al DB (utile tra i test con fake-indexeddb). */
export function __resetPhotoDB() {
  dbPromise = null;
}
