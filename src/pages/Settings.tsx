// [FROZEN] — Non modificare senza esplicita richiesta
import { AppHeader } from "@/components/AppHeader";
import { Link } from "react-router-dom";
import { ArrowLeft, MapPin, Search, X } from "lucide-react";
import { useSettings, DistanceUnit, TemperatureUnit, AutoRotate, HomeCity, MARKER_SCALE_MIN, MARKER_SCALE_MAX } from "@/lib/settings";
import { searchPlaces, GeoResult } from "@/lib/geo";
import { useState, useEffect, useMemo } from "react";
import { AlertCircle, UserCircle } from "lucide-react";
import { AccountSection } from "@/components/AccountSection";

type MarkerScaleControlsProps = {
  min: number;
  max: number;
  onChangeMin: (v: number) => void;
  onChangeMax: (v: number) => void;
};

function MarkerScaleControls({ min, max, onChangeMin, onChangeMax }: MarkerScaleControlsProps) {
  const [minText, setMinText] = useState(String(min));
  const [maxText, setMaxText] = useState(String(max));

  useEffect(() => { setMinText(String(min)); }, [min]);
  useEffect(() => { setMaxText(String(max)); }, [max]);

  const validate = (raw: string): { value: number | null; error: string | null } => {
    const trimmed = raw.trim();
    if (trimmed === "") return { value: null, error: "Valore richiesto" };
    const n = Number(trimmed.replace(",", "."));
    if (!Number.isFinite(n)) return { value: null, error: "Non è un numero valido" };
    if (n < MARKER_SCALE_MIN || n > MARKER_SCALE_MAX) {
      return { value: n, error: `Fuori range (${MARKER_SCALE_MIN}–${MARKER_SCALE_MAX})` };
    }
    return { value: n, error: null };
  };

  const minCheck = useMemo(() => validate(minText), [minText]);
  const maxCheck = useMemo(() => validate(maxText), [maxText]);
  const orderError = useMemo(() => {
    if (minCheck.value != null && maxCheck.value != null && minCheck.value > maxCheck.value) {
      return "Il valore minimo non può superare il massimo";
    }
    return null;
  }, [minCheck.value, maxCheck.value]);

  const commit = (which: "min" | "max", raw: string) => {
    const { value, error } = validate(raw);
    if (value == null || error) return;
    if (which === "min") onChangeMin(value);
    else onChangeMax(value);
  };

  const inputCls = (hasError: boolean) =>
    `w-full bg-secondary/20 border rounded-xl px-3 py-2.5 text-sm outline-none transition-colors ${
      hasError ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
    }`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Minimo</label>
          <input
            type="number"
            step={0.1}
            min={MARKER_SCALE_MIN}
            max={MARKER_SCALE_MAX}
            value={minText}
            onChange={(e) => setMinText(e.target.value)}
            onBlur={(e) => commit("min", e.target.value)}
            aria-invalid={!!minCheck.error}
            aria-describedby="min-scale-error"
            className={inputCls(!!minCheck.error)}
          />
          {minCheck.error && (
            <p id="min-scale-error" role="alert" className="mt-1.5 text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3"/> {minCheck.error}
            </p>
          )}
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Massimo</label>
          <input
            type="number"
            step={0.1}
            min={MARKER_SCALE_MIN}
            max={MARKER_SCALE_MAX}
            value={maxText}
            onChange={(e) => setMaxText(e.target.value)}
            onBlur={(e) => commit("max", e.target.value)}
            aria-invalid={!!maxCheck.error}
            aria-describedby="max-scale-error"
            className={inputCls(!!maxCheck.error)}
          />
          {maxCheck.error && (
            <p id="max-scale-error" role="alert" className="mt-1.5 text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3"/> {maxCheck.error}
            </p>
          )}
        </div>
      </div>
      {orderError && (
        <p role="alert" className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3"/> {orderError}
        </p>
      )}
    </div>
  );
}

