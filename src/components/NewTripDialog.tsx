import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MapPin, Home, Search, Loader2, Thermometer, Mountain, Route } from "lucide-react";
import { searchPlaces, fetchElevation, fetchTemperature, distanceKm, GeoResult, countryFlag } from "@/lib/geo";
import { addTrip } from "@/lib/storage";
import { toast } from "sonner";
import { useSettings, formatDistanceKm, formatAltitudeM, formatTemperatureC } from "@/lib/settings";

interface Props {
  onCreated: () => void;
  defaultHome?: { lat: number; lon: number; label: string } | null;
}

export function NewTripDialog({ onCreated, defaultHome }: Props) {
  const { distanceUnit, temperatureUnit } = useSettings();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const [destQuery, setDestQuery] = useState("");
  const [destResults, setDestResults] = useState<GeoResult[]>([]);
  const [dest, setDest] = useState<GeoResult | null>(null);

  const [homeQuery, setHomeQuery] = useState(defaultHome?.label ?? "");
  const [homeResults, setHomeResults] = useState<GeoResult[]>([]);
  const [home, setHome] = useState<{ lat: number; lon: number; label: string } | null>(defaultHome ?? null);

  const [title, setTitle] = useState("");
  const [tripDate, setTripDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const [preview, setPreview] = useState<{ temp: number | null; alt: number | null; dist: number | null }>({
    temp: null, alt: null, dist: null,
  });

  useEffect(() => {
    if (!open) {
      setStep(1); setDest(null); setDestQuery(""); setDestResults([]);
      setTitle(""); setNotes(""); setPreview({ temp: null, alt: null, dist: null });
      // keep home as default for next time
      if (defaultHome) { setHome(defaultHome); setHomeQuery(defaultHome.label); }
    }
  }, [open, defaultHome]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (destQuery.length < 2) { setDestResults([]); return; }
      setSearching(true);
      const r = await searchPlaces(destQuery);
      setDestResults(r);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [destQuery]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (homeQuery.length < 2 || home?.label === homeQuery) { setHomeResults([]); return; }
      const r = await searchPlaces(homeQuery);
      setHomeResults(r);
    }, 300);
    return () => clearTimeout(t);
  }, [homeQuery, home?.label]);

  const pickDest = (p: GeoResult) => {
    setDest(p);
    setDestResults([]);
    setDestQuery(`${p.name}, ${p.country}`);
    setTitle(`Viaggio a ${p.name}`);
  };

  const pickHome = (p: GeoResult) => {
    const h = { lat: p.latitude, lon: p.longitude, label: `${p.name}, ${p.country}` };
    setHome(h);
    setHomeResults([]);
    setHomeQuery(h.label);
  };

  const goToStep2 = async () => {
    if (!dest) return;
    setStep(2);
    const [alt, temp] = await Promise.all([
      fetchElevation(dest.latitude, dest.longitude),
      fetchTemperature(dest.latitude, dest.longitude, tripDate),
    ]);
    setPreview((p) => ({ ...p, alt, temp }));
  };

  useEffect(() => {
    if (dest && home) {
      setPreview((p) => ({ ...p, dist: distanceKm(home.lat, home.lon, dest.latitude, dest.longitude) }));
    }
  }, [home, dest]);

  useEffect(() => {
    if (step === 2 && dest) {
      fetchTemperature(dest.latitude, dest.longitude, tripDate).then((temp) =>
        setPreview((p) => ({ ...p, temp })),
      );
    }
  }, [tripDate, step, dest]);

  const save = () => {
    if (!dest || !home) {
      toast.error("Seleziona destinazione e punto di partenza");
      return;
    }
    setSaving(true);
    try {
      addTrip({
        title: title.trim() || `Viaggio a ${dest.name}`,
        country: dest.country,
        city: dest.name,
        trip_date: tripDate,
        notes: notes.trim() || null,
        latitude: dest.latitude,
        longitude: dest.longitude,
        home_latitude: home.lat,
        home_longitude: home.lon,
        home_label: home.label,
        temperature_c: preview.temp,
        altitude_m: preview.alt,
        distance_from_home_km: preview.dist,
        country_code: dest.country_code,
      });
      toast.success("Viaggio aggiunto al tuo atlante ✈️");
      setOpen(false);
      onCreated();
    } catch (e: any) {
      toast.error(e.message ?? "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="hero" size="lg" className="gap-2">
          <Plus className="w-5 h-5" /> Nuovo viaggio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {step === 1 ? "Dove sei stato?" : "Dettagli del viaggio"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? "Cerca la città visitata." : "Completa con la partenza e i dettagli."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                autoFocus
                value={destQuery}
                onChange={(e) => { setDestQuery(e.target.value); setDest(null); }}
                placeholder="Es. Tokyo, Reykjavik, Cusco..."
                className="pl-10"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
            {destResults.length > 0 && (
              <div className="border border-border rounded-xl divide-y divide-border max-h-64 overflow-auto scrollbar-thin">
                {destResults.map((p) => (
                  <button
                    key={`${p.id}-${p.latitude}`}
                    onClick={() => pickDest(p)}
                    className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition flex items-center gap-3"
                  >
                    <span className="text-xl">{countryFlag(p.country_code)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.admin1 ? `${p.admin1}, ` : ""}{p.country}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button onClick={goToStep2} disabled={!dest} variant="hero" className="gap-2">
                Avanti <MapPin className="w-4 h-4" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 2 && dest && (
          <div className="space-y-4">
            <div className="glass-card p-4 flex items-center gap-3">
              <span className="text-3xl">{countryFlag(dest.country_code)}</span>
              <div className="flex-1">
                <div className="font-semibold">{dest.name}</div>
                <div className="text-xs text-muted-foreground">{dest.country}</div>
              </div>
              <button onClick={() => setStep(1)} className="text-xs text-primary hover:underline">cambia</button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Metric icon={<Thermometer className="w-4 h-4" />} label="Temp" value={formatTemperatureC(preview.temp, temperatureUnit)} />
              <Metric icon={<Mountain className="w-4 h-4" />} label="Altitudine" value={formatAltitudeM(preview.alt, distanceUnit)} />
              <Metric icon={<Route className="w-4 h-4" />} label="Distanza" value={formatDistanceKm(preview.dist, distanceUnit)} />
            </div>

            <div className="space-y-2">
              <Label>Titolo del viaggio</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Home className="w-3.5 h-3.5" /> Da dove parti?</Label>
                <Input
                  value={homeQuery}
                  onChange={(e) => { setHomeQuery(e.target.value); setHome(null); }}
                  placeholder="Casa / origine"
                />
              </div>
            </div>
            {homeResults.length > 0 && (
              <div className="border border-border rounded-xl divide-y divide-border max-h-40 overflow-auto scrollbar-thin -mt-2">
                {homeResults.map((p) => (
                  <button
                    key={`${p.id}-${p.latitude}`}
                    onClick={() => pickHome(p)}
                    className="w-full text-left px-4 py-2 hover:bg-muted/50 transition flex items-center gap-3 text-sm"
                  >
                    <span>{countryFlag(p.country_code)}</span>
                    <span>{p.name}, {p.country}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label>Note (opzionale)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cosa ricordi di questo posto?" />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setStep(1)}>Indietro</Button>
              <Button onClick={save} disabled={saving || !home} variant="hero">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salva viaggio"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
        {icon} {label}
      </div>
      <div className="font-mono font-semibold text-sm">{value}</div>
    </div>
  );
}
