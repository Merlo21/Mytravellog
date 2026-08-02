import { useState } from "react";
import { Heart, Loader2, Check, AlertTriangle, RefreshCw, UserPlus, Link as LinkIcon } from "lucide-react";
import { requestAccessToken, createSharedFile, SHARED_VERSION, SharedMap } from "@/lib/googleDrive";
import { sharedTrips } from "@/lib/storage";
import { setSharedFileId, sharedFileId, pushSharedMap, invitePartner, connectSharedMap } from "@/lib/coupleSync";

/**
 * "La nostra mappa" (viaggi di coppia) in Impostazioni, sotto l'account Drive.
 * Attivazione (crea il file), invito del partner (permissions.create) e
 * sincronizzazione manuale. Il sync automatico in background arriverà dopo.
 */
export function CoupleMapSection() {
  const [fileId, setFileId] = useState<string | null>(() => sharedFileId());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState<string | null>(null);
  const [inviteErr, setInviteErr] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  const [connecting, setConnecting] = useState(false);
  const [connectErr, setConnectErr] = useState<string | null>(null);

  const connect = async () => {
    setConnecting(true); setConnectErr(null);
    try {
      const ok = await connectSharedMap();
      if (ok) { setFileId(sharedFileId()); }
    } catch {
      setConnectErr("Non è stato possibile aprire il selettore. Riprova.");
    } finally { setConnecting(false); }
  };

  const enable = async () => {
    setBusy(true); setError(null);
    try {
      const { token } = await requestAccessToken(true); // consenso drive.file
      const data: SharedMap = { version: SHARED_VERSION, updatedAt: Date.now(), trips: sharedTrips() };
      const id = await createSharedFile(token, data);
      setSharedFileId(id);
      setFileId(id);
      pushSharedMap().catch(() => { /* timbra i viaggi al primo sync utile */ });
    } catch (e: any) {
      setError(e?.message === "unauthorized" || e?.message === "access_denied"
        ? "Consenso negato: serve l'accesso a Drive per la mappa condivisa."
        : "Non è stato possibile creare la mappa condivisa. Riprova.");
    } finally { setBusy(false); }
  };

  const invite = async () => {
    const e = email.trim();
    if (!e) return;
    setInviting(true); setInviteErr(null); setInvited(null);
    try {
      await invitePartner(e);
      await pushSharedMap().catch(() => {}); // così il partner trova subito i tuoi viaggi timbrati
      setInvited(e); setEmail("");
    } catch (err: any) {
      setInviteErr(/permission|email|invalid/i.test(String(err?.message))
        ? "Email non valida o non è un account Google."
        : "Invito non riuscito. Controlla l'email e riprova.");
    } finally { setInviting(false); }
  };

  const sync = async () => {
    setSyncing(true); setSynced(false);
    try { await pushSharedMap(true); setSynced(true); }
    catch { /* offline / non connesso: silenzioso */ }
    finally { setSyncing(false); }
  };

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center gap-2 mb-1">
        <Heart className="w-4 h-4" style={{ color: "#f472b6", fill: fileId ? "#f472b6" : "none" }} />
        <span className="text-sm font-semibold text-foreground">La nostra mappa</span>
      </div>

      {!fileId ? (
        <>
          <p className="text-xs text-muted-foreground mb-2">
            Crea una mappa condivisa: i viaggi che marchi col cuore verranno sincronizzati con il partner.
          </p>
          {error && (
            <p role="alert" className="text-xs text-destructive flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5" /> {error}
            </p>
          )}
          <button onClick={enable} disabled={busy}
            className="inline-flex items-center gap-2 py-2 px-3 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(244,114,182,0.14)", border: "0.5px solid rgba(244,114,182,0.4)", color: "#f9a8d4", cursor: busy ? "default" : "pointer" }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
            {busy ? "Creazione…" : "Attiva la nostra mappa"}
          </button>

          {/* Lato partner: ha ricevuto l'invito e aggancia il file col Picker. */}
          <div className="mt-3 pt-3 border-t border-border/60">
            <p className="text-xs text-muted-foreground mb-2">Hai ricevuto un invito dal partner?</p>
            {connectErr && (
              <p role="alert" className="text-xs text-destructive flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5" /> {connectErr}
              </p>
            )}
            <button onClick={connect} disabled={connecting}
              className="inline-flex items-center gap-2 py-2 px-3 rounded-xl text-sm font-semibold text-primary"
              style={{ background: "rgba(96,165,250,0.12)", border: "0.5px solid rgba(96,165,250,0.35)", cursor: connecting ? "default" : "pointer" }}>
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
              {connecting ? "Apertura…" : "Collega la mappa condivisa"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs flex items-center gap-1.5" style={{ color: "#34d399" }}>
            <Check className="w-3.5 h-3.5" /> Mappa condivisa attiva ({sharedTrips().length} viaggi tuoi condivisi)
          </p>

          {/* Invito partner */}
          <div className="mt-3">
            <label className="text-xs text-muted-foreground">Invita il partner (email Google)</label>
            <div className="flex gap-2 mt-1">
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" inputMode="email"
                placeholder="partner@gmail.com" autoComplete="off"
                className="flex-1 bg-secondary/20 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none" />
              <button onClick={invite} disabled={inviting || !email.trim()}
                className="inline-flex items-center gap-1.5 py-2 px-3 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(244,114,182,0.14)", border: "0.5px solid rgba(244,114,182,0.4)", color: "#f9a8d4", cursor: inviting || !email.trim() ? "default" : "pointer" }}>
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Invita
              </button>
            </div>
            {invited && <p className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: "#34d399" }}><Check className="w-3.5 h-3.5" /> Invitato {invited}</p>}
            {inviteErr && <p role="alert" className="text-xs text-destructive mt-1.5 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {inviteErr}</p>}
          </div>

          {/* Sync manuale */}
          <div className="mt-3 flex items-center gap-3">
            <button onClick={sync} disabled={syncing}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:opacity-80">
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sincronizza ora
            </button>
            {synced && <span className="text-xs" style={{ color: "#34d399" }}>fatto</span>}
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            Il partner riceve un invito via email; aprendo l'app potrà agganciare la mappa condivisa. Il sync automatico in background arriverà a breve.
          </p>
        </>
      )}
    </div>
  );
}
