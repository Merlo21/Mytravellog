import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { z } from "zod";

export const distanceUnitSchema = z.enum(["metric", "imperial"]);
export const temperatureUnitSchema = z.enum(["celsius", "fahrenheit"]);
export const globeStyleSchema = z.enum(["artistic", "satellite"]);
export const markerScaleSchema = z.number().min(0.1).max(2.0);

export type DistanceUnit = z.infer<typeof distanceUnitSchema>;
export type TemperatureUnit = z.infer<typeof temperatureUnitSchema>;
export type GlobeStyle = z.infer<typeof globeStyleSchema>;

export const settingsSchema = z.object({
  distanceUnit: distanceUnitSchema,
  temperatureUnit: temperatureUnitSchema,
  globeStyle: globeStyleSchema,
  minMarkerScale: markerScaleSchema,
  maxMarkerScale: markerScaleSchema,
});

export type Settings = z.infer<typeof settingsSchema>;

const DEFAULTS: Settings = {
  distanceUnit: "metric",
  temperatureUnit: "celsius",
  globeStyle: "artistic",
  minMarkerScale: 0.5,
  maxMarkerScale: 1.0,
};

const KEY = "atlas.settings.v1";

/**
 * Parse raw stored settings into a valid Settings object.
 * - Missing or invalid individual fields fall back to their default.
 * - Completely corrupted JSON / wrong shape falls back to all defaults.
 */
export function parseStoredSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== "object") return DEFAULTS;
  const obj = raw as Record<string, unknown>;
  const pick = <T extends z.ZodTypeAny>(schema: T, value: unknown, fallback: z.infer<T>): z.infer<T> => {
    const r = schema.safeParse(value);
    return r.success ? r.data : fallback;
  };
  return {
    distanceUnit: pick(distanceUnitSchema, obj.distanceUnit, DEFAULTS.distanceUnit),
    temperatureUnit: pick(temperatureUnitSchema, obj.temperatureUnit, DEFAULTS.temperatureUnit),
    globeStyle: pick(globeStyleSchema, obj.globeStyle, DEFAULTS.globeStyle),
    minMarkerScale: pick(markerScaleSchema, obj.minMarkerScale, DEFAULTS.minMarkerScale),
    maxMarkerScale: pick(markerScaleSchema, obj.maxMarkerScale, DEFAULTS.maxMarkerScale),
  };
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return parseStoredSettings(JSON.parse(raw));
  } catch {
    return DEFAULTS;
  }
}

interface Ctx extends Settings {
  setDistanceUnit: (v: DistanceUnit) => void;
  setTemperatureUnit: (v: TemperatureUnit) => void;
  setGlobeStyle: (v: GlobeStyle) => void;
  setMinMarkerScale: (v: number) => void;
  setMaxMarkerScale: (v: number) => void;
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
  }, [settings]);

  const value: Ctx = {
    ...settings,
    setDistanceUnit: (v) => setSettings((s) => ({ ...s, distanceUnit: v })),
    setTemperatureUnit: (v) => setSettings((s) => ({ ...s, temperatureUnit: v })),
    setGlobeStyle: (v) => setSettings((s) => ({ ...s, globeStyle: v })),
    setMinMarkerScale: (v) => setSettings((s) => ({ ...s, minMarkerScale: v })),
    setMaxMarkerScale: (v) => setSettings((s) => ({ ...s, maxMarkerScale: v })),
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
