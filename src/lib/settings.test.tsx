import { describe, it, expect, beforeEach } from "vitest";
import { act, render } from "@testing-library/react";
import {
  SettingsProvider,
  useSettings,
  parseStoredSettings,
  MARKER_SCALE_MIN,
  MARKER_SCALE_MAX,
  type Settings,
} from "./settings";

const KEY = "atlas.settings.v1";

let captured: ReturnType<typeof useSettings> | null = null;
function Probe() {
  captured = useSettings();
  return null;
}
function mount() {
  captured = null;
  render(
    <SettingsProvider>
      <Probe />
    </SettingsProvider>
  );
  return captured!;
}

describe("settings — minMarkerScale / maxMarkerScale", () => {
  beforeEach(() => localStorage.clear());

  it("espone i default corretti", () => {
    const s = mount();
    expect(s.minMarkerScale).toBe(0.5);
    expect(s.maxMarkerScale).toBe(1.0);
  });

  it("aggiorna min/max e li persiste in localStorage", () => {
    const s = mount();
    act(() => {
      s.setMinMarkerScale(0.7);
      s.setMaxMarkerScale(1.5);
    });
    expect(captured!.minMarkerScale).toBe(0.7);
    expect(captured!.maxMarkerScale).toBe(1.5);

    const stored = JSON.parse(localStorage.getItem(KEY)!) as Settings;
    expect(stored.minMarkerScale).toBe(0.7);
    expect(stored.maxMarkerScale).toBe(1.5);
  });

  it("clampa i valori fuori range", () => {
    const s = mount();
    act(() => {
      s.setMinMarkerScale(-5);
      s.setMaxMarkerScale(999);
    });
    expect(captured!.minMarkerScale).toBe(MARKER_SCALE_MIN);
    expect(captured!.maxMarkerScale).toBe(MARKER_SCALE_MAX);
  });

  it("clampa NaN a un default sicuro", () => {
    const s = mount();
    act(() => s.setMinMarkerScale(Number.NaN));
    expect(Number.isFinite(captured!.minMarkerScale)).toBe(true);
    expect(captured!.minMarkerScale).toBeGreaterThanOrEqual(MARKER_SCALE_MIN);
  });

  it("reidrata i valori salvati al reload", () => {
    const stored: Settings = {
      distanceUnit: "imperial",
      temperatureUnit: "fahrenheit",
      autoRotate: "off",
      homeCity: null,
      minMarkerScale: 0.8,
      maxMarkerScale: 1.6,
    };
    localStorage.setItem(KEY, JSON.stringify(stored));
    const s = mount();
    expect(s.minMarkerScale).toBe(0.8);
    expect(s.maxMarkerScale).toBe(1.6);
    expect(s.distanceUnit).toBe("imperial");
  });
});

describe("parseStoredSettings — compatibilità retroattiva", () => {
  it("ritorna i default con raw null", () => {
    const s = parseStoredSettings(null);
    expect(s.minMarkerScale).toBe(0.5);
    expect(s.maxMarkerScale).toBe(1.0);
  });

  it("fonde payload legacy senza campi marker con i default", () => {
    const legacy = JSON.stringify({ distanceUnit: "imperial", temperatureUnit: "celsius" });
    const s = parseStoredSettings(legacy);
    expect(s.distanceUnit).toBe("imperial");
    expect(s.minMarkerScale).toBe(0.5);
    expect(s.maxMarkerScale).toBe(1.0);
  });

  it("preserva i valori marker scale quando presenti", () => {
    const raw = JSON.stringify({ minMarkerScale: 0.9, maxMarkerScale: 1.4 });
    const s = parseStoredSettings(raw);
    expect(s.minMarkerScale).toBe(0.9);
    expect(s.maxMarkerScale).toBe(1.4);
  });

  it("ritorna i default su JSON malformato", () => {
    const s = parseStoredSettings("{not json");
    expect(s.minMarkerScale).toBe(0.5);
    expect(s.maxMarkerScale).toBe(1.0);
  });
});
