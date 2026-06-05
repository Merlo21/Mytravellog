import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  SettingsProvider,
  useSettings,
  formatDistanceKm,
  formatAltitudeM,
  formatTemperatureC,
  parseStoredSettings,
} from "./settings";

describe("settings formatters", () => {
  describe("formatDistanceKm", () => {
    it("returns em-dash for null/undefined", () => {
      expect(formatDistanceKm(null, "metric")).toBe("—");
      expect(formatDistanceKm(undefined, "imperial")).toBe("—");
    });
    it("formats in km for metric", () => {
      expect(formatDistanceKm(1234, "metric")).toContain("km");
      expect(formatDistanceKm(1234, "metric")).not.toContain("mi");
    });
    it("converts km to miles for imperial", () => {
      const out = formatDistanceKm(100, "imperial");
      expect(out).toContain("mi");
      // 100 km ≈ 62 mi
      expect(out).toMatch(/62/);
    });
  });

  describe("formatAltitudeM", () => {
    it("returns em-dash for null", () => {
      expect(formatAltitudeM(null, "metric")).toBe("—");
    });
    it("formats meters for metric", () => {
      expect(formatAltitudeM(1500, "metric")).toContain("m");
      expect(formatAltitudeM(1500, "metric")).not.toContain("ft");
    });
    it("converts m to ft for imperial", () => {
      const out = formatAltitudeM(100, "imperial");
      expect(out).toContain("ft");
      // 100 m ≈ 328 ft
      expect(out).toMatch(/328/);
    });
  });

  describe("formatTemperatureC", () => {
    it("returns em-dash for null", () => {
      expect(formatTemperatureC(null, "celsius")).toBe("—");
    });
    it("formats celsius", () => {
      expect(formatTemperatureC(20, "celsius", 0)).toBe("20°C");
    });
    it("converts to fahrenheit", () => {
      // 0C = 32F, 100C = 212F
      expect(formatTemperatureC(0, "fahrenheit", 0)).toBe("32°F");
      expect(formatTemperatureC(100, "fahrenheit", 0)).toBe("212°F");
    });
  });
});

describe("SettingsProvider", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function Probe() {
    const s = useSettings();
    return (
      <div>
        <span data-testid="distance">{s.distanceUnit}</span>
        <span data-testid="temperature">{s.temperatureUnit}</span>
        <span data-testid="globe">{s.globeStyle}</span>
        <span data-testid="minMarker">{s.minMarkerScale}</span>
        <span data-testid="maxMarker">{s.maxMarkerScale}</span>
        <button onClick={() => s.setDistanceUnit("imperial")}>d</button>
        <button onClick={() => s.setTemperatureUnit("fahrenheit")}>t</button>
        <button onClick={() => s.setGlobeStyle("satellite")}>g</button>
        <button onClick={() => s.setMinMarkerScale(0.3)}>min</button>
        <button onClick={() => s.setMaxMarkerScale(1.5)}>max</button>
      </div>
    );
  }

  it("provides defaults when no localStorage", () => {
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>
    );
    expect(screen.getByTestId("distance").textContent).toBe("metric");
    expect(screen.getByTestId("temperature").textContent).toBe("celsius");
    expect(screen.getByTestId("globe").textContent).toBe("artistic");
  });

  it("updates settings and persists to localStorage", () => {
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>
    );
    act(() => {
      screen.getByText("d").click();
      screen.getByText("t").click();
      screen.getByText("g").click();
    });
    expect(screen.getByTestId("distance").textContent).toBe("imperial");
    expect(screen.getByTestId("temperature").textContent).toBe("fahrenheit");
    expect(screen.getByTestId("globe").textContent).toBe("satellite");

    const stored = JSON.parse(localStorage.getItem("atlas.settings.v1")!);
    expect(stored).toEqual({
      distanceUnit: "imperial",
      temperatureUnit: "fahrenheit",
      globeStyle: "satellite",
    });
  });

  it("hydrates from localStorage on mount", () => {
    localStorage.setItem(
      "atlas.settings.v1",
      JSON.stringify({
        distanceUnit: "imperial",
        temperatureUnit: "fahrenheit",
        globeStyle: "satellite",
      })
    );
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>
    );
    expect(screen.getByTestId("distance").textContent).toBe("imperial");
    expect(screen.getByTestId("temperature").textContent).toBe("fahrenheit");
    expect(screen.getByTestId("globe").textContent).toBe("satellite");
  });

  it("falls back to defaults when localStorage is corrupted", () => {
    localStorage.setItem("atlas.settings.v1", "not valid json {");
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>
    );
    // App should not crash and should use defaults
    expect(screen.getByTestId("distance").textContent).toBe("metric");
    expect(screen.getByTestId("temperature").textContent).toBe("celsius");
    expect(screen.getByTestId("globe").textContent).toBe("artistic");
  });

  it("hydrates valid fields and replaces invalid ones with defaults", () => {
    localStorage.setItem(
      "atlas.settings.v1",
      JSON.stringify({
        distanceUnit: "imperial",
        temperatureUnit: "kelvin",
        globeStyle: 123,
      })
    );
    render(<SettingsProvider><Probe /></SettingsProvider>);
    expect(screen.getByTestId("distance").textContent).toBe("imperial");
    expect(screen.getByTestId("temperature").textContent).toBe("celsius");
    expect(screen.getByTestId("globe").textContent).toBe("artistic");
  });

  it("ignores unknown extra fields in stored settings", () => {
    localStorage.setItem(
      "atlas.settings.v1",
      JSON.stringify({ distanceUnit: "metric", foo: "bar", nested: { x: 1 } })
    );
    render(<SettingsProvider><Probe /></SettingsProvider>);
    expect(screen.getByTestId("distance").textContent).toBe("metric");
    expect(screen.getByTestId("temperature").textContent).toBe("celsius");
    expect(screen.getByTestId("globe").textContent).toBe("artistic");
  });
});

describe("parseStoredSettings", () => {
  const DEFAULTS = {
    distanceUnit: "metric",
    temperatureUnit: "celsius",
    globeStyle: "artistic",
  } as const;
  it("returns defaults for null / non-objects", () => {
    expect(parseStoredSettings(null)).toEqual(DEFAULTS);
    expect(parseStoredSettings(undefined)).toEqual(DEFAULTS);
    expect(parseStoredSettings("string")).toEqual(DEFAULTS);
    expect(parseStoredSettings(42)).toEqual(DEFAULTS);
  });
  it("returns defaults for an empty object", () => {
    expect(parseStoredSettings({})).toEqual(DEFAULTS);
  });
  it("keeps all valid values", () => {
    expect(parseStoredSettings({
      distanceUnit: "imperial",
      temperatureUnit: "fahrenheit",
      globeStyle: "satellite",
    })).toEqual({
      distanceUnit: "imperial",
      temperatureUnit: "fahrenheit",
      globeStyle: "satellite",
    });
  });
  it("repairs partially invalid input field by field", () => {
    expect(parseStoredSettings({
      distanceUnit: "imperial",
      temperatureUnit: "rankine",
      globeStyle: null,
    })).toEqual({
      distanceUnit: "imperial",
      temperatureUnit: "celsius",
      globeStyle: "artistic",
    });
  });
});
