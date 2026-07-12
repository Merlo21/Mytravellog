import { openDB, DBSchema, IDBPDatabase } from "idb";

export interface Photo {
  id: string;
  tripId: string;
  data: ArrayBuffer;
  type: string;
  createdAt: string;
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

export async function deletePhotosForTrip(tripId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const index = tx.store.index("by-trip");
  let cursor = await index.openCursor(tripId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

/** Test-only: forza una nuova connessione al DB (utile tra i test con fake-indexeddb). */
export function __resetPhotoDB() {
  dbPromise = null;
}
