import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type DistanceUnit = "metric" | "imperial";
export type TemperatureUnit = "celsius" | "fahrenheit";
export type AutoRotate = "on" | "off";
export type Theme = "dark" | "light";

type Settings = {
  distanceUnit: DistanceUnit;
  temperatureUnit: TemperatureUnit;
  autoRotate: AutoRotate;
  theme: Theme;
};

type Ctx = Settings & {
  setDistanceUnit: (v: DistanceUnit) => void;
  setTemperatureUnit: (v: TemperatureUnit) => void;
  setAutoRotate: (v: AutoRotate) => void;
  setTheme: (v: Theme) => void;
};

const DEFAULTS: Settings = {
  distanceUnit: "metric",
  temperatureUnit: "celsius",
  autoRotate: "on",
  theme: "dark",
};

const KEY = "atlas.settings.v1";

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

const Ctx = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Settings>(load);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(s)); }, [s]);

  // Apply theme class to document root
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const rootEl = document.getElementById("root");
    if (s.theme === "light") {
      root.classList.add("light");
      body.style.backgroundColor = "#e8f0fe";
      if (rootEl) rootEl.style.backgroundColor = "#e8f0fe";
    } else {
      root.classList.remove("light");
      body.style.backgroundColor = "#060e1e";
      if (rootEl) rootEl.style.backgroundColor = "#060e1e";
    }
  }, [s.theme]);
  const value: Ctx = {
    ...s,
    setDistanceUnit: (v) => setS((p) => ({ ...p, distanceUnit: v })),
    setTemperatureUnit: (v) => setS((p) => ({ ...p, temperatureUnit: v })),
    setAutoRotate: (v) => setS((p) => ({ ...p, autoRotate: v })),
    setTheme: (v) => setS((p) => ({ ...p, theme: v })),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be inside SettingsProvider");
  return ctx;
}

export function fmtDistance(km: number | null | undefined, unit: DistanceUnit): string {
  if (km == null) return "—";
  if (unit === "imperial") return `${Math.round(km * 0.621371).toLocaleString("it-IT")} mi`;
  return `${km.toLocaleString("it-IT")} km`;
}

export function fmtAltitude(m: number | null | undefined, unit: DistanceUnit): string {
  if (m == null) return "—";
  if (unit === "imperial") return `${Math.round(m * 3.28084).toLocaleString("it-IT")} ft`;
  return `${Math.round(m).toLocaleString("it-IT")} m`;
}

export function fmtTemp(c: number | null | undefined, unit: TemperatureUnit): string {
  if (c == null) return "—";
  if (unit === "fahrenheit") return `${(c * 9 / 5 + 32).toFixed(1)}°F`;
  return `${c.toFixed(1)}°C`;
}

// ── Backwards-compatible aliases (used by older components) ──────────────────
export function formatDistanceKm(km: number | null | undefined, unit: DistanceUnit): string {
  return fmtDistance(km, unit);
}
export function formatAltitudeM(m: number | null | undefined, unit: DistanceUnit): string {
  return fmtAltitude(m, unit);
}
export function formatTemperatureC(c: number | null | undefined, unit: TemperatureUnit): string {
  return fmtTemp(c, unit);
}

// parseStoredSettings — used by settings.test.tsx
export function parseStoredSettings(raw: string | null): Settings {
  if (!raw) return DEFAULTS;
  try { return { ...DEFAULTS, ...JSON.parse(raw) }; }
  catch { return DEFAULTS; }
}
