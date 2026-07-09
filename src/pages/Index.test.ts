import { describe, it, expect } from "vitest";
import { computeHomeStats, backfillDistanceFromHome } from "./Index";
import type { Trip } from "@/lib/storage";

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: Math.random().toString(36).slice(2),
    created_at: new Date().toISOString(),
    title: "Test",
    country: "Italia",
    city: "Roma",
    country_code: "IT",
    trip_date: "2024-01-01",
    date_end: null,
    rating: null,
    notes: null,
    transport_mode: null,
    waypoints: [],
    latitude: 41.9,
    longitude: 12.5,
    home_latitude: null,
    home_longitude: null,
    home_label: null,
    route_geometry: null,
    temperature_c: null,
    altitude_m: null,
    max_altitude_m: null,
    max_altitude_city: null,
    distance_from_home_km: null,
    max_distance_from_home_km: null,
    max_distance_city: null,
    hottest_temp_c: null,
    hottest_city: null,
    coldest_temp_c: null,
    coldest_city: null,
    region: null,
    region_details: null,
    ...overrides,
  };
}

describe("computeHomeStats", () => {
  it("conta 0 di tutto con nessun viaggio", () => {
    expect(computeHomeStats([])).toEqual({ trips: 0, countries: 0, cities: 0, km: 0, days: 0 });
  });

  it("conta anche i paesi/città delle tappe intermedie, non solo la destinazione", () => {
    const trips = [makeTrip({
      country: "Argentina", country_code: "AR", city: "Buenos Aires",
      waypoints: [
        { city: "Il Cairo", country: "Egitto", country_code: "EG", transport_mode: "car", lat: 30.06, lon: 31.25 },
        { city: "Tokyo", country: "Giappone", country_code: "JP", transport_mode: "walk", lat: 35.68, lon: 139.69 },
      ],
    })];
    const stats = computeHomeStats(trips);
    expect(stats.trips).toBe(1);
    expect(stats.countries).toBe(3); // Argentina + Egitto + Giappone
    expect(stats.cities).toBe(3);
  });

  it("non duplica un paese/città toccato sia da un waypoint che dalla destinazione", () => {
    const trips = [makeTrip({
      country: "Italia", country_code: "IT", city: "Roma",
      waypoints: [{ city: "Roma", country: "Italia", country_code: "IT", transport_mode: "car" }],
    })];
    const stats = computeHomeStats(trips);
    expect(stats.countries).toBe(1);
    expect(stats.cities).toBe(1);
  });

  it("somma i km di tutti i viaggi", () => {
    const trips = [
      makeTrip({ distance_from_home_km: 100 }),
      makeTrip({ distance_from_home_km: 250 }),
      makeTrip({ distance_from_home_km: null }),
    ];
    expect(computeHomeStats(trips).km).toBe(350);
  });

  it("conta i giorni: 1 giorno se manca date_end o è uguale a trip_date", () => {
    const trips = [
      makeTrip({ trip_date: "2024-01-01", date_end: null }),
      makeTrip({ trip_date: "2024-01-01", date_end: "2024-01-01" }),
      makeTrip({ trip_date: "2024-01-01", date_end: "2024-01-05" }),
    ];
    expect(computeHomeStats(trips).days).toBe(1 + 1 + 4);
  });
});

describe("backfillDistanceFromHome", () => {
  const home = { lat: 41.9, lon: 12.5 }; // Roma

  it("calcola la distanza diretta home->destinazione senza tappe intermedie", () => {
    const trip = makeTrip({ latitude: 48.85, longitude: 2.35, city: "Parigi", waypoints: [] }); // Parigi
    const patch = backfillDistanceFromHome(trip, home);
    expect(patch.distance_from_home_km).toBeGreaterThan(1000);
    expect(patch.distance_from_home_km).toBeLessThan(1200);
    expect(patch.max_distance_city).toBe("Parigi");
  });

  it("somma i segmenti reali attraverso le tappe, non la linea retta home->destinazione", () => {
    // Roma -> Il Cairo -> Tokyo (destinazione): il percorso reale è più lungo
    // della sola linea retta Roma->Tokyo.
    const trip = makeTrip({
      latitude: 35.68, longitude: 139.69, city: "Tokyo",
      waypoints: [{ city: "Il Cairo", country: "Egitto", transport_mode: "car", lat: 30.06, lon: 31.25 }],
    });
    const patch = backfillDistanceFromHome(trip, home);
    const straightLineOnly = 9854; // distanza diretta Roma->Tokyo (nota dal test end-to-end)
    expect(patch.distance_from_home_km).toBeGreaterThan(straightLineOnly);
  });

  it("identifica la tappa più lontana da casa (non necessariamente la destinazione)", () => {
    // Roma -> Tokyo (tappa intermedia, molto lontana) -> Il Cairo (destinazione, più vicina)
    const trip = makeTrip({
      latitude: 30.06, longitude: 31.25, city: "Il Cairo",
      waypoints: [{ city: "Tokyo", country: "Giappone", transport_mode: "plane", lat: 35.68, lon: 139.69 }],
    });
    const patch = backfillDistanceFromHome(trip, home);
    expect(patch.max_distance_city).toBe("Tokyo");
  });

  it("preserva max_distance_from_home_km/city già esistenti invece di sovrascriverli", () => {
    const trip = makeTrip({
      latitude: 48.85, longitude: 2.35, city: "Parigi", waypoints: [],
      max_distance_from_home_km: 999, max_distance_city: "Valore preesistente",
    });
    const patch = backfillDistanceFromHome(trip, home);
    expect(patch.max_distance_from_home_km).toBe(999);
    expect(patch.max_distance_city).toBe("Valore preesistente");
  });
});
