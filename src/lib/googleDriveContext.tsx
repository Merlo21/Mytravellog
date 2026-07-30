import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { loadTrips, saveTrips, loadPlans, savePlans } from "@/lib/storage";
import {
  BACKUP_VERSION, requestAccessToken, revokeAccessToken, fetchUserEmail,
  readBackup, writeBackup, mergeTrips, clearDriveCache,
} from "@/lib/googleDrive";

export type DriveStatus = "guest" | "connecting" | "connected" | "syncing" | "expired" | "error";

// Impronta locale per il rilevamento delle modifiche: include SIA i viaggi SIA
// i piani, così anche una modifica ai piani in programma fa scattare un push.
const localSnapshot = () => JSON.stringify({ t: loadTrips(), p: loadPlans() });

interface DriveContextValue {
  status: DriveStatus;
  email: string | null;
  lastSyncAt: number | null;
  errorMsg: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const DriveContext = createContext<DriveContextValue | null>(null);

const LS_CONNECTED = "navta.drive.connected"; // "1" se l'utente ha collegato Drive
const LS_TS = "navta.drive.localTs";          // ms dell'ultima modifica locale nota

/**
 * Provider del backup automatico su Google Drive. Monta il motore di sync a
 * livello app (così cattura le modifiche fatte in ogni pagina): al collegamento
 * scarica+unisce+ricarica; poi un watcher leggero (ogni 4s, solo a scheda
 * visibile) ricarica su Drive quando i viaggi cambiano; ripush anche quando la
 * scheda passa in background. Al riavvio prova a riconnettersi in silenzio.
 */
export function GoogleDriveProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DriveStatus>("guest");
  const [email, setEmail] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const tokenRef = useRef<{ token: string; exp: number } | null>(null);
  const syncedHashRef = useRef<string>("");
  const busyRef = useRef(false);
  const intervalRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const getLocalTs = () => Number(localStorage.getItem(LS_TS) || 0);
  const setLocalTs = (v: number) => { try { localStorage.setItem(LS_TS, String(v)); } catch { /* quota */ } };

  // Token valido in cache finché non è vicino alla scadenza; altrimenti ne
  // richiede uno nuovo (silenzioso o interattivo).
  const ensureToken = async (interactive: boolean): Promise<string | null> => {
    const now = Date.now();
    const cur = tokenRef.current;
    if (cur && cur.exp - 60_000 > now) return cur.token;
    try {
      const { token, expiresIn } = await requestAccessToken(interactive);
      tokenRef.current = { token, exp: now + expiresIn * 1000 };
      return token;
    } catch { return null; }
  };

  const toExpired = () => {
    stopWatcher();
    tokenRef.current = null;
    if (mountedRef.current) setStatus("expired");
  };

  const pushLocal = async () => {
    const token = await ensureToken(false);
    if (!token) { toExpired(); return; }
    const trips = loadTrips();
    const plans = loadPlans();
    const now = Date.now();
    try {
      await writeBackup(token, { version: BACKUP_VERSION, updatedAt: now, trips, plans });
      setLocalTs(now);
      syncedHashRef.current = localSnapshot();
      if (mountedRef.current) { setLastSyncAt(now); setStatus("connected"); }
    } catch (e: any) {
      if (String(e?.message) === "unauthorized") toExpired();
      else if (mountedRef.current) setStatus("connected"); // errore transitorio: riproverà il watcher
    }
  };

  const initialSync = async (token: string) => {
    if (mountedRef.current) setStatus("syncing");
    const remote = await readBackup(token); // può lanciare "unauthorized"
    const local = loadTrips();
    const localPlans = loadPlans();
    const now = Date.now();
    const merged = remote && Array.isArray(remote.trips)
      ? mergeTrips(local, getLocalTs(), remote.trips, remote.updatedAt || 0)
      : local;
    const mergedPlans = remote && Array.isArray(remote.plans)
      ? mergeTrips(localPlans, getLocalTs(), remote.plans, remote.updatedAt || 0)
      : localPlans;
    saveTrips(merged);
    savePlans(mergedPlans);
    await writeBackup(token, { version: BACKUP_VERSION, updatedAt: now, trips: merged, plans: mergedPlans });
    setLocalTs(now);
    syncedHashRef.current = localSnapshot();
    if (mountedRef.current) { setLastSyncAt(now); setStatus("connected"); }
  };

  const stopWatcher = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };
  const startWatcher = () => {
    stopWatcher();
    intervalRef.current = window.setInterval(() => {
      if (document.hidden || busyRef.current) return;
      if (localSnapshot() === syncedHashRef.current) return; // niente di nuovo
      busyRef.current = true;
      if (mountedRef.current) setStatus("syncing");
      pushLocal().finally(() => { busyRef.current = false; });
    }, 4000);
  };

  const connect = async () => {
    setErrorMsg(null);
    setStatus("connecting");
    const token = await ensureToken(true);
    if (!token) {
      setStatus(localStorage.getItem(LS_CONNECTED) === "1" ? "expired" : "guest");
      setErrorMsg("Connessione annullata o non riuscita.");
      return;
    }
    localStorage.setItem(LS_CONNECTED, "1");
    const em = await fetchUserEmail(token);
    if (mountedRef.current) setEmail(em);
    try { await initialSync(token); startWatcher(); }
    catch (e: any) {
      if (String(e?.message) === "unauthorized") toExpired();
      else if (mountedRef.current) { setStatus("error"); setErrorMsg("Sincronizzazione non riuscita."); }
    }
  };

  const disconnect = async () => {
    stopWatcher();
    if (tokenRef.current) revokeAccessToken(tokenRef.current.token);
    tokenRef.current = null;
    clearDriveCache(); // l'id del file appartiene all'account appena scollegato
    localStorage.removeItem(LS_CONNECTED);
    if (mountedRef.current) { setEmail(null); setLastSyncAt(null); setErrorMsg(null); setStatus("guest"); }
  };

  useEffect(() => {
    mountedRef.current = true;

    // Riconnessione silenziosa al riavvio se in passato era collegato.
    if (localStorage.getItem(LS_CONNECTED) === "1") {
      setStatus("connecting");
      (async () => {
        const token = await ensureToken(false);
        if (!token) { if (mountedRef.current) setStatus("expired"); return; }
        const em = await fetchUserEmail(token);
        if (mountedRef.current) setEmail(em);
        try { await initialSync(token); startWatcher(); }
        catch { toExpired(); }
      })();
    }

    // Salvataggio anche quando si lascia la scheda (chiusura app inclusa).
    const onVisibility = () => {
      if (!document.hidden || localStorage.getItem(LS_CONNECTED) !== "1" || busyRef.current) return;
      if (localSnapshot() === syncedHashRef.current) return;
      busyRef.current = true;
      pushLocal().finally(() => { busyRef.current = false; });
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      stopWatcher();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DriveContext.Provider value={{ status, email, lastSyncAt, errorMsg, connect, disconnect }}>
      {children}
    </DriveContext.Provider>
  );
}

export function useGoogleDrive(): DriveContextValue {
  const ctx = useContext(DriveContext);
  if (!ctx) throw new Error("useGoogleDrive deve stare dentro <GoogleDriveProvider>");
  return ctx;
}
