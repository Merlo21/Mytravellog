import { useGoogleDrive } from "@/lib/googleDriveContext";
import { Loader2, Check, AlertTriangle, LogOut } from "lucide-react";

/** "G" di Google (multicolore) per il pulsante di accesso. */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.1 14.6 2 12 2 6.9 2 2.8 6.1 2.8 12S6.9 22 12 22c6.1 0 9.2-4.3 9.2-9.3 0-.6-.1-1-.2-1.5H12z" />
    </svg>
  );
}

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
            <GoogleG className="w-4 h-4" /> {email ?? "Account Google"}
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
        <GoogleG className="w-4 h-4" />
        {status === "expired" ? "Riconnetti Google Drive" : "Accedi con Google"}
      </button>

      <p className="text-xs text-muted-foreground">
        Cartella nascosta riservata all'app: NAV·TA non vede gli altri tuoi file su Drive.
      </p>
    </div>
  );
}
