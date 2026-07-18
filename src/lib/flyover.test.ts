import { describe, it, expect } from "vitest";
import { buildFlightPath, bearingBetween, computeLegCamera, buildFlightLegs, pointAlongPath, easeInOutCubic, lerpBearing, FlightStop } from "./flyover";
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

function makeStop(overrides: Partial<FlightStop> = {}): FlightStop {
  return {
    lat: 0, lon: 0, label: "Tappa", tripId: "1",
    photoKey: "1", transportMode: null, routeGeometry: null,
    ...overrides,
  };
}

describe("buildFlightPath", () => {
  it("produce casa → destinazione per un viaggio senza waypoint", () => {
    const stops = buildFlightPath([makeTrip()]);
    expect(stops.map(s => s.label)).toEqual(["Milano", "Roma"]);
  });

  it("la casa ha photoKey 'idViaggio:home' e transportMode/routeGeometry null", () => {
    const trip = makeTrip();
    const [home] = buildFlightPath([trip]);
    expect(home.photoKey).toBe(`${trip.id}:home`);
    expect(home.transportMode).toBeNull();
    expect(home.routeGeometry).toBeNull();
  });

  it("la destinazione ha photoKey = id del viaggio nudo, e riporta transportMode/route_geometry del viaggio", () => {
    const trip = makeTrip({ transport_mode: "car", route_geometry: [[12.5, 41.9], [12.6, 42.0]] });
    const stops = buildFlightPath([trip]);
    const dest = stops[stops.length - 1];
    expect(dest.photoKey).toBe(trip.id);
    expect(dest.transportMode).toBe("car");
    expect(dest.routeGeometry).toEqual([[12.5, 41.9], [12.6, 42.0]]);
  });

  it("un waypoint con id ha photoKey 'idViaggio:waypoint:idTappa' e riporta il proprio transportMode/route_geometry", () => {
    const trip = makeTrip({
      waypoints: [{ id: "wp-1", city: "Torino", country: "Italia", transport_mode: "car", lat: 45.07, lon: 7.68, route_geometry: [[9.19, 45.46], [7.68, 45.07]] }],
    });
    const stops = buildFlightPath([trip]);
    const wp = stops.find(s => s.label === "Torino")!;
    expect(wp.photoKey).toBe(`${trip.id}:waypoint:wp-1`);
    expect(wp.transportMode).toBe("car");
    expect(wp.routeGeometry).toEqual([[9.19, 45.46], [7.68, 45.07]]);
  });

  it("un waypoint senza id (viaggio salvato prima del backfill) ricade sulla photoKey della destinazione", () => {
    const trip = makeTrip({
      waypoints: [{ city: "Torino", country: "Italia", transport_mode: "train", lat: 45.07, lon: 7.68 }],
    });
    const stops = buildFlightPath([trip]);
    const wp = stops.find(s => s.label === "Torino")!;
    expect(wp.photoKey).toBe(trip.id);
  });

  it("inserisce i waypoint tra casa e destinazione, nell'ordine dato", () => {
    const stops = buildFlightPath([makeTrip({
      waypoints: [{ id: "wp-1", city: "Torino", country: "Italia", transport_mode: "train", lat: 45.07, lon: 7.68 }],
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
    const cam = computeLegCamera({ lat: 45.5, lon: 9.2 }, { lat: 45.51, lon: 9.21 });
    expect(cam.zoom).toBe(11);
    expect(cam.pitch).toBe(60);
  });

  it("usa zoom basso e pitch ridotto per tratte intercontinentali (>3000km)", () => {
    // Milano -> Tokyo, ~9700km
    const cam = computeLegCamera({ lat: 45.46, lon: 9.19 }, { lat: 35.68, lon: 139.65 });
    expect(cam.zoom).toBe(2.5);
    expect(cam.pitch).toBe(30);
  });

  it("la durata resta clampata tra 5s e 11s", () => {
    const short = computeLegCamera({ lat: 45.5, lon: 9.2 }, { lat: 45.5001, lon: 9.2001 });
    const long = computeLegCamera({ lat: 45.46, lon: 9.19 }, { lat: 35.68, lon: 139.65 });
    expect(short.durationMs).toBe(5000);
    expect(long.durationMs).toBe(11000);
  });

  it("il bearing della camera coincide con bearingBetween per la stessa tratta", () => {
    const from = { lat: 45.5, lon: 9.2 };
    const to = { lat: 41.9, lon: 12.5 };
    expect(computeLegCamera(from, to).bearing).toBe(bearingBetween(from, to));
  });
});

describe("buildFlightLegs", () => {
  it("produce N-1 tratte per N tappe", () => {
    const stops = buildFlightPath([makeTrip({
      waypoints: [{ id: "wp-1", city: "Torino", country: "Italia", transport_mode: "train", lat: 45.07, lon: 7.68 }],
    })]);
    const legs = buildFlightLegs(stops);
    expect(legs).toHaveLength(2);
    expect(legs[0].from.label).toBe("Milano");
    expect(legs[0].to.label).toBe("Torino");
    expect(legs[1].from.label).toBe("Torino");
    expect(legs[1].to.label).toBe("Roma");
  });

  it("nessuna tratta con una sola tappa", () => {
    const legs = buildFlightLegs([makeStop({ label: "Solo" })]);
    expect(legs).toHaveLength(0);
  });

  it("nessuna tratta con lista vuota", () => {
    expect(buildFlightLegs([])).toHaveLength(0);
  });

  it("pathCoords è una linea retta from→to quando non c'è un percorso stradale", () => {
    const from = makeStop({ lat: 45.5, lon: 9.2 });
    const to = makeStop({ lat: 41.9, lon: 12.5, routeGeometry: null });
    const [leg] = buildFlightLegs([from, to]);
    expect(leg.pathCoords).toEqual([[9.2, 45.5], [12.5, 41.9]]);
  });

  it("pathCoords usa il percorso stradale reale quando presente sulla tappa di arrivo", () => {
    const road: [number, number][] = [[9.2, 45.5], [10, 44], [12.5, 41.9]];
    const from = makeStop({ lat: 45.5, lon: 9.2 });
    const to = makeStop({ lat: 41.9, lon: 12.5, transportMode: "car", routeGeometry: road });
    const [leg] = buildFlightLegs([from, to]);
    expect(leg.pathCoords).toEqual(road);
  });

  it("ignora un percorso stradale con un solo punto (non è un percorso valido)", () => {
    const from = makeStop({ lat: 45.5, lon: 9.2 });
    const to = makeStop({ lat: 41.9, lon: 12.5, routeGeometry: [[12.5, 41.9]] });
    const [leg] = buildFlightLegs([from, to]);
    expect(leg.pathCoords).toEqual([[9.2, 45.5], [12.5, 41.9]]);
  });
});

describe("easeInOutCubic", () => {
  it("t=0 ritorna 0 e t=1 ritorna 1", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });

  it("t=0.5 ritorna 0.5 (simmetrica)", () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5);
  });

  it("è crescente monotona su tutto l'intervallo", () => {
    const samples = Array.from({ length: 11 }, (_, i) => easeInOutCubic(i / 10));
    for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeGreaterThan(samples[i - 1]);
  });

  it("parte più lenta della velocità costante (accelerazione in apertura)", () => {
    // Nella prima metà la curva ease-in-out deve restare sotto la retta t=t
    // (parte piano), altrimenti non risolverebbe il problema misurato dal
    // vivo (la camera che scatta subito quasi a destinazione).
    expect(easeInOutCubic(0.2)).toBeLessThan(0.2);
  });

  it("clampa input fuori range [0,1]", () => {
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
  });
});

describe("lerpBearing", () => {
  it("t=0 ritorna from, t=1 ritorna to", () => {
    expect(lerpBearing(10, 100, 0)).toBe(10);
    expect(lerpBearing(10, 100, 1)).toBe(100);
  });

  it("interpola nel verso corto quando non attraversa 0/360", () => {
    expect(lerpBearing(10, 100, 0.5)).toBeCloseTo(55, 5);
  });

  it("attraversa il giro 0/360 nel verso più breve invece di fare il giro lungo", () => {
    // Da 350° a 10°: il verso breve passa per 0/360 (20° totali), non per 180° (340° il lungo giro)
    const mid = lerpBearing(350, 10, 0.5);
    expect(mid).toBeCloseTo(0, 5);
  });

  it("da 10° a 350° (verso breve all'indietro attraverso 0)", () => {
    const mid = lerpBearing(10, 350, 0.5);
    expect(mid).toBeCloseTo(0, 5);
  });

  it("il risultato resta sempre in [0, 360)", () => {
    for (let t = 0; t <= 1; t += 0.1) {
      const b = lerpBearing(350, 20, t);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(360);
    }
  });
});

describe("pointAlongPath", () => {
  it("t=0 ritorna il primo punto", () => {
    expect(pointAlongPath([[0, 0], [10, 10]], 0)).toEqual([0, 0]);
  });

  it("t=1 ritorna l'ultimo punto", () => {
    expect(pointAlongPath([[0, 0], [10, 10]], 1)).toEqual([10, 10]);
  });

  it("t=0.5 su un percorso a due punti ritorna circa il punto medio", () => {
    const [lon, lat] = pointAlongPath([[0, 0], [10, 0]], 0.5);
    expect(lon).toBeCloseTo(5, 0);
    expect(lat).toBeCloseTo(0, 5);
  });

  it("su un percorso con segmenti di lunghezza diversa avanza in proporzione alla distanza reale, non al numero di punti", () => {
    // Primo segmento molto più lungo del secondo: a metà percorso (per distanza)
    // il punto deve trovarsi ancora dentro il primo segmento, non al secondo vertice.
    const path: [number, number][] = [[0, 0], [10, 0], [10.1, 0]];
    const [lon] = pointAlongPath(path, 0.5);
    expect(lon).toBeLessThan(10);
  });

  it("un percorso con un solo punto ritorna sempre quel punto", () => {
    expect(pointAlongPath([[5, 5]], 0.3)).toEqual([5, 5]);
  });

  it("un percorso vuoto non lancia un errore", () => {
    expect(pointAlongPath([], 0.5)).toEqual([0, 0]);
  });
});
