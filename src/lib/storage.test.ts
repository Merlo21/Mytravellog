import { describe, it, expect, beforeEach } from "vitest";
import {
  addTrip,
  loadTrips,
  updateTrip,
  deleteTrip,
  parseLocalDate,
  formatTripDate,
  todayLocalISO,
  type Trip,
} from "./storage";

// Minimal valid trip (all nullable fields set to null)
function makeTrip(overrides: Partial<Omit<Trip, "id" | "created_at">> = {}): Omit<Trip, "id" | "created_at"> {
  return {
    title: "Test",
    country: "Italia",
    city: "Roma",
    country_code: "IT",
    trip_date: "2024-06-01",
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
    distance_from_home_km: null,
    max_distance_from_home_km: null,
    max_distance_city: null,
    max_altitude_m: null,
    max_altitude_city: null,
    hottest_temp_c: null,
    hottest_city: null,
    coldest_temp_c: null,
    coldest_city: null,
    region: null,
    region_details: null,
    ...overrides,
  };
}

describe("loadTrips", () => {
  beforeEach(() => localStorage.clear());

  it("ritorna [] su storage vuoto", () => {
    expect(loadTrips()).toEqual([]);
  });

  it("ritorna [] con JSON malformato senza throw", () => {
    localStorage.setItem("atlas.trips.v1", "{not valid json");
    expect(loadTrips()).toEqual([]);
  });

  it("ordina i viaggi dal più recente al meno recente", () => {
    addTrip(makeTrip({ trip_date: "2023-01-01" }));
    addTrip(makeTrip({ trip_date: "2024-06-15" }));
    addTrip(makeTrip({ trip_date: "2022-12-31" }));
    const trips = loadTrips();
    expect(trips[0].trip_date).toBe("2024-06-15");
    expect(trips[1].trip_date).toBe("2023-01-01");
    expect(trips[2].trip_date).toBe("2022-12-31");
  });
});

describe("addTrip", () => {
  beforeEach(() => localStorage.clear());

  it("assegna un id univoco ad ogni viaggio", () => {
    const t1 = addTrip(makeTrip());
    const t2 = addTrip(makeTrip());
    expect(t1.id).toBeTruthy();
    expect(t2.id).toBeTruthy();
    expect(t1.id).not.toBe(t2.id);
  });

  it("assegna created_at come stringa ISO parsabile", () => {
    const t = addTrip(makeTrip());
    expect(t.created_at).toBeTruthy();
    expect(isNaN(new Date(t.created_at).getTime())).toBe(false);
  });

  it("preserva tutti i campi nullable a null", () => {
    const t = addTrip(makeTrip());
    expect(t.date_end).toBeNull();
    expect(t.rating).toBeNull();
    expect(t.notes).toBeNull();
    expect(t.transport_mode).toBeNull();
    expect(t.temperature_c).toBeNull();
    expect(t.altitude_m).toBeNull();
    expect(t.distance_from_home_km).toBeNull();
    expect(t.region).toBeNull();
  });

  it("gestisce waypoints vuoti senza crash", () => {
    const t = addTrip(makeTrip({ waypoints: [] }));
    expect(t.waypoints).toEqual([]);
  });

  it("usa l'id passato esplicitamente invece di generarne uno nuovo", () => {
    const t = addTrip(makeTrip({ city: "Torino" }), "id-bozza-123");
    expect(t.id).toBe("id-bozza-123");
    expect(loadTrips()[0].id).toBe("id-bozza-123");
  });

  it("persiste il viaggio in loadTrips", () => {
    addTrip(makeTrip({ city: "Milano" }));
    const trips = loadTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0].city).toBe("Milano");
  });
});

describe("updateTrip", () => {
  beforeEach(() => localStorage.clear());

  it("aggiorna solo i campi passati, preserva gli altri", () => {
    const t = addTrip(makeTrip({ city: "Roma", rating: 3, notes: "Bella città" }));
    const updated = updateTrip(t.id, { rating: 5 });
    expect(updated).not.toBeNull();
    expect(updated!.rating).toBe(5);
    expect(updated!.city).toBe("Roma");
    expect(updated!.notes).toBe("Bella città");
  });

  it("ritorna null su id inesistente", () => {
    const result = updateTrip("id-che-non-esiste", { rating: 5 });
    expect(result).toBeNull();
  });

  it("non corrompe gli altri viaggi su id inesistente", () => {
    addTrip(makeTrip({ city: "Napoli" }));
    updateTrip("fake-id", { rating: 1 });
    expect(loadTrips()).toHaveLength(1);
    expect(loadTrips()[0].city).toBe("Napoli");
  });

  it("round-trip: addTrip → updateTrip → loadTrips è coerente", () => {
    const t = addTrip(makeTrip({ city: "Venezia", rating: null }));
    updateTrip(t.id, { rating: 4, notes: "Fantastica" });
    const stored = loadTrips().find(x => x.id === t.id)!;
    expect(stored.rating).toBe(4);
    expect(stored.notes).toBe("Fantastica");
    expect(stored.city).toBe("Venezia");
  });
});

describe("deleteTrip", () => {
  beforeEach(() => localStorage.clear());

  it("rimuove solo il viaggio con l'id corretto", () => {
    const t1 = addTrip(makeTrip({ city: "Roma" }));
    const t2 = addTrip(makeTrip({ city: "Milano" }));
    deleteTrip(t1.id);
    const remaining = loadTrips();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(t2.id);
  });

  it("non lancia su id inesistente e non corrompe lo storage", () => {
    addTrip(makeTrip({ city: "Torino" }));
    expect(() => deleteTrip("id-falso")).not.toThrow();
    expect(loadTrips()).toHaveLength(1);
  });
});

describe("todayLocalISO", () => {
  it("usa il calendario locale, non UTC: coerente con getFullYear/getMonth/getDate", () => {
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(todayLocalISO()).toBe(expected);
  });

  it("il formato è sempre YYYY-MM-DD (zero-padded)", () => {
    expect(todayLocalISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("parseLocalDate", () => {
  it("parsa YYYY-MM-DD a mezzanotte locale senza off-by-one UTC", () => {
    const d = parseLocalDate("2024-01-15");
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(0); // gennaio = 0
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
  });

  it("parsa correttamente il 29 febbraio di un anno bisestile", () => {
    const d = parseLocalDate("2024-02-29");
    expect(d.getDate()).toBe(29);
    expect(d.getMonth()).toBe(1);
  });
});

describe("formatTripDate", () => {
  it("produce una stringa non vuota per una data valida", () => {
    const s = formatTripDate("2024-06-15");
    expect(typeof s).toBe("string");
    expect(s.length).toBeGreaterThan(0);
  });

  it("include l'anno nella stringa formattata", () => {
    expect(formatTripDate("2024-06-15")).toContain("2024");
  });
});
