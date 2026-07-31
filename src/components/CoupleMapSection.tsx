import { useState } from "react";
import { Heart, Loader2, Check, AlertTriangle } from "lucide-react";
import { requestAccessToken, createSharedFile, SHARED_VERSION, SharedMap } from "@/lib/googleDrive";
import { sharedTrips } from "@/lib/storage";

const LS_SHARED_FILE = "atlas.shared.fileId";

/**
 * "La nostra mappa" (viaggi di coppia) — sezione in Impostazioni, sotto l'account
 * Drive. FASE 2a: solo attivazione — crea il file condiviso in Drive normale
 * (richiede il consenso allo scope drive.file) e ne salva l'id. Invito al
 * partner, Picker e sync live arrivano nelle fasi successive.
 */
export function CoupleMapSection() {
  const [fileId, setFileId] = useState<string | null>(() => localStorage.getItem(LS_SHARED_FILE));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enable = async () => {
    setBusy(true); setError(null);
    try {
      const { token } = await requestAccessToken(true); // interattivo: chiede il consenso drive.file
      const data: SharedMap = { version: SHARED_VERSION, updatedAt: Date.now(), trips: sharedTrips() };
      const id = await createSharedFile(token, data);
      localStorage.setItem(LS_SHARED_FILE, id);
      setFileId(id);
    } catch (e: any) {
      setError(e?.message === "unauthorized" || e?.message === "access_denied"
        ? "Consenso negato: serve l'accesso a Drive per la mappa condivisa."
        : "Non è stato possibile creare la mappa condivisa. Riprova.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center gap-2 mb-1">
        <Heart className="w-4 h-4" style={{ color: "#f472b6", fill: fileId ? "#f472b6" : "none" }} />
        <span className="text-sm font-semibold text-foreground">La nostra mappa</span>
      </div>

      {fileId ? (
        <>
          <p className="text-xs flex items-center gap-1.5" style={{ color: "#34d399" }}>
            <Check className="w-3.5 h-3.5" /> Mappa condivisa attiva ({sharedTrips().length} viaggi condivisi)
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Invito del partner e sincronizzazione live in arrivo. Il file <code>navta-shared-map.json</code> è nel tuo Google Drive.
          </p>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-2">
            Crea una mappa condivisa: i viaggi che marchi col cuore verranno sincronizzati con il partner.
          </p>
          {error && (
            <p role="alert" className="text-xs text-destructive flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5" /> {error}
            </p>
          )}
          <button
            onClick={enable}
            disabled={busy}
            className="inline-flex items-center gap-2 py-2 px-3 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: "rgba(244,114,182,0.14)", border: "0.5px solid rgba(244,114,182,0.4)", color: "#f9a8d4", cursor: busy ? "default" : "pointer" }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
            {busy ? "Creazione…" : "Attiva la nostra mappa"}
          </button>
        </>
      )}
    </div>
  );
}
