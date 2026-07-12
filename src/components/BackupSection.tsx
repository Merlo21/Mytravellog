import { useEffect, useState } from "react";
import { loadTrips, saveTrips, Trip } from "@/lib/storage";
import { backupNow, restoreBackup, getLastBackupInfo, isBackupStale } from "@/lib/backup";
import { Loader2, UploadCloud, DownloadCloud, AlertTriangle } from "lucide-react";

interface Props {
  userId: string;
}

export function BackupSection({ userId }: Props) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [busy, setBusy] = useState<"backup" | "restore" | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [lastBackup, setLastBackup] = useState(getLastBackupInfo());

  useEffect(() => { setTrips(loadTrips()); }, []);

  const handleBackup = async () => {
    setBusy("backup");
    setMessage(null);
    const result = await backupNow(userId, trips);
    setBusy(null);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Backup completato." });
      setLastBackup(getLastBackupInfo());
    }
  };

  const handleRestore = async () => {
    setBusy("restore");
    setMessage(null);
    const result = await restoreBackup(userId);
    setBusy(null);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    // Unione, non sovrascrittura: i viaggi locali non ancora nel backup
    // (es. aggiunti dopo l'ultimo backup) non vanno persi.
    const local = loadTrips();
    const merged = [...local];
    for (const t of result.trips ?? []) {
      if (!merged.some(lt => lt.id === t.id)) merged.push(t);
    }
    saveTrips(merged);
    setTrips(merged);
    setMessage({ type: "success", text: `Ripristinati ${result.trips?.length ?? 0} viaggi dal backup.` });
  };

  const stale = isBackupStale(trips.length);

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-border">
      <div className="text-xs text-muted-foreground">
        {lastBackup.at
          ? `Ultimo backup: ${new Date(lastBackup.at).toLocaleDateString("it-IT")}`
          : "Nessun backup ancora."}
      </div>

      {stale && (
        <p className="text-xs text-amber-500 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> È da un po' che non fai un backup.
        </p>
      )}

      {message && (
        <p role={message.type === "error" ? "alert" : undefined}
          className={`text-xs ${message.type === "error" ? "text-destructive" : "text-primary"}`}>
          {message.text}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleBackup}
          disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-primary/10 text-primary border border-primary/30 disabled:opacity-60"
        >
          {busy === "backup" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
          Fai un backup
        </button>
        <button
          onClick={handleRestore}
          disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-secondary/40 text-foreground border border-border disabled:opacity-60"
        >
          {busy === "restore" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DownloadCloud className="w-3.5 h-3.5" />}
          Ripristina
        </button>
      </div>
    </div>
  );
}
