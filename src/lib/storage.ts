// [FROZEN] — Non modificare senza esplicita richiesta
export type Trip = {
  id: string;
  title: string;
  country: string;
  city: string;
  trip_date: string; // YYYY-MM-DD (inizio)
  date_end: string | null; // YYYY-MM-DD (fine)
  rating: number | null; // 1-5 stelle
  notes: string | null;
  purpose?: string | null; // motivo del viaggio: "Vacanza" | "Lavoro" (scelta singola, opzionale)
  companions?: string[];   // nomi delle persone con cui hai viaggiato (opzionali; assenti sui viaggi vecchi)
  diary?: { date: string; text: string }[]; // racconto giorno-per-giorno (date YYYY-MM-DD; solo i giorni scritti)
  status?: "planned" | "done"; // "planned" = viaggio in programma (vive nel bucket piani, non nel diario); assente/"done" = viaggio del diario
  budget?: { label: string; amount: number; paid?: number }[]; // preventivo per categoria (importo stimato + eventuale già pagato)
  checklist?: { text: string; done: boolean }[];               // "da organizzare" prima di partire
  transport_mode: "plane" | "train" | "car" | "ship" | "walk" | "bici" | "moto" | null;
  waypoints: { id?: string; city: string; country: string; country_code?: string; transport_mode: "plane" | "train" | "car" | "ship" | "walk" | "bici" | "moto"; lat?: number; lon?: number; route_geometry?: [number, number][] | null }[];
  latitude: number;
  longitude: number;
  home_latitude: number | null;
  home_longitude: number | null;
  home_label: string | null;
  route_geometry: [number, number][] | null; // percorso stradale reale per la tratta finale (solo se transport_mode="car")
  temperature_c: number | null;
  altitude_m: number | null;
  max_altitude_m: number | null; // altitudine massima tra tutte le tappe (non solo la destinazione)
  max_altitude_city: string | null; // nome della città più alta
  distance_from_home_km: number | null; // somma di tutti i segmenti (km totali percorsi)
  max_distance_from_home_km: number | null; // distanza massima raggiunta dalla città di residenza (per "più lontano")
  max_distance_city: string | null; // nome della città più lontana
  hottest_temp_c: number | null;    // temperatura più alta tra tutte le tappe
  hottest_city: string | null;      // città più calda
  coldest_temp_c: number | null;    // temperatura più bassa tra tutte le tappe
  coldest_city: string | null;      // città più fredda
  region: string | null;             // regione/stato della destinazione (nomi, per display)
  region_details: { name: string; code: string | null }[] | null; // stesse regioni con codice ISO 3166-2, per l'abbinamento indipendente dalla lingua in CountryMapModal
  country_code: string;
  created_at: string;
};

const KEY = "atlas.trips.v1";

export function loadTrips(): Trip[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Trip[];
    // Sort difensivo: un solo record con trip_date mancante faceva lanciare
    // localeCompare -> il catch restituiva [] NASCONDENDO TUTTI i viaggi, e la
    // successiva addTrip salvava sopra un array vuoto (perdita totale).
    return arr.sort((a, b) => (b.trip_date || "").localeCompare(a.trip_date || ""));
  } catch {
    return [];
  }
}

/**
 * Notificatore degli errori di scrittura, iniettato dall'app (main.tsx) per non
 * legare questo modulo alla UI: qui resta senza dipendenze e testabile.
 */
let onWriteError: ((err: unknown) => void) | null = null;
export function setStorageErrorHandler(fn: ((err: unknown) => void) | null): void {
  onWriteError = fn;
}

/**
 * Scrittura a prova di quota piena. `setItem` lancia QuotaExceededError quando
 * lo spazio finisce (le `route_geometry` dei percorsi stradali sono grosse):
 * prima l'eccezione risaliva fino ad addTrip/updateTrip e il salvataggio
 * falliva SENZA alcun segnale per l'utente. Ora l'errore viene notificato
 * (toast) e la funzione dice se ha scritto davvero.
 */
function persist(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    onWriteError?.(err);
    return false;
  }
}

export function saveTrips(trips: Trip[]): boolean {
  return persist(KEY, JSON.stringify(trips));
}

/**
 * `id` è opzionale e serve solo a NuovoViaggio.tsx: genera un id di bozza
 * PRIMA di salvare (per poter già collegare le foto delle tappe via
 * photoStorage.ts), e lo passa qui perché il viaggio salvato usi lo stesso
 * id — altrimenti le foto caricate prima del salvataggio resterebbero
 * orfane sotto un id che il viaggio non ha più.
 */
export function addTrip(t: Omit<Trip, "id" | "created_at">, id?: string): Trip {
  const full: Trip = { ...t, id: id ?? crypto.randomUUID(), created_at: new Date().toISOString() };
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

// ————————————————————————————————————————————————————————————————
// Viaggi "in programma": bucket SEPARATO dal diario, così i viaggi futuri non
// entrano in statistiche/globo/recap/mappe (che leggono solo loadTrips()).
// Stesso identico tipo Trip, con status "planned". "Segna come fatto"
// (promotePlanToTrip) sposta il viaggio nel diario, dove diventa "done".
// ————————————————————————————————————————————————————————————————
const KEY_PLANS = "atlas.plans.v1";

export function loadPlans(): Trip[] {
  try {
    const raw = localStorage.getItem(KEY_PLANS);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Trip[];
    return arr.sort((a, b) => (a.trip_date || "").localeCompare(b.trip_date || "")); // i più imminenti prima
  } catch {
    return [];
  }
}

export function savePlans(plans: Trip[]): boolean {
  return persist(KEY_PLANS, JSON.stringify(plans));
}

export function addPlan(t: Omit<Trip, "id" | "created_at" | "status">, id?: string): Trip {
  const full: Trip = { ...t, id: id ?? crypto.randomUUID(), status: "planned", created_at: new Date().toISOString() };
  const all = loadPlans();
  all.push(full);
  savePlans(all);
  return full;
}

export function updatePlan(id: string, patch: Partial<Omit<Trip, "id" | "created_at">>): Trip | null {
  const all = loadPlans();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const updated = { ...all[idx], ...patch };
  all[idx] = updated;
  savePlans(all);
  return updated;
}

export function deletePlan(id: string): void {
  savePlans(loadPlans().filter((t) => t.id !== id));
}

/**
 * "Segna come fatto": sposta un piano dal bucket piani a quello del diario
 * (status "done", in cima alla lista). Ritorna il viaggio promosso, o null se
 * l'id non esiste.
 */
export function promotePlanToTrip(id: string): Trip | null {
  const plans = loadPlans();
  const plan = plans.find((t) => t.id === id);
  if (!plan) return null;
  savePlans(plans.filter((t) => t.id !== id));
  const done: Trip = { ...plan, status: "done" };
  const trips = loadTrips();
  trips.unshift(done);
  saveTrips(trips);
  return done;
}

/** Parse a YYYY-MM-DD string as local midnight (avoids UTC off-by-one). */
export function parseLocalDate(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

/**
 * Data di oggi in YYYY-MM-DD, nel fuso orario locale — non
 * `new Date().toISOString().slice(0,10)`, che legge il calendario UTC: tra
 * mezzanotte e l'ora del proprio fuso (es. le prime ~1-2 ore in Italia)
 * avrebbe precompilato/valutato "ieri" invece di oggi.
 */
export function todayLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatTripDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
// Backwards-compatible alias (created_at optional for test fixtures)
export type LocalTrip = Omit<Trip, "created_at"> & { created_at?: string };
