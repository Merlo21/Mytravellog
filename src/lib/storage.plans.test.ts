import { describe, it, expect, beforeEach } from "vitest";
import {
  addPlan, loadPlans, updatePlan, deletePlan, promotePlanToTrip,
  loadTrips, type Trip,
} from "./storage";

function basePlan(over: Partial<Omit<Trip, "id" | "created_at" | "status">> = {}): Omit<Trip, "id" | "created_at" | "status"> {
  return {
    title: "Islanda", country: "Islanda", city: "Reykjavík", country_code: "IS",
    trip_date: "2099-09-12", date_end: "2099-09-19", rating: null, notes: null,
    transport_mode: "plane", waypoints: [],
    latitude: 64.1, longitude: -21.9, home_latitude: null, home_longitude: null, home_label: null,
    route_geometry: null, temperature_c: null, altitude_m: null, max_altitude_m: null, max_altitude_city: null,
    distance_from_home_km: null, max_distance_from_home_km: null, max_distance_city: null,
    hottest_temp_c: null, hottest_city: null, coldest_temp_c: null, coldest_city: null,
    region: null, region_details: null,
    ...over,
  };
}

describe("plans bucket (viaggi in programma)", () => {
  beforeEach(() => localStorage.clear());

  it("addPlan salva con status 'planned' e NON nel bucket del diario", () => {
    addPlan(basePlan());
    const plans = loadPlans();
    expect(plans).toHaveLength(1);
    expect(plans[0].status).toBe("planned");
    expect(loadTrips()).toHaveLength(0); // niente leak nel diario
  });

  it("loadPlans ordina per data di partenza crescente (i più imminenti prima)", () => {
    addPlan(basePlan({ title: "Tardi", trip_date: "2099-12-01" }));
    addPlan(basePlan({ title: "Presto", trip_date: "2099-01-01" }));
    expect(loadPlans().map(p => p.title)).toEqual(["Presto", "Tardi"]);
  });

  it("updatePlan applica il patch (budget/checklist)", () => {
    const p = addPlan(basePlan());
    updatePlan(p.id, { budget: [{ label: "Volo", amount: 500 }], checklist: [{ text: "Prenota", done: true }] });
    const updated = loadPlans()[0];
    expect(updated.budget).toEqual([{ label: "Volo", amount: 500 }]);
    expect(updated.checklist).toEqual([{ text: "Prenota", done: true }]);
  });

  it("deletePlan rimuove solo il piano indicato", () => {
    const a = addPlan(basePlan({ title: "A" }));
    addPlan(basePlan({ title: "B" }));
    deletePlan(a.id);
    expect(loadPlans().map(p => p.title)).toEqual(["B"]);
  });

  it("promotePlanToTrip sposta il piano nel diario come 'done', conservando budget/checklist", () => {
    const p = addPlan(basePlan({ budget: [{ label: "Volo", amount: 500 }], checklist: [{ text: "x", done: false }] }));
    const done = promotePlanToTrip(p.id);
    expect(done?.status).toBe("done");
    expect(loadPlans()).toHaveLength(0);      // rimosso dai piani
    const trips = loadTrips();
    expect(trips).toHaveLength(1);            // aggiunto al diario
    expect(trips[0].id).toBe(p.id);
    expect(trips[0].status).toBe("done");
    expect(trips[0].budget).toEqual([{ label: "Volo", amount: 500 }]);
    expect(trips[0].checklist).toEqual([{ text: "x", done: false }]);
  });

  it("promotePlanToTrip ritorna null se l'id non esiste", () => {
    expect(promotePlanToTrip("inesistente")).toBeNull();
  });

  it("promotePlanToTrip conserva l'itinerario multi-tappa (waypoints coi mezzi)", () => {
    const wps = [
      { id: "w1", city: "Reykjavík", country: "Islanda", country_code: "IS", transport_mode: "plane" as const, lat: 64.1, lon: -21.9, route_geometry: null },
      { id: "w2", city: "Vík", country: "Islanda", country_code: "IS", transport_mode: "car" as const, lat: 63.4, lon: -19.0, route_geometry: null },
    ];
    const p = addPlan(basePlan({ city: "Höfn", latitude: 64.25, longitude: -15.2, transport_mode: "car", waypoints: wps }));
    const done = promotePlanToTrip(p.id);
    expect(done?.waypoints).toEqual(wps);          // tappe intermedie intatte
    expect(done?.city).toBe("Höfn");                // meta finale intatta
    expect(done?.transport_mode).toBe("car");       // mezzo dell'ultima tratta intatto
  });
});
