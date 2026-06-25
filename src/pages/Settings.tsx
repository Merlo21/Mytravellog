import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { useSettings, DistanceUnit, TemperatureUnit, GlobeLabels, AutoRotate, Theme } from "@/lib/settings";

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
          <Link to="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Indietro
          </Link>
        </div>
      </header>

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
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>}
          title="Tema"
          desc="Scegli tra tema scuro e chiaro"
        >
          <SegmentControl<Theme>
            value={s.theme} onChange={s.setTheme}
            options={[
              { value: "dark",  label: "🌙 Scuro" },
              { value: "light", label: "☀️ Chiaro" },
            ]}
          />
        </Group>
      </div>
    </main>
  );
}
