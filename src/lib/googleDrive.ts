import { Trip } from "@/lib/storage";

/**
 * Integrazione Google Drive (client-only, app statica su GitHub Pages).
 *
 * - Login via Google Identity Services (token client): si ottiene un ACCESS
 *   TOKEN di breve durata; nessun client secret nel browser (niente da tenere
 *   segreto).
 * - I dati vivono in `appDataFolder`: una cartella NASCOSTA e riservata all'app
 *   nel Drive dell'utente (l'app non vede/tocca gli altri file). Un solo file
 *   `navta-backup.json` con { version, updatedAt, trips }.
 *
 * Il Client ID è PUBBLICO (è pensato per stare nel client) → hardcoded qui.
 */
export const GOOGLE_CLIENT_ID =
  "238461152099-10eqsi1gobbvqnoibjk81pucicgp9a41.apps.googleusercontent.com";

const SCOPE = "openid email profile https://www.googleapis.com/auth/drive.appdata";
const BACKUP_FILE = "navta-backup.json";
export const BACKUP_VERSION = 1;

export interface DriveBackup {
  version: number;
  /** ms epoch dell'ultimo salvataggio (per last-write-wins tra dispositivi). */
  updatedAt: number;
  trips: Trip[];
}

// ---- Caricamento dello script Google Identity Services (una volta sola) ------
let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) { resolve(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Impossibile caricare Google (rete?)."));
    document.head.appendChild(s);
  });
  return gisPromise;
}

export interface TokenResult { token: string; expiresIn: number }

/**
 * Richiede un access token. `interactive`:
 *  - true  → può mostrare popup di consenso/scelta account (per "Connetti");
 *  - false → SILENZIOSO (prompt:"none"), per riconnettersi al riavvio senza UI.
 */
export function requestAccessToken(interactive: boolean): Promise<TokenResult> {
  return loadGis().then(() => new Promise<TokenResult>((resolve, reject) => {
    const google = (window as any).google;
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      prompt: interactive ? "" : "none",
      callback: (resp: any) => {
        if (resp.error) { reject(new Error(resp.error)); return; }
        resolve({ token: resp.access_token, expiresIn: Number(resp.expires_in) || 3600 });
      },
      error_callback: (err: any) => reject(new Error(err?.type || "token_error")),
    });
    client.requestAccessToken();
  }));
}

/** Revoca il token (al "Disconnetti"): l'app perde l'accesso finché non ri-consenti. */
export function revokeAccessToken(token: string): void {
  const google = (window as any).google;
  try { google?.accounts?.oauth2?.revoke?.(token, () => {}); } catch { /* best effort */ }
}

/** Email dell'utente connesso (per mostrarla in Impostazioni). */
export async function fetchUserEmail(token: string): Promise<string | null> {
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.email ?? null;
  } catch { return null; }
}

// ---- File di backup nell'appDataFolder --------------------------------------
async function findBackupFileId(token: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${BACKUP_FILE}'`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name)&q=${q}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401) throw new Error("unauthorized");
  if (!r.ok) throw new Error("drive_list_failed");
  const j = await r.json();
  const f = (j.files ?? []).find((x: any) => x.name === BACKUP_FILE);
  return f?.id ?? null;
}

/** Legge il backup dal Drive (null se non esiste ancora). */
export async function readBackup(token: string): Promise<DriveBackup | null> {
  const id = await findBackupFileId(token);
  if (!id) return null;
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status === 401) throw new Error("unauthorized");
  if (!r.ok) throw new Error("drive_read_failed");
  return await r.json();
}

/** Scrive/aggiorna il backup nel Drive (appDataFolder). */
export async function writeBackup(token: string, data: DriveBackup): Promise<void> {
  const id = await findBackupFileId(token);
  const body = JSON.stringify(data);
  if (id) {
    const r = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body,
    });
    if (r.status === 401) throw new Error("unauthorized");
    if (!r.ok) throw new Error("drive_update_failed");
    return;
  }
  const boundary = "navta_" + Math.random().toString(36).slice(2);
  const metadata = { name: BACKUP_FILE, parents: ["appDataFolder"] };
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
  const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body: multipart,
  });
  if (r.status === 401) throw new Error("unauthorized");
  if (!r.ok) throw new Error("drive_create_failed");
}

/**
 * Unione dei viaggi locali e remoti (nessuna perdita di dati).
 * - `localTs`/`remoteTs`: quando è stato modificato ciascun lato (ms). Il lato
 *   più recente è "autoritativo" sui viaggi con lo STESSO id (last-write-wins);
 * - i viaggi presenti da un solo lato vengono comunque aggiunti (union).
 * Così: nuovo dispositivo → scarica tutto; viaggio aggiunto offline → non si
 * perde; viaggio modificato sul dispositivo più recente → vince la sua versione.
 */
export function mergeTrips(local: Trip[], localTs: number, remote: Trip[], remoteTs: number): Trip[] {
  const remoteNewer = remoteTs > localTs;
  const base = remoteNewer ? remote : local;
  const other = remoteNewer ? local : remote;
  const byId = new Map<string, Trip>();
  for (const t of base) byId.set(t.id, t);
  for (const t of other) if (!byId.has(t.id)) byId.set(t.id, t);
  return [...byId.values()];
}
