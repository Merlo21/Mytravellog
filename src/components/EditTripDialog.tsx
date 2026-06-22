import { useState, useEffect } from "react";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocalTrip, updateTrip } from "@/lib/storage";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";

interface Props {
  trip: LocalTrip;
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
  const [country, setCountry] = useState(trip.country);
  const [city, setCity] = useState(trip.city);
  const [temp, setTemp] = useState<string>(trip.temperature_c?.toString() ?? "");
  const [alt, setAlt] = useState<string>(trip.altitude_m?.toString() ?? "");
  const [dist, setDist] = useState<string>(trip.distance_from_home_km?.toString() ?? "");
  const [dirty, setDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Reset state when dialog opens or trip changes
  useEffect(() => {
    if (open) {
      setCountry(trip.country);
      setCity(trip.city);
      setTemp(trip.temperature_c?.toString() ?? "");
      setAlt(trip.altitude_m?.toString() ?? "");
      setDist(trip.distance_from_home_km?.toString() ?? "");
      setDirty(false);
      setSaveError(false);
    }
  }, [open, trip]);

  const rollback = () => {
    setCountry(trip.country);
    setCity(trip.city);
    setTemp(trip.temperature_c?.toString() ?? "");
    setAlt(trip.altitude_m?.toString() ?? "");
    setDist(trip.distance_from_home_km?.toString() ?? "");
    setDirty(false);
    setSaveError(false);
  };

  const persist = () => {
    const parsed = schema.safeParse({
      country, city,
      temperature_c: temp,
      altitude_m: alt,
      distance_from_home_km: dist,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dati non validi");
      return false;
    }
    const v = parsed.data;
    const result = updateTrip(trip.id, {
      country: v.country,
      city: v.city,
      temperature_c: v.temperature_c === "" ? null : v.temperature_c,
      altitude_m: v.altitude_m === "" ? null : v.altitude_m,
      distance_from_home_km: v.distance_from_home_km === "" ? null : v.distance_from_home_km,
    });
    if (!result) {
      toast.error("Errore durante il salvataggio");
      return false;
    }
    return true;
  };

  const handleOpenChange = (v: boolean) => {
    if (!v && dirty) {
      setIsSaving(true);
      setSaveError(false);
      requestAnimationFrame(() => {
        const ok = persist();
        setIsSaving(false);
        if (ok) {
          toast.success("Viaggio aggiornato", { icon: "✅" });
          onSaved?.();
          setDirty(false);
          onOpenChange(v);
        } else {
          toast.error("Salvataggio fallito. Modifiche annullate.");
          rollback();
          onOpenChange(v);
        }
      });
      return;
    }
    if (!v) setDirty(false);
    onOpenChange(v);
  };

  const handleSave = () => {
    setIsSaving(true);
    setSaveError(false);
    requestAnimationFrame(() => {
      const ok = persist();
      if (ok) {
        toast.success("Viaggio aggiornato", { icon: "✅" });
        onOpenChange(false);
        onSaved?.();
        setDirty(false);
      } else {
        setSaveError(true);
      }
      setIsSaving(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md relative overflow-hidden">
        {isSaving && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-sm font-medium text-muted-foreground">Salvataggio in corso…</p>
          </div>
        )}
        <DialogHeader>
          <DialogTitle>Modifica viaggio</DialogTitle>
          <DialogDescription>Aggiorna i dettagli di "{trip.title}".</DialogDescription>
        </DialogHeader>

        {saveError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex items-center gap-3 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <div className="flex-1">Non è stato possibile salvare le modifiche.</div>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleSave} disabled={isSaving}>
              Riprova
            </Button>
          </div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-country">Stato</Label>
              <Input id="edit-country" value={country} disabled={isSaving} onChange={(e) => { setCountry(e.target.value); setDirty(true); setSaveError(false); }} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-city">Città</Label>
              <Input id="edit-city" value={city} disabled={isSaving} onChange={(e) => { setCity(e.target.value); setDirty(true); setSaveError(false); }} maxLength={100} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-temp">Temp (°C)</Label>
              <Input id="edit-temp" type="number" step="0.1" value={temp} disabled={isSaving} onChange={(e) => { setTemp(e.target.value); setDirty(true); setSaveError(false); }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-alt">Altitudine (m)</Label>
              <Input id="edit-alt" type="number" step="1" value={alt} disabled={isSaving} onChange={(e) => { setAlt(e.target.value); setDirty(true); setSaveError(false); }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dist">Km da casa</Label>
              <Input id="edit-dist" type="number" step="1" value={dist} disabled={isSaving} onChange={(e) => { setDist(e.target.value); setDirty(true); setSaveError(false); }} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" disabled={isSaving} onClick={() => handleOpenChange(false)}>Chiudi</Button>
          <Button variant="hero" disabled={isSaving} onClick={handleSave}>
            {isSaving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvataggio…
              </span>
            ) : (
              "Salva modifiche"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
