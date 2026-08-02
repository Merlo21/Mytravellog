import { describe, it, expect, beforeEach } from "vitest";
import { mergeSharedContribution, sharedMapView } from "./coupleSync";
import { addTrip, shareTrip, type Trip } from "./storage";

const t = (id: string, sharedBy?: string): Trip => ({ id, sharedBy } as Trip);

function baseTrip(over: Partial<Omit<Trip, "id" | "created_at">> = {}): Omit<Trip, "id" | "created_at"> {
  return {
    title: "X", country: "Italia", city: "Roma", country_code: "IT",
    trip_date: "2023-06-10", date_end: null, rating: null, notes: null,
    transport_mode: "plane", waypoints: [],
    latitude: 41.9, longitude: 12.5, home_latitude: null, home_longitude: null, home_label: null,
    route_geometry: null, temperature_c: null, altitude_m: null, max_altitude_m: null, max_altitude_city: null,
    distance_from_home_km: null, max_distance_from_home_km: null, max_distance_city: null,
    hottest_temp_c: null, hottest_city: null, coldest_temp_c: null, coldest_city: null,
    region: null, region_details: null, ...over,
  };
}

describe("mergeSharedContribution (cuore sync viaggi di coppia)", () => {
  const ME = "me@gmail.com", YOU = "you@gmail.com";

  it("timbra i miei viaggi con la mia email", () => {
    const out = mergeSharedContribution([], [t("a"), t("b")], ME);
    expect(out.map(x => x.id)).toEqual(["a", "b"]);
    expect(out.every(x => x.sharedBy === ME)).toBe(true);
  });

  it("preserva i viaggi del partner e aggiunge i miei", () => {
    const remote = [t("p1", YOU), t("p2", YOU)];
    const out = mergeSharedContribution(remote, [t("a")], ME);
    expect(out.map(x => `${x.id}:${x.sharedBy}`)).toEqual([`p1:${YOU}`, `p2:${YOU}`, `a:${ME}`]);
  });

  it("SOSTITUISCE i miei vecchi (togliere la condivisione si propaga)", () => {
    // il file aveva 2 miei; ora ne condivido solo 1 → l'altro sparisce
    const remote = [t("p1", YOU), t("a", ME), t("b", ME)];
    const out = mergeSharedContribution(remote, [t("a")], ME);
    expect(out.map(x => x.id)).toEqual(["p1", "a"]); // b rimosso, p1 (partner) intatto
  });

  it("riassorbe i viaggi legacy senza timbro (non li tratta come del partner)", () => {
    const remote = [t("legacy")]; // sharedBy assente
    const out = mergeSharedContribution(remote, [t("a")], ME);
    expect(out.map(x => x.id)).toEqual(["a"]); // legacy scartato, sostituito dai miei timbrati
  });

  it("non tocca mai i viaggi del partner anche se non ho nulla da condividere", () => {
    const remote = [t("p1", YOU)];
    const out = mergeSharedContribution(remote, [], ME);
    expect(out.map(x => x.id)).toEqual(["p1"]);
  });
});

describe("sharedMapView (vista unita miei + partner)", () => {
  const ME = "me@gmail.com", YOU = "you@gmail.com";
  beforeEach(() => localStorage.clear());

  it("senza cache/email mostra solo i miei viaggi condivisi (freschi)", () => {
    const a = addTrip(baseTrip({ title: "A" }));
    addTrip(baseTrip({ title: "B" }));
    shareTrip(a.id);
    expect(sharedMapView().map(x => x.id)).toEqual([a.id]);
  });

  it("un viaggio appena condiviso appare SUBITO anche se non è in cache (il bug)", () => {
    // cache da un vecchio sync (solo un viaggio del partner), poi condivido un nuovo mio viaggio
    localStorage.setItem("atlas.shared.myEmail", ME);
    localStorage.setItem("atlas.shared.cache.v1", JSON.stringify([{ id: "p1", sharedBy: YOU }]));
    const a = addTrip(baseTrip({ title: "Nuovo" }));
    shareTrip(a.id);
    const ids = sharedMapView().map(x => x.id);
    expect(ids).toContain(a.id); // il mio, fresco
    expect(ids).toContain("p1"); // il partner, dalla cache
  });

  it("dedup: il mio viaggio non appare due volte anche se è pure in cache timbrato", () => {
    localStorage.setItem("atlas.shared.myEmail", ME);
    const a = addTrip(baseTrip());
    shareTrip(a.id);
    localStorage.setItem("atlas.shared.cache.v1", JSON.stringify([{ id: a.id, sharedBy: ME }, { id: "p1", sharedBy: YOU }]));
    expect(sharedMapView().map(x => x.id)).toEqual([a.id, "p1"]);
  });
});
