import { useGoogleDrive } from "@/lib/googleDriveContext";
import { GoogleG } from "@/components/GoogleG";
import { CoupleMapSection } from "@/components/CoupleMapSection";
import { Loader2, Check, AlertTriangle, LogOut } from "lucide-react";

function relativeTime(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 10) return "pochi secondi fa";
  if (s < 60) return `${s} secondi fa`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} ${m === 1 ? "minuto" : "minuti"} fa`;
  return new Date(ms).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function GoogleDriveSection() {
  const { status, email, lastSyncAt, errorMsg, connect, disconnect } = useGoogleDrive();

  const connected = status === "connected" || status === "syncing";

  if (connected) {
    return (
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm text-foreground">
            <GoogleG size={16} /> {email ?? "Account Google"}
          </span>
          <button
            onClick={() => disconnect()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive hover:opacity-80 transition-opacity"
          >
            <LogOut className="w-3.5 h-3.5" /> Disconnetti
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-border">
          {status === "syncing" ? (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sincronizzazione…
            </p>
          ) : (
            <p className="text-xs flex items-center gap-2" style={{ color: "#34d399" }}>
              <Check className="w-3.5 h-3.5" />
              {lastSyncAt ? `Sincronizzato · ${relativeTime(lastSyncAt)}` : "Connesso"}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            I viaggi si salvano nel tuo Google Drive a ogni modifica. Le foto restano sul dispositivo.
          </p>
        </div>

        {/* Viaggi di coppia: attivazione della mappa condivisa (fase 2a). */}
        <CoupleMapSection />
      </div>
    );
  }

  if (status === "connecting") {
    return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
  }

  // guest | expired | error
  return (
    <div className="space-y-3">
      {status === "expired" && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: "#fbbf24" }}>
          <AlertTriangle className="w-3.5 h-3.5" /> Sessione scaduta: ricollega per riprendere il backup.
        </p>
      )}
      {status === "error" && errorMsg && (
        <p role="alert" className="text-xs text-destructive flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> {errorMsg}
        </p>
      )}

      <button
        onClick={() => connect()}
        className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl text-sm font-semibold bg-white text-[#1f1f1f] hover:bg-white/90 transition-colors"
      >
        <GoogleG size={16} />
        {status === "expired" ? "Riconnetti Google Drive" : "Accedi con Google"}
      </button>

      <p className="text-xs text-muted-foreground">
        🔒 I dati restano nel tuo account Google. Nessun altro può vederli.
      </p>
    </div>
  );
}
