import { describe, it, expect } from "vitest";
import { buildFlightPath, bearingBetween, computeLegCamera, buildFlightLegs } from "./flyover";
import type { Trip } from "./storage";

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
    home_latitude: 45.5,
    home_longitude: 9.2,
    home_label: "Milano",
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

describe("buildFlightPath", () => {
  it("produce casa → destinazione per un viaggio senza waypoint", () => {
    const stops = buildFlightPath([makeTrip()]);
    expect(stops).toEqual([
      { lat: 45.5, lon: 9.2, label: "Milano", tripId: expect.any(String) },
      { lat: 41.9, lon: 12.5, label: "Roma", tripId: expect.any(String) },
    ]);
  });

  it("inserisce i waypoint tra casa e destinazione, nell'ordine dato", () => {
    const stops = buildFlightPath([makeTrip({
      waypoints: [{ city: "Torino", country: "Italia", transport_mode: "train", lat: 45.07, lon: 7.68 }],
    })]);
    expect(stops.map(s => s.label)).toEqual(["Milano", "Torino", "Roma"]);
  });

  it("salta la casa se home_latitude/longitude sono null", () => {
    const stops = buildFlightPath([makeTrip({ home_latitude: null, home_longitude: null })]);
    expect(stops.map(s => s.label)).toEqual(["Roma"]);
  });

  it("salta i waypoint senza coordinate", () => {
    const stops = buildFlightPath([makeTrip({
      waypoints: [{ city: "SenzaCoordinate", country: "Italia", transport_mode: "train" }],
    })]);
    expect(stops.map(s => s.label)).toEqual(["Milano", "Roma"]);
  });

  it("ordina più viaggi per data crescente", () => {
    const stops = buildFlightPath([
      makeTrip({ trip_date: "2024-06-01", city: "Napoli", latitude: 40.85, longitude: 14.27 }),
      makeTrip({ trip_date: "2024-01-01", city: "Roma" }),
    ]);
    // Il viaggio di gennaio (Roma) deve venire prima di quello di giugno (Napoli)
    const romaIndex = stops.findIndex(s => s.label === "Roma");
    const napoliIndex = stops.findIndex(s => s.label === "Napoli");
    expect(romaIndex).toBeLessThan(napoliIndex);
  });

  it("unisce due tappe consecutive con le stesse coordinate (niente tratta a lunghezza zero)", () => {
    // Il secondo viaggio parte esattamente dalla stessa città dove finiva il primo
    const stops = buildFlightPath([
      makeTrip({ trip_date: "2024-01-01", city: "Roma", latitude: 41.9, longitude: 12.5 }),
      makeTrip({ trip_date: "2024-02-01", home_latitude: 41.9, home_longitude: 12.5, home_label: "Roma", city: "Napoli", latitude: 40.85, longitude: 14.27 }),
    ]);
    // Milano -> Roma (dal primo viaggio) -> [Roma duplicata, saltata] -> Napoli
    expect(stops.map(s => s.label)).toEqual(["Milano", "Roma", "Napoli"]);
  });
});

describe("bearingBetween", () => {
  it("0° quando si va esattamente a nord", () => {
    expect(bearingBetween({ lat: 40, lon: 10 }, { lat: 45, lon: 10 })).toBeCloseTo(0, 0);
  });

  it("~90° quando si va esattamente a est sull'equatore", () => {
    expect(bearingBetween({ lat: 0, lon: 0 }, { lat: 0, lon: 10 })).toBeCloseTo(90, 0);
  });

  it("~180° quando si va esattamente a sud", () => {
    expect(bearingBetween({ lat: 45, lon: 10 }, { lat: 40, lon: 10 })).toBeCloseTo(180, 0);
  });

  it("~270° quando si va esattamente a ovest sull'equatore", () => {
    expect(bearingBetween({ lat: 0, lon: 10 }, { lat: 0, lon: 0 })).toBeCloseTo(270, 0);
  });
});

describe("computeLegCamera", () => {
  it("usa zoom alto e pitch marcato per tratte brevi (<50km)", () => {
    const cam = computeLegCamera({ lat: 45.5, lon: 9.2, label: "A", tripId: "1" }, { lat: 45.51, lon: 9.21, label: "B", tripId: "1" });
    expect(cam.zoom).toBe(11);
    expect(cam.pitch).toBe(60);
  });

  it("usa zoom basso e pitch ridotto per tratte intercontinentali (>3000km)", () => {
    // Milano -> Tokyo, ~9700km
    const cam = computeLegCamera({ lat: 45.46, lon: 9.19, label: "Milano", tripId: "1" }, { lat: 35.68, lon: 139.65, label: "Tokyo", tripId: "1" });
    expect(cam.zoom).toBe(2.5);
    expect(cam.pitch).toBe(30);
  });

  it("la durata resta clampata tra 2.5s e 6s", () => {
    const short = computeLegCamera({ lat: 45.5, lon: 9.2, label: "A", tripId: "1" }, { lat: 45.5001, lon: 9.2001, label: "B", tripId: "1" });
    const long = computeLegCamera({ lat: 45.46, lon: 9.19, label: "Milano", tripId: "1" }, { lat: 35.68, lon: 139.65, label: "Tokyo", tripId: "1" });
    expect(short.durationMs).toBe(2500);
    expect(long.durationMs).toBe(6000);
  });

  it("il bearing della camera coincide con bearingBetween per la stessa tratta", () => {
    const from = { lat: 45.5, lon: 9.2, label: "A", tripId: "1" };
    const to = { lat: 41.9, lon: 12.5, label: "B", tripId: "1" };
    expect(computeLegCamera(from, to).bearing).toBe(bearingBetween(from, to));
  });
});

describe("buildFlightLegs", () => {
  it("produce N-1 tratte per N tappe", () => {
    const stops = buildFlightPath([makeTrip({
      waypoints: [{ city: "Torino", country: "Italia", transport_mode: "train", lat: 45.07, lon: 7.68 }],
    })]);
    const legs = buildFlightLegs(stops);
    expect(legs).toHaveLength(2);
    expect(legs[0].from.label).toBe("Milano");
    expect(legs[0].to.label).toBe("Torino");
    expect(legs[1].from.label).toBe("Torino");
    expect(legs[1].to.label).toBe("Roma");
  });

  it("nessuna tratta con una sola tappa", () => {
    const legs = buildFlightLegs([{ lat: 0, lon: 0, label: "Solo", tripId: "1" }]);
    expect(legs).toHaveLength(0);
  });

  it("nessuna tratta con lista vuota", () => {
    expect(buildFlightLegs([])).toHaveLength(0);
  });
});
