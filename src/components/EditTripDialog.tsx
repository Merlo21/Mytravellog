import { useState } from "react";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocalTrip, updateTrip } from "@/lib/storage";
import { toast } from "sonner";

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
    updateTrip(trip.id, {
      country: v.country,
      city: v.city,
      temperature_c: v.temperature_c === "" ? null : v.temperature_c,
      altitude_m: v.altitude_m === "" ? null : v.altitude_m,
      distance_from_home_km: v.distance_from_home_km === "" ? null : v.distance_from_home_km,
    });
    return true;
  };

  const handleOpenChange = (v: boolean) => {
    if (!v && dirty) {
      if (persist()) {
        toast.success("Viaggio aggiornato");
        onSaved?.();
      }
      setDirty(false);
    }
    onOpenChange(v);
  };

  const handleSave = () => {
    if (persist()) {
      toast.success("Viaggio aggiornato");
      onOpenChange(false);
      onSaved?.();
      setDirty(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Modifica viaggio</DialogTitle>
          <DialogDescription>Aggiorna i dettagli di "{trip.title}".</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-country">Stato</Label>
              <Input id="edit-country" value={country} onChange={(e) => { setCountry(e.target.value); setDirty(true); }} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-city">Città</Label>
              <Input id="edit-city" value={city} onChange={(e) => { setCity(e.target.value); setDirty(true); }} maxLength={100} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-temp">Temp (°C)</Label>
              <Input id="edit-temp" type="number" step="0.1" value={temp} onChange={(e) => { setTemp(e.target.value); setDirty(true); }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-alt">Altitudine (m)</Label>
              <Input id="edit-alt" type="number" step="1" value={alt} onChange={(e) => { setAlt(e.target.value); setDirty(true); }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dist">Km da casa</Label>
              <Input id="edit-dist" type="number" step="1" value={dist} onChange={(e) => { setDist(e.target.value); setDirty(true); }} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Chiudi</Button>
          <Button variant="hero" onClick={handleSave}>Salva modifiche</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
