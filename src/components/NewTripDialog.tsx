import { useEffect, useState } from "react";
import { searchPlaces, fetchElevation, fetchTemperature, distanceKm, countryFlag, GeoResult } from "@/lib/geo";
import { addTrip } from "@/lib/storage";
import { fmtDistance, fmtAltitude, fmtTemp, useSettings } from "@/lib/settings";
import { toast } from "sonner";
import { Plus, Search, Loader2, MapPin, Home, Thermometer, Mountain, Route, Plane, Train, Car, Ship, Footprints, X } from "lucide-react";

interface PrefilledCity {
  name: string;
  country: string;
  country_code: string;
  latitude: number;
  longitude: number;
}

interface Props {
  onCreated: () => void;
  defaultHome?: { lat: number; lon: number; label: string } | null;
  prefilledCity?: PrefilledCity | null;
  triggerLabel?: string;
}

export function NewTripDialog({ onCreated, defaultHome, prefilledCity, triggerLabel }: Props) {
  const { distanceUnit, temperatureUnit } = useSettings();
  const [open, setOpen] = useState(false);

  // Auto-open and pre-fill when a city is passed from the globe
  useEffect(() => {
    if (prefilledCity) {
      setOpen(true);
      setDest({
        id: 0,
        name: prefilledCity.name,
        country: prefilledCity.country,
        country_code: prefilledCity.country_code,
        latitude: prefilledCity.latitude,
        longitude: prefilledCity.longitude,
      });
      setTitle(`Viaggio a ${prefilledCity.name}`);
      setStep(2);
      const today = new Date().toISOString().slice(0, 10);
      Promise.all([
        fetchElevation(prefilledCity.latitude, prefilledCity.longitude),
        fetchTemperature(prefilledCity.latitude, prefilledCity.longitude, today),
      ]).then(([alt, temp]) => {
        setPreview((p) => ({ ...p, alt, temp }));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledCity]);
  const [step, setStep] = useState<1 | 2>(1);

  const [destQuery, setDestQuery] = useState("");
  const [destResults, setDestResults] = useState<GeoResult[]>([]);
  const [dest, setDest] = useState<GeoResult | null>(null);
  const [searching, setSearching] = useState(false);

  const [homeQuery, setHomeQuery] = useState(defaultHome?.label ?? "");
  const [homeResults, setHomeResults] = useState<GeoResult[]>([]);
  const [home, setHome] = useState<{ lat: number; lon: number; label: string } | null>(defaultHome ?? null);

  const [title, setTitle] = useState("");
  const [tripDate, setTripDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [transportMode, setTransportMode] = useState<"plane"|"train"|"car"|"ship"|"walk"|null>(null);
  const [waypoints, setWaypoints] = useState<{city:string;country:string;transport_mode:"plane"|"train"|"car"|"ship"|"walk"}[]>([]);
  const [wpSearch, setWpSearch] = useState("");
  const [wpResults, setWpResults] = useState<any[]>([]);
  const [wpTransport, setWpTransport] = useState<"plane"|"train"|"car"|"ship"|"walk">("plane");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ temp: number | null; alt: number | null; dist: number | null }>({ temp: null, alt: null, dist: null });

  // Sync homeQuery when defaultHome becomes available after first trip
  useEffect(() => {
    if (defaultHome && !home) {
      setHome(defaultHome);
      setHomeQuery(defaultHome.label);
    }
  }, [defaultHome]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1); setDest(null); setDestQuery(""); setDestResults([]);
      setTitle(""); setNotes(""); setPreview({ temp: null, alt: null, dist: null });
      if (defaultHome) { setHome(defaultHome); setHomeQuery(defaultHome.label); }
    }
  }, [open, defaultHome]);

  // Destination autocomplete
  useEffect(() => {
    const t = setTimeout(async () => {
      if (destQuery.length < 2) { setDestResults([]); return; }
      setSearching(true);
      setDestResults(await searchPlaces(destQuery));
      setSearching(false);
    }, 300);
    const searchWaypoint = async (q: string) => {
    if (q.length < 2) { setWpResults([]); return; }
    const res = await searchPlaces(q);
    setWpResults(res.slice(0, 5));
  };

  const addWaypoint = (r: any) => {
    setWaypoints(prev => [...prev, { city: r.name, country: r.country, transport_mode: wpTransport }]);
    setWpSearch(""); setWpResults([]);
  };

  const removeWaypoint = (i: number) => setWaypoints(prev => prev.filter((_, idx) => idx !== i));

  const TRANSPORT_OPTIONS: { value: "plane"|"train"|"car"|"ship"|"walk"; label: string; icon: JSX.Element }[] = [
    { value: "plane", label: "Aereo",  icon: <Plane className="w-4 h-4"/> },
    { value: "train", label: "Treno",  icon: <Train className="w-4 h-4"/> },
    { value: "car",   label: "Auto",   icon: <Car className="w-4 h-4"/> },
    { value: "ship",  label: "Nave",   icon: <Ship className="w-4 h-4"/> },
    { value: "walk",  label: "A piedi",icon: <Footprints className="w-4 h-4"/> },
  ];

  return () => clearTimeout(t);
  }, [destQuery]);

  // Home autocomplete
  useEffect(() => {
    const t = setTimeout(async () => {
      if (homeQuery.length < 2 || home?.label === homeQuery) { setHomeResults([]); return; }
      setHomeResults(await searchPlaces(homeQuery));
    }, 300);
    const searchWaypoint = async (q: string) => {
    if (q.length < 2) { setWpResults([]); return; }
    const res = await searchPlaces(q);
    setWpResults(res.slice(0, 5));
  };

  const addWaypoint = (r: any) => {
    setWaypoints(prev => [...prev, { city: r.name, country: r.country, transport_mode: wpTransport }]);
    setWpSearch(""); setWpResults([]);
  };

  const removeWaypoint = (i: number) => setWaypoints(prev => prev.filter((_, idx) => idx !== i));

  const TRANSPORT_OPTIONS: { value: "plane"|"train"|"car"|"ship"|"walk"; label: string; icon: JSX.Element }[] = [
    { value: "plane", label: "Aereo",  icon: <Plane className="w-4 h-4"/> },
    { value: "train", label: "Treno",  icon: <Train className="w-4 h-4"/> },
    { value: "car",   label: "Auto",   icon: <Car className="w-4 h-4"/> },
    { value: "ship",  label: "Nave",   icon: <Ship className="w-4 h-4"/> },
    { value: "walk",  label: "A piedi",icon: <Footprints className="w-4 h-4"/> },
  ];

  return () => clearTimeout(t);
  }, [homeQuery, home?.label]);

  // Distance preview
  useEffect(() => {
    if (dest && home) setPreview((p) => ({ ...p, dist: distanceKm(home.lat, home.lon, dest.latitude, dest.longitude) }));
  }, [home, dest]);

  // Temperature re-fetch when date changes (step 2)
  useEffect(() => {
    if (step === 2 && dest) {
      fetchTemperature(dest.latitude, dest.longitude, tripDate).then((temp) => setPreview((p) => ({ ...p, temp })));
    }
  }, [tripDate, step, dest]);

  const pickDest = (p: GeoResult) => {
    setDest(p); setDestResults([]);
    setDestQuery(`${p.name}, ${p.country}`);
    setTitle(`Viaggio a ${p.name}`);
  };

  const pickHome = (p: GeoResult) => {
    const h = { lat: p.latitude, lon: p.longitude, label: `${p.name}, ${p.country}` };
    setHome(h); setHomeResults([]); setHomeQuery(h.label);
  };

  const goStep2 = async () => {
    if (!dest) return;
    setStep(2);
    const [alt, temp] = await Promise.all([
      fetchElevation(dest.latitude, dest.longitude),
      fetchTemperature(dest.latitude, dest.longitude, tripDate),
    ]);
    setPreview((p) => ({ ...p, alt, temp }));
  };

  const save = () => {
    if (!dest || !home) { toast.error("Seleziona destinazione e punto di partenza"); return; }
    setSaving(true);
    try {
      addTrip({
        title: title.trim() || `Viaggio a ${dest.name}`,
        country: dest.country,
        city: dest.name,
        trip_date: tripDate,
        notes: notes.trim() || null,
      transport_mode: transportMode,
      waypoints,
        latitude: dest.latitude,
        longitude: dest.longitude,
        home_latitude: home.lat,
        home_longitude: home.lon,
        home_label: home.label,
        temperature_c: preview.temp,
        altitude_m: preview.alt,
        distance_from_home_km: preview.dist,
        country_code: dest.country_code ?? "",
      });
      toast.success("Viaggio aggiunto ✈️");
      setOpen(false);
      onCreated();
    } catch (e: any) {
      toast.error(e.message ?? "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    const searchWaypoint = async (q: string) => {
    if (q.length < 2) { setWpResults([]); return; }
    const res = await searchPlaces(q);
    setWpResults(res.slice(0, 5));
  };

  const addWaypoint = (r: any) => {
    setWaypoints(prev => [...prev, { city: r.name, country: r.country, transport_mode: wpTransport }]);
    setWpSearch(""); setWpResults([]);
  };

  const removeWaypoint = (i: number) => setWaypoints(prev => prev.filter((_, idx) => idx !== i));

  const TRANSPORT_OPTIONS: { value: "plane"|"train"|"car"|"ship"|"walk"; label: string; icon: JSX.Element }[] = [
    { value: "plane", label: "Aereo",  icon: <Plane className="w-4 h-4"/> },
    { value: "train", label: "Treno",  icon: <Train className="w-4 h-4"/> },
    { value: "car",   label: "Auto",   icon: <Car className="w-4 h-4"/> },
    { value: "ship",  label: "Nave",   icon: <Ship className="w-4 h-4"/> },
    { value: "walk",  label: "A piedi",icon: <Footprints className="w-4 h-4"/> },
  ];

  return (
      <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2 w-full justify-center">
        <Plus className="w-4 h-4" /> {triggerLabel || "Nuovo viaggio"}
      </button>
    );
  }

  const searchWaypoint = async (q: string) => {
    if (q.length < 2) { setWpResults([]); return; }
    const res = await searchPlaces(q);
    setWpResults(res.slice(0, 5));
  };

  const addWaypoint = (r: any) => {
    setWaypoints(prev => [...prev, { city: r.name, country: r.country, transport_mode: wpTransport }]);
    setWpSearch(""); setWpResults([]);
  };

  const removeWaypoint = (i: number) => setWaypoints(prev => prev.filter((_, idx) => idx !== i));

  const TRANSPORT_OPTIONS: { value: "plane"|"train"|"car"|"ship"|"walk"; label: string; icon: JSX.Element }[] = [
    { value: "plane", label: "Aereo",  icon: <Plane className="w-4 h-4"/> },
    { value: "train", label: "Treno",  icon: <Train className="w-4 h-4"/> },
    { value: "car",   label: "Auto",   icon: <Car className="w-4 h-4"/> },
    { value: "ship",  label: "Nave",   icon: <Ship className="w-4 h-4"/> },
    { value: "walk",  label: "A piedi",icon: <Footprints className="w-4 h-4"/> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="glass-card w-full max-w-md mx-4 p-6 animate-fade-up">
        <h2 className="text-xl font-bold mb-1">{step === 1 ? "Dove sei stato?" : "Dettagli del viaggio"}</h2>
        <p className="text-sm text-muted-foreground mb-5">{step === 1 ? "Cerca la città visitata." : "Completa con partenza e dettagli."}</p>

        {step === 1 && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input autoFocus className="input-base pl-10" value={destQuery}
                onChange={(e) => { setDestQuery(e.target.value); setDest(null); }}
                placeholder="Es. Tokyo, Reykjavik, Cusco..." />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
            {destResults.length > 0 && (
              <div className="border border-border rounded-xl divide-y divide-border max-h-56 overflow-auto">
                {destResults.map((p) => (
                  <button key={`${p.id}-${p.latitude}`} onClick={() => pickDest(p)}
                    className="w-full text-left px-4 py-2.5 hover:bg-secondary/60 transition flex items-center gap-3">
                    <span className="text-xl">{countryFlag(p.country_code)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.admin1 ? `${p.admin1}, ` : ""}{p.country}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="btn-ghost text-sm">Annulla</button>
              <button onClick={goStep2} disabled={!dest} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-40">
                Avanti <MapPin className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && dest && (
          <div className="space-y-4">
            <div className="glass-card p-3 flex items-center gap-3">
              <span className="text-2xl">{countryFlag(dest.country_code)}</span>
              <div className="flex-1">
                <div className="font-semibold text-sm">{dest.name}</div>
                <div className="text-xs text-muted-foreground">{dest.country}</div>
              </div>
              <button onClick={() => setStep(1)} className="text-xs text-primary hover:underline">cambia</button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: <Thermometer className="w-3.5 h-3.5" />, label: "Temp", value: fmtTemp(preview.temp, temperatureUnit) },
                { icon: <Mountain className="w-3.5 h-3.5" />, label: "Altitudine", value: fmtAltitude(preview.alt, distanceUnit) },
                { icon: <Route className="w-3.5 h-3.5" />, label: "Distanza", value: fmtDistance(preview.dist, distanceUnit) },
              ].map(({ icon, label, value }) => (
                <div key={label} className="rounded-xl border border-border bg-muted/30 p-2.5">
                  <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">{icon} {label}</div>
                  <div className="font-mono font-semibold text-sm">{value}</div>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Titolo</label>
              <input className="input-base" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</label>
                <input type="date" className="input-base" value={tripDate} onChange={(e) => setTripDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Home className="w-3 h-3" /> Da dove?</label>
                <input className="input-base" value={homeQuery} onChange={(e) => { setHomeQuery(e.target.value); setHome(null); }} placeholder="Casa / origine" />
              </div>
            </div>

            {homeResults.length > 0 && (
              <div className="border border-border rounded-xl divide-y divide-border max-h-36 overflow-auto -mt-2">
                {homeResults.map((p) => (
                  <button key={`${p.id}-${p.latitude}`} onClick={() => pickHome(p)}
                    className="w-full text-left px-4 py-2 hover:bg-secondary/60 transition flex items-center gap-3 text-sm">
                    <span>{countryFlag(p.country_code)}</span>
                    <span>{p.name}, {p.country}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Note (opzionale)</label>
              <textarea className="input-base resize-none" rows={2} value={notes}
                onChange={(e) => setNotes(e.target.value)} placeholder="Cosa ricordi di questo posto?" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setStep(1)} className="btn-ghost text-sm">Indietro</button>
              <button onClick={save} disabled={saving || !home} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-40">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salva viaggio"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
