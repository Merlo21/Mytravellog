import { Link } from "react-router-dom";
import { ArrowLeft, Compass, Ruler, Thermometer, Globe } from "lucide-react";
import { useSettings, DistanceUnit, TemperatureUnit, GlobeStyle } from "@/lib/settings";

function SegmentControl<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string; hint?: string }[] }) {
  return (
    <div className="flex bg-secondary rounded-xl p-1 gap-1">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${value === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          {o.label}
          {o.hint && <span className="ml-1 text-xs text-muted-foreground">({o.hint})</span>}
        </button>
      ))}
    </div>
  );
}

function Group({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5">
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

export default function Settings() {
  const s = useSettings();

  return (
    <main className="min-h-screen">
      <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Compass className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none">Impostazioni</h1>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">personalizza Atlas</p>
            </div>
          </div>
          <Link to="/" className="btn-ghost text-sm flex items-center gap-2 py-1.5 px-3">
            <ArrowLeft className="w-4 h-4" /> Indietro
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-xl space-y-4">
        <Group icon={<Ruler className="w-5 h-5" />} title="Unità di distanza" desc="Distanze e altitudini">
          <SegmentControl<DistanceUnit>
            value={s.distanceUnit} onChange={s.setDistanceUnit}
            options={[{ value: "metric", label: "Metrico", hint: "km, m" }, { value: "imperial", label: "Imperiale", hint: "mi, ft" }]}
          />
        </Group>

        <Group icon={<Thermometer className="w-5 h-5" />} title="Temperatura" desc="Unità di misura della temperatura">
          <SegmentControl<TemperatureUnit>
            value={s.temperatureUnit} onChange={s.setTemperatureUnit}
            options={[{ value: "celsius", label: "Celsius", hint: "°C" }, { value: "fahrenheit", label: "Fahrenheit", hint: "°F" }]}
          />
        </Group>

        <Group icon={<Globe className="w-5 h-5" />} title="Stile del globo" desc="Aspetto visivo della mappa 3D">
          <SegmentControl<GlobeStyle>
            value={s.globeStyle} onChange={s.setGlobeStyle}
            options={[{ value: "artistic", label: "Artistico" }, { value: "satellite", label: "Satellite" }]}
          />
        </Group>
      </div>
    </main>
  );
}
