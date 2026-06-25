import { describe, it, expect } from "vitest";
import { ALL_CITIES } from "@/components/WorldMap";

describe("WorldMap data", () => {
  it("has cities with required fields", () => {
    expect(ALL_CITIES.length).toBeGreaterThan(0);
    ALL_CITIES.forEach(city => {
      expect(city.name).toBeTruthy();
      expect(city.country_code).toHaveLength(2);
      expect(city.latitude).toBeGreaterThanOrEqual(-90);
      expect(city.latitude).toBeLessThanOrEqual(90);
      expect(city.longitude).toBeGreaterThanOrEqual(-180);
      expect(city.longitude).toBeLessThanOrEqual(180);
      expect([1,2,3]).toContain(city.tier);
    });
  });

  it("has T1 cities", () => {
    const t1 = ALL_CITIES.filter(c => c.tier === 1);
    expect(t1.length).toBeGreaterThan(5);
  });
});
