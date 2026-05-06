import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type DistanceUnit = "metric" | "imperial"; // km/m vs mi/ft
export type TemperatureUnit = "celsius" | "fahrenheit";
export type GlobeStyle = "artistic" | "satellite";

export interface Settings {
  distanceUnit: DistanceUnit;
  temperatureUnit: TemperatureUnit;
  globeStyle: GlobeStyle;
}

const DEFAULTS: Settings = {
  distanceUnit: "metric",
  temperatureUnit: "celsius",
  globeStyle: "artistic",
};

const KEY = "atlas.settings.v1";

interface Ctx extends Settings {
  setDistanceUnit: (v: DistanceUnit) => void;
  setTemperatureUnit: (v: TemperatureUnit) => void;
  setGlobeStyle: (v: GlobeStyle) => void;
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return DEFAULTS;
      return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
    } catch {
      return DEFAULTS;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
  }, [settings]);

  const value: Ctx = {
    ...settings,
    setDistanceUnit: (v) => setSettings((s) => ({ ...s, distanceUnit: v })),
    setTemperatureUnit: (v) => setSettings((s) => ({ ...s, temperatureUnit: v })),
    setGlobeStyle: (v) => setSettings((s) => ({ ...s, globeStyle: v })),
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}

// ---- formatters ----
const KM_TO_MI = 0.621371;
const M_TO_FT = 3.28084;

export function formatDistanceKm(km: number | null | undefined, unit: DistanceUnit, opts: { decimals?: number } = {}): string {
  if (km == null) return "—";
  const decimals = opts.decimals ?? 0;
  if (unit === "imperial") {
    const mi = km * KM_TO_MI;
    return `${mi.toLocaleString("it-IT", { maximumFractionDigits: decimals })} mi`;
  }
  return `${km.toLocaleString("it-IT", { maximumFractionDigits: decimals })} km`;
}

export function formatAltitudeM(m: number | null | undefined, unit: DistanceUnit): string {
  if (m == null) return "—";
  if (unit === "imperial") return `${Math.round(m * M_TO_FT).toLocaleString("it-IT")} ft`;
  return `${Math.round(m).toLocaleString("it-IT")} m`;
}

export function formatTemperatureC(c: number | null | undefined, unit: TemperatureUnit, decimals = 1): string {
  if (c == null) return "—";
  if (unit === "fahrenheit") {
    const f = c * 9 / 5 + 32;
    return `${f.toFixed(decimals)}°F`;
  }
  return `${c.toFixed(decimals)}°C`;
}