function SegmentControl<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string }[];
}) {
  return (
    <div className="flex bg-secondary rounded-xl p-1 gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            value === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
          {o.hint && <span className="ml-1 text-xs text-muted-foreground">({o.hint})</span>}
        </button>
      ))}
    </div>
  );
}

function Group({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-3">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">{icon}</div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}


function HomeCityPicker({ value, onChange }: { value: HomeCity; onChange: (v: HomeCity) => void }) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.length < 2 || query === value?.label) { setResults([]); return; }
      setLoading(true);
      setResults(await searchPlaces(query));
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="relative mt-2">
      <div className="flex items-center gap-2 bg-secondary/20 border border-border rounded-xl px-3 py-2.5">
        <Search className="w-4 h-4 text-muted-foreground flex-shrink-0"/>
        <input
          className="bg-transparent flex-1 text-sm outline-none placeholder:text-muted-foreground"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Cerca la tua città…"
        />
        {value && (
          <button type="button" onClick={() => { onChange(null); setQuery(""); }}
            className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4"/>
          </button>
        )}
      </div>
      {value && query === value.label && (
        <div className="mt-1.5 flex items-center gap-2 text-sm text-primary">
          <MapPin className="w-3.5 h-3.5"/>
          <span className="font-medium">{value.label}</span>
          <span className="text-muted-foreground text-xs">({value.lat.toFixed(2)}, {value.lon.toFixed(2)})</span>
        </div>
      )}
      {results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          {results.map((r, i) => (
            <button key={i} type="button"
              onClick={() => {
                onChange({ label: `${r.name}, ${r.country}`, lat: r.latitude, lon: r.longitude });
                setQuery(`${r.name}, ${r.country}`);
                setResults([]);
              }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent/10 flex items-center gap-2 border-b border-border last:border-0">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0"/>
              {r.name}, {r.country}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const s = useSettings();

  return (
    <main className="min-h-screen">
      <AppHeader/>

      <div className="container mx-auto px-4 py-8 max-w-xl">
        <Group
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>}
          title="Unità di distanza"
          desc="Distanze e altitudini"
        >
          <SegmentControl<DistanceUnit>
            value={s.distanceUnit} onChange={s.setDistanceUnit}
            options={[{ value: "metric", label: "Metrico", hint: "km, m" }, { value: "imperial", label: "Imperiale", hint: "mi, ft" }]}
          />
        </Group>

        <Group
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>}
          title="Temperatura"
          desc="Unità di misura della temperatura"
        >
          <SegmentControl<TemperatureUnit>
            value={s.temperatureUnit} onChange={s.setTemperatureUnit}
            options={[{ value: "celsius", label: "Celsius", hint: "°C" }, { value: "fahrenheit", label: "Fahrenheit", hint: "°F" }]}
          />
        </Group>



        

        <Group
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>}
          title="Rotazione automatica"
          desc="Il globo ruota da solo all'avvio"
        >
          <SegmentControl<AutoRotate>
            value={s.autoRotate} onChange={s.setAutoRotate}
            options={[
              { value: "on",  label: "Attiva" },
              { value: "off", label: "Disattiva" },
            ]}
          />
        </Group>


        <Group
          icon={<MapPin width="18" height="18"/>}
          title="Città di residenza"
          desc="Usata per calcolare le distanze e precompilare il punto di partenza"
        >
          <HomeCityPicker value={s.homeCity} onChange={s.setHomeCity}/>
        </Group>

        <Group
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/></svg>}
          title="Scala marker"
          desc={`Dimensione minima e massima dei marker sul globo (${MARKER_SCALE_MIN}–${MARKER_SCALE_MAX})`}
        >
          <MarkerScaleControls
            min={s.minMarkerScale}
            max={s.maxMarkerScale}
            onChangeMin={s.setMinMarkerScale}
            onChangeMax={s.setMaxMarkerScale}
          />
        </Group>

        <Group
          icon={<UserCircle width="18" height="18"/>}
          title="Account"
          desc="Accedi per poter fare un backup dei tuoi viaggi (facoltativo, l'app funziona anche senza)"
        >
          <AccountSection/>
        </Group>

      </div>
    </main>
  );
}
