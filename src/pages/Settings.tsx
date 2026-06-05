import { Link } from "react-router-dom";
import { ArrowLeft, Settings as SettingsIcon, Ruler, Thermometer, Globe, MapPin } from "lucide-react";
import { useSettings, DistanceUnit, TemperatureUnit, GlobeStyle } from "@/lib/settings";
import { Slider } from "@/components/ui/slider";

const SettingsPage = () => {
  const s = useSettings();

  return (
    <main className="min-h-screen">
      <header className="border-b border-border bg-background/60 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-aurora flex items-center justify-center shadow-glow">
              <SettingsIcon className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Impostazioni</h1>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                personalizza la tua esperienza
              </p>
            </div>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50 hover:bg-muted text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Indietro
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-2xl space-y-6">
        <SettingGroup
          icon={<Ruler className="w-5 h-5" />}
          title="Unità di distanza"
          description="Scegli come visualizzare distanze e altitudini."
        >
          <Segmented<DistanceUnit>
            value={s.distanceUnit}
            onChange={s.setDistanceUnit}
            options={[
              { value: "metric", label: "Metrico", hint: "km, m" },
              { value: "imperial", label: "Imperiale", hint: "mi, ft" },
            ]}
          />
        </SettingGroup>

        <SettingGroup
          icon={<Thermometer className="w-5 h-5" />}
          title="Unità di temperatura"
          description="Come mostrare le temperature dei luoghi visitati."
        >
          <Segmented<TemperatureUnit>
            value={s.temperatureUnit}
            onChange={s.setTemperatureUnit}
            options={[
              { value: "celsius", label: "Celsius", hint: "°C" },
              { value: "fahrenheit", label: "Fahrenheit", hint: "°F" },
            ]}
          />
        </SettingGroup>

        <SettingGroup
          icon={<Globe className="w-5 h-5" />}
          title="Stile del globo"
          description="Cambia l'aspetto del globo rotante in homepage."
        >
          <Segmented<GlobeStyle>
            value={s.globeStyle}
            onChange={s.setGlobeStyle}
            options={[
              { value: "artistic", label: "Artistico", hint: "vista pittorica" },
              { value: "satellite", label: "Satellitare", hint: "immagine reale" },
            ]}
          />
        </SettingGroup>

        <SettingGroup
          icon={<MapPin className="w-5 h-5" />}
          title="Dimensione marker"
          description="Controlla la dimensione minima e massima dei segnaposto sulla mappa."
        >
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Minimo</span>
                <span className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">{s.minMarkerScale.toFixed(1)}x</span>
              </div>
              <Slider
                value={[s.minMarkerScale]}
                min={0.1}
                max={2.0}
                step={0.1}
                onValueChange={([v]) => s.setMinMarkerScale(Math.min(v, s.maxMarkerScale))}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Massimo</span>
                <span className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">{s.maxMarkerScale.toFixed(1)}x</span>
              </div>
              <Slider
                value={[s.maxMarkerScale]}
                min={0.1}
                max={2.0}
                step={0.1}
                onValueChange={([v]) => s.setMaxMarkerScale(Math.max(v, s.minMarkerScale))}
              />
            </div>
          </div>
        </SettingGroup>
      </div>
    </main>
  );
};

function SettingGroup({
  icon, title, description, children,
}: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="glass-card p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-primary shrink-0">
          {icon}
        </div>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string; hint?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-xl border px-4 py-3 text-left transition-all ${
              active
                ? "border-primary/60 bg-primary/10 shadow-glow"
                : "border-border bg-muted/30 hover:bg-muted/50"
            }`}
          >
            <div className={`font-semibold ${active ? "text-primary" : ""}`}>{o.label}</div>
            {o.hint && <div className="text-xs text-muted-foreground mt-0.5 font-mono">{o.hint}</div>}
          </button>
        );
      })}
    </div>
  );
}

export default SettingsPage;
