import { describe, it, expect } from "vitest";
import { ALL_CITIES, buildRouteCoords } from "@/components/WorldMap";
import type { Trip } from "@/lib/storage";

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

describe("buildRouteCoords", () => {
  function makeTrip(overrides: Partial<Trip> = {}): Trip {
    return {
      id: "1", created_at: "2024-01-01", title: "Test", country: "Francia", city: "Parigi",
      country_code: "FR", trip_date: "2024-01-01", date_end: null, rating: null, notes: null,
      transport_mode: "car", waypoints: [],
      latitude: 48.85, longitude: 2.35,
      home_latitude: 41.9, home_longitude: 12.5, home_label: "Roma",
      route_geometry: null, temperature_c: null, altitude_m: null,
      max_altitude_m: null, max_altitude_city: null,
      distance_from_home_km: null, max_distance_from_home_km: null, max_distance_city: null,
      hottest_temp_c: null, hottest_city: null, coldest_temp_c: null, coldest_city: null,
      region: null, region_details: null,
      ...overrides,
    };
  }

  it("linea retta home->destinazione quando non c'è un percorso stradale salvato", () => {
    const trip = makeTrip({ route_geometry: null });
    expect(buildRouteCoords(trip)).toEqual([[12.5, 41.9], [2.35, 48.85]]);
  });

  it("usa il percorso stradale reale per la tratta finale quando presente", () => {
    const route: [number, number][] = [[12.5, 41.9], [10, 45], [2.35, 48.85]];
    const trip = makeTrip({ route_geometry: route });
    expect(buildRouteCoords(trip)).toEqual([[12.5, 41.9], ...route]);
  });

  it("ignora un percorso stradale con un solo punto (non è un percorso valido)", () => {
    const trip = makeTrip({ route_geometry: [[2.35, 48.85]] });
    expect(buildRouteCoords(trip)).toEqual([[12.5, 41.9], [2.35, 48.85]]);
  });

  it("viaggio multi-tappa: mescola linee rette e percorsi stradali per segmento", () => {
    // Roma (casa) --retta--> Milano (aereo) --strada--> Parigi (auto, destinazione)
    const trip = makeTrip({
      transport_mode: "car",
      waypoints: [{ city: "Milano", country: "Italia", transport_mode: "plane", lat: 45.5, lon: 9.2, route_geometry: null }],
      route_geometry: [[9.2, 45.5], [6, 47], [2.35, 48.85]],
    });
    expect(buildRouteCoords(trip)).toEqual([
      [12.5, 41.9],   // casa
      [9.2, 45.5],    // Milano (linea retta, aereo)
      [9.2, 45.5], [6, 47], [2.35, 48.85], // Milano -> Parigi (percorso stradale)
    ]);
  });

  it("salta i waypoint senza coordinate valide", () => {
    const trip = makeTrip({
      waypoints: [{ city: "Sconosciuta", country: "?", transport_mode: "car" }],
    });
    expect(buildRouteCoords(trip)).toEqual([[12.5, 41.9], [2.35, 48.85]]);
  });
});
