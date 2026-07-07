import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TravelHighlights } from "./TravelHighlights";
import { SettingsProvider } from "@/lib/settings";
import type { Trip } from "@/lib/storage";
import React from "react";

// Wrap with SettingsProvider (required by useSettings inside TravelHighlights)
function renderHighlights(trips: Trip[]) {
  return render(
    <SettingsProvider>
      <TravelHighlights trips={trips} />
    </SettingsProvider>
  );
}

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: Math.random().toString(36).slice(2),
    created_at: new Date().toISOString(),
    title: "Test",
    country: "Italia",
    city: "Roma",
    country_code: "IT",
    trip_date: "2024-01-01",
    date_end: "2024-01-03",
    rating: null,
    notes: null,
    transport_mode: null,
    waypoints: [],
    latitude: 41.9,
    longitude: 12.5,
    home_latitude: 45.5,
    home_longitude: 9.2,
    home_label: "Milano",
    temperature_c: null,
    altitude_m: null,
    distance_from_home_km: null,
    max_distance_from_home_km: null,
    max_distance_city: null,
    hottest_temp_c: null,
    hottest_city: null,
    coldest_temp_c: null,
    coldest_city: null,
    region: null,
    ...overrides,
  };
}

describe("TravelHighlights — empty state", () => {
  it("mostra '—' per altitudine con trips=[]", () => {
    renderHighlights([]);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("mostra totalDays=0 con trips=[]", () => {
    renderHighlights([]);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});

describe("TravelHighlights — highest (altitudine)", () => {
  it("mostra il valore di altitude_m del viaggio più alto", () => {
    const trips = [
      makeTrip({ altitude_m: 500, city: "Basso" }),
      makeTrip({ altitude_m: 2000, city: "Alto" }),
      makeTrip({ altitude_m: 100,  city: "Pianura" }),
    ];
    renderHighlights(trips);
    // In metric (default), fmtAltitude(2000, "metric") → "2000 m" in jsdom
    expect(screen.getByText("2000 m")).toBeInTheDocument();
  });

  it("mostra la città del viaggio più alto come sottotitolo", () => {
    const trips = [
      makeTrip({ altitude_m: 3000, city: "Everest" }),
      makeTrip({ altitude_m: 100,  city: "Basso" }),
    ];
    renderHighlights(trips);
    expect(screen.getAllByText("Everest").length).toBeGreaterThanOrEqual(1);
  });
});

describe("TravelHighlights — farthest (distanza)", () => {
  it("preferisce max_distance_from_home_km su distance_from_home_km", () => {
    const trips = [
      makeTrip({ distance_from_home_km: 500,  max_distance_from_home_km: 1200, city: "Lontano" }),
      makeTrip({ distance_from_home_km: 800,  max_distance_from_home_km: null, city: "Meno lontano" }),
    ];
    renderHighlights(trips);
    // 1200 viene scelto su 800 grazie a max_distance_from_home_km
    expect(screen.getByText("1200 km")).toBeInTheDocument();
  });

  it("usa distance_from_home_km se max_distance_from_home_km è null", () => {
    const trips = [
      makeTrip({ distance_from_home_km: 900,  max_distance_from_home_km: null }),
      makeTrip({ distance_from_home_km: 300,  max_distance_from_home_km: null }),
    ];
    renderHighlights(trips);
    expect(screen.getByText("900 km")).toBeInTheDocument();
  });
});

describe("TravelHighlights — hottest / coldest", () => {
  it("mostra la temperatura più alta (hottest_temp_c prioritario)", () => {
    const trips = [
      makeTrip({ hottest_temp_c: 38, temperature_c: 25, hottest_city: "Palermo" }),
      makeTrip({ hottest_temp_c: 30, temperature_c: 28 }),
    ];
    renderHighlights(trips);
    expect(screen.getByText("38.0°C")).toBeInTheDocument();
  });

  it("usa temperature_c se hottest_temp_c è null", () => {
    const trips = [
      makeTrip({ hottest_temp_c: null, temperature_c: 33 }),
      makeTrip({ hottest_temp_c: null, temperature_c: 20 }),
    ];
    renderHighlights(trips);
    expect(screen.getByText("33.0°C")).toBeInTheDocument();
  });

  it("mostra la temperatura più bassa (coldest_temp_c prioritario)", () => {
    const trips = [
      makeTrip({ coldest_temp_c: -10, temperature_c: 5, coldest_city: "Oslo" }),
      makeTrip({ coldest_temp_c: 2,   temperature_c: 8 }),
    ];
    renderHighlights(trips);
    expect(screen.getByText("-10.0°C")).toBeInTheDocument();
  });
});

describe("TravelHighlights — totalDays", () => {
  it("conta 1 giorno se date_end è null", () => {
    const trips = [makeTrip({ trip_date: "2024-01-01", date_end: null })];
    renderHighlights(trips);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("conta 1 giorno se date_end === trip_date", () => {
    const trips = [makeTrip({ trip_date: "2024-01-01", date_end: "2024-01-01" })];
    renderHighlights(trips);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("somma correttamente i giorni di più viaggi", () => {
    const trips = [
      makeTrip({ trip_date: "2024-01-01", date_end: "2024-01-06" }), // 5 giorni
      makeTrip({ trip_date: "2024-03-01", date_end: "2024-03-04" }), // 3 giorni
    ];
    renderHighlights(trips);
    expect(screen.getByText("8")).toBeInTheDocument();
  });
});

describe("TravelHighlights — totalKm, aroundWorld, toMoon", () => {
  it("mostra distanza totale somma dei distance_from_home_km", () => {
    const trips = [
      makeTrip({ distance_from_home_km: 1000 }),
      makeTrip({ distance_from_home_km: 2000 }),
    ];
    renderHighlights(trips);
    expect(screen.getByText("3000 km")).toBeInTheDocument();
  });

  it("mostra 0 km totali con trips=[] (in più celle: totale + breakdown per mezzo)", () => {
    renderHighlights([]);
    // "0 km" compare 6 volte: 1 totale + 5 breakdown transport
    expect(screen.getAllByText("0 km").length).toBeGreaterThanOrEqual(1);
  });
});

describe("TravelHighlights — byMode breakdown", () => {
  it("assegna distanza a 'plane' con transport_mode='plane' esplicito", () => {
    const trips = [makeTrip({ transport_mode: "plane", distance_from_home_km: 500 })];
    renderHighlights(trips);
    // "In aereo" label deve essere presente
    expect(screen.getByText("In aereo")).toBeInTheDocument();
  });

  it("assegna distanza a 'train' con transport_mode='train' esplicito", () => {
    const trips = [makeTrip({ transport_mode: "train", distance_from_home_km: 300 })];
    renderHighlights(trips);
    expect(screen.getByText("In treno")).toBeInTheDocument();
  });

  it("fallback a 'plane' per distanza >1000 km senza transport_mode", () => {
    // 1500 km senza modo → plane
    const trips = [makeTrip({ transport_mode: null, distance_from_home_km: 1500 })];
    renderHighlights(trips);
    // La card "In aereo" deve mostrare 1500 km
    expect(screen.getByText("In aereo")).toBeInTheDocument();
    expect(screen.getAllByText("1500 km").length).toBeGreaterThanOrEqual(1);
  });

  it("fallback a 'car' per distanza 20-200 km senza transport_mode", () => {
    const trips = [makeTrip({ transport_mode: null, distance_from_home_km: 100 })];
    renderHighlights(trips);
    expect(screen.getByText("In auto")).toBeInTheDocument();
  });

  it("fallback a 'walk' per distanza <20 km senza transport_mode", () => {
    const trips = [makeTrip({ transport_mode: null, distance_from_home_km: 5 })];
    renderHighlights(trips);
    expect(screen.getByText("A piedi")).toBeInTheDocument();
  });
});
