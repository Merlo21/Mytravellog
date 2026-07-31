import { describe, it, expect, beforeEach } from "vitest";
import {
  addTrip, loadTrips, shareTrip, unshareTrip, sharedTrips,
  type Trip,
} from "./storage";

function baseTrip(over: Partial<Omit<Trip, "id" | "created_at">> = {}): Omit<Trip, "id" | "created_at"> {
  return {
    title: "Parigi", country: "Francia", city: "Parigi", country_code: "FR",
    trip_date: "2023-06-10", date_end: "2023-06-12", rating: 5, notes: null,
    transport_mode: "plane", waypoints: [],
    latitude: 48.85, longitude: 2.35, home_latitude: null, home_longitude: null, home_label: null,
    route_geometry: null, temperature_c: null, altitude_m: null, max_altitude_m: null, max_altitude_city: null,
    distance_from_home_km: null, max_distance_from_home_km: null, max_distance_city: null,
    hottest_temp_c: null, hottest_city: null, coldest_temp_c: null, coldest_city: null,
    region: null, region_details: null,
    ...over,
  };
}

describe("condivisione a flag (viaggi di coppia)", () => {
  beforeEach(() => localStorage.clear());

  it("shareTrip mette il flag ma il viaggio RESTA nel diario personale", () => {
    const t = addTrip(baseTrip({ title: "Luna di miele" }));
    shareTrip(t.id);
    const trips = loadTrips();
    expect(trips).toHaveLength(1);                 // sempre visibile fra i tuoi
    expect(trips[0].shared).toBe(true);
  });

  it("sharedTrips ritorna solo i viaggi flaggati", () => {
    const a = addTrip(baseTrip({ title: "A" }));
    addTrip(baseTrip({ title: "B" }));
    shareTrip(a.id);
    expect(loadTrips()).toHaveLength(2);           // vedi comunque tutti
    expect(sharedTrips().map(t => t.title)).toEqual(["A"]);
  });

  it("unshareTrip toglie il flag ma lascia il viaggio nel diario", () => {
    const t = addTrip(baseTrip());
    shareTrip(t.id);
    unshareTrip(t.id);
    expect(loadTrips()).toHaveLength(1);
    expect(loadTrips()[0].shared).toBe(false);
    expect(sharedTrips()).toHaveLength(0);
  });

  it("share/unshare ritornano null se l'id non esiste", () => {
    expect(shareTrip("inesistente")).toBeNull();
    expect(unshareTrip("inesistente")).toBeNull();
  });

  it("i viaggi nuovi non sono condivisi di default", () => {
    const t = addTrip(baseTrip());
    expect(t.shared).toBeUndefined();
    expect(sharedTrips()).toHaveLength(0);
  });
});
