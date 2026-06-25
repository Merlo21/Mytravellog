import { describe, it, expect, beforeEach } from "vitest";
import { parseStoredSettings } from "@/lib/settings";

describe("settings reload", () => {
  beforeEach(() => { localStorage.clear(); });

  it("returns defaults when storage is empty", () => {
    const s = parseStoredSettings(null);
    expect(s.distanceUnit).toBe("metric");
    expect(s.temperatureUnit).toBe("celsius");
    expect(s.autoRotate).toBe("on");
    expect(s.theme).toBe("dark");
  });

  it("merges stored values with defaults", () => {
    const s = parseStoredSettings(JSON.stringify({ distanceUnit: "imperial" }));
    expect(s.distanceUnit).toBe("imperial");
    expect(s.temperatureUnit).toBe("celsius");
  });

  it("returns defaults on invalid JSON", () => {
    const s = parseStoredSettings("not-json");
    expect(s.distanceUnit).toBe("metric");
  });
});
