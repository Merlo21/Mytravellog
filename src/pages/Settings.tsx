import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useSettings, DistanceUnit, TemperatureUnit, AutoRotate, Theme } from "@/lib/settings";

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
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:"#60a5fa"}}>
              <svg width="26" height="26" viewBox="0 0 30 30" fill="none" aria-hidden="true">
                <circle cx="15" cy="15" r="11" stroke="#020d1a" strokeWidth="1.6"/>
                <ellipse cx="15" cy="15" rx="11" ry="4.8" stroke="#020d1a" strokeWidth="1.2"/>
                <ellipse cx="15" cy="15" rx="6.5" ry="11" stroke="#020d1a" strokeWidth="1.2"/>
                <polygon points="15,5.5 13.5,13 15,11.5 16.5,13" fill="#ffffff"/>
                <polygon points="15,24.5 13.5,17 15,18.5 16.5,17" fill="#ffffff" opacity="0.35"/>
                <polygon points="24.5,15 17,13.5 18.5,15 17,16.5" fill="#fbbf24"/>
                <polygon points="5.5,15 13,13.5 11.5,15 13,16.5" fill="#fbbf24" opacity="0.35"/>
              </svg>
            </div>
            <h1 className="text-[20px] font-extrabold leading-none tracking-[0.2em]">
              <span style={{color:"#60a5fa"}}>NAV</span><span style={{color:"#fbbf24"}}>·</span><span>TA</span>
            </h1>
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
