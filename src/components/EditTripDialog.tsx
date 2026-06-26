import { useEffect, useState } from "react";
import { z } from "zod";
import { Trip, updateTrip } from "@/lib/storage";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  trip: Trip;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

const schema = z.object({
  country: z.string().trim().min(1, "Stato obbligatorio").max(100),
  city: z.string().trim().min(1, "Città obbligatoria").max(100),
  temperature_c: z.union([z.literal(""), z.coerce.number().min(-100).max(100)]),
  altitude_m: z.union([z.literal(""), z.coerce.number().min(-500).max(10000)]),
  distance_from_home_km: z.union([z.literal(""), z.coerce.number().min(0).max(50000)]),
});

export function EditTripDialog({ trip, open, onOpenChange, onSaved }: Props) {
  const [title, setTitle] = useState(trip.title);
  const [country, setCountry] = useState(trip.country);
  const [city, setCity] = useState(trip.city);
  const [temp, setTemp] = useState(trip.temperature_c?.toString() ?? "");
  const [alt, setAlt] = useState(trip.altitude_m?.toString() ?? "");
  const [dist, setDist] = useState(trip.distance_from_home_km?.toString() ?? "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset state every time the dialog opens or the trip changes
  useEffect(() => {
    if (open) {
      setTitle(trip.title);
      setCountry(trip.country);
      setCity(trip.city);
      setTemp(trip.temperature_c?.toString() ?? "");
      setAlt(trip.altitude_m?.toString() ?? "");
      setDist(trip.distance_from_home_km?.toString() ?? "");
      setDirty(false);
    }
  }, [open, trip]);

  const persist = (): boolean => {
    const parsed = schema.safeParse({ country, city, temperature_c: temp, altitude_m: alt, distance_from_home_km: dist });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Dati non validi"); return false; }
    const v = parsed.data;
    const result = updateTrip(trip.id, {
      title: title.trim() || trip.title,
      country: v.country, city: v.city,
      temperature_c: v.temperature_c === "" ? null : v.temperature_c,
      altitude_m: v.altitude_m === "" ? null : v.altitude_m,
      distance_from_home_km: v.distance_from_home_km === "" ? null : v.distance_from_home_km,
    });
    if (!result) { toast.error("Errore durante il salvataggio"); return false; }
    return true;
  };

  const handleSave = () => {
    setSaving(true);
    const ok = persist();
    setSaving(false);
    if (ok) {
      toast.success("Viaggio aggiornato ✅");
      onSaved?.();
      onOpenChange(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false); }}>
      <div className="glass-card w-full max-w-md mx-4 p-6 animate-fade-up" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">Modifica viaggio</h2>
        <div className="space-y-1.5 mb-4">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome del viaggio</label>
          <input className="input-field w-full" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Es. Weekend a Parigi, Viaggio di nozze…"/>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stato</label>
              <input className="input-base" value={country} onChange={(e) => { setCountry(e.target.value); setDirty(true); }} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Città</label>
              <input className="input-base" value={city} onChange={(e) => { setCity(e.target.value); setDirty(true); }} maxLength={100} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Temp (°C)", val: temp, set: setTemp },
              { label: "Altitudine (m)", val: alt, set: setAlt },
              { label: "Km da casa", val: dist, set: setDist },
            ].map(({ label, val, set }) => (
              <div key={label} className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
                <input type="number" className="input-base" value={val}
                  onChange={(e) => { set(e.target.value); setDirty(true); }} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={() => onOpenChange(false)} className="btn-ghost text-sm">Chiudi</button>
          <button onClick={handleSave} disabled={saving || !dirty} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-40">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salva modifiche"}
          </button>
        </div>
      </div>
    </div>
  );
}
