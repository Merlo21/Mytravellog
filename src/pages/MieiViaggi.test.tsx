import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MieiViaggi from "./MieiViaggi";
import { SettingsProvider } from "@/lib/settings";
import { addTrip, loadTrips } from "@/lib/storage";
import type { Trip } from "@/lib/storage";
import React from "react";

// Mock AppHeader to avoid rendering full nav
vi.mock("@/components/AppHeader", () => ({
  AppHeader: () => <header data-testid="app-header" />,
}));

// Mock TripCardTicket to keep tests focused on MieiViaggi logic
vi.mock("@/components/TripCardTicket", () => ({
  TripCardTicket: ({ trip, onDeleted }: { trip: Trip; onDeleted?: () => void }) => (
    <div data-testid="trip-card" data-city={trip.city} data-year={trip.trip_date?.slice(0, 4)}>
      <span>{trip.city}</span>
      <span>{trip.country}</span>
      <span>{trip.title}</span>
    </div>
  ),
}));

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SettingsProvider>
        <MieiViaggi />
      </SettingsProvider>
    </MemoryRouter>
  );
}

function baseTrip(overrides: Partial<Omit<Trip, "id" | "created_at">> = {}): Omit<Trip, "id" | "created_at"> {
  return {
    title: "Viaggio",
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
    ...overrides,
  };
}

describe("MieiViaggi — empty state", () => {
  beforeEach(() => localStorage.clear());

  it("mostra 'Nessun viaggio ancora' senza viaggi", () => {
    renderPage();
    expect(screen.getByText(/nessun viaggio ancora/i)).toBeInTheDocument();
  });

  it("mostra '0 viaggi' nel sottotitolo", () => {
    renderPage();
    expect(screen.getByText(/0 viaggi/i)).toBeInTheDocument();
  });
});

describe("MieiViaggi — lista viaggi", () => {
  beforeEach(() => localStorage.clear());

  it("mostra le card dei viaggi presenti", () => {
    addTrip(baseTrip({ city: "Roma" }));
    addTrip(baseTrip({ city: "Milano" }));
    renderPage();
    expect(screen.getAllByTestId("trip-card")).toHaveLength(2);
  });

  it("mostra '1 viaggio' (singolare) con un solo viaggio", () => {
    addTrip(baseTrip());
    renderPage();
    expect(screen.getByText("1 viaggio")).toBeInTheDocument();
  });

  it("mostra '3 viaggi' (plurale) con tre viaggi", () => {
    addTrip(baseTrip());
    addTrip(baseTrip());
    addTrip(baseTrip());
    renderPage();
    expect(screen.getByText("3 viaggi")).toBeInTheDocument();
  });
});

describe("MieiViaggi — raggruppamento per anno", () => {
  beforeEach(() => localStorage.clear());

  it("raggruppa correttamente i viaggi per anno", () => {
    addTrip(baseTrip({ trip_date: "2023-03-10" }));
    addTrip(baseTrip({ trip_date: "2024-07-15" }));
    renderPage();
    expect(screen.getByText("2023")).toBeInTheDocument();
    expect(screen.getByText("2024")).toBeInTheDocument();
  });

  it("ordina gli anni in modo decrescente (più recente prima)", () => {
    addTrip(baseTrip({ trip_date: "2022-01-01" }));
    addTrip(baseTrip({ trip_date: "2024-01-01" }));
    addTrip(baseTrip({ trip_date: "2023-01-01" }));
    renderPage();
    const years = screen.getAllByText(/^202[2-4]$/);
    expect(years[0].textContent).toBe("2024");
    expect(years[1].textContent).toBe("2023");
    expect(years[2].textContent).toBe("2022");
  });

  it("mostra il contatore corretto per anno", () => {
    addTrip(baseTrip({ trip_date: "2024-01-01" }));
    addTrip(baseTrip({ trip_date: "2024-06-15" }));
    addTrip(baseTrip({ trip_date: "2023-08-20" }));
    renderPage();
    // Anno 2024 → 2 viaggi, 2023 → 1 viaggio
    const counters = screen.getAllByText("2");
    expect(counters.length).toBeGreaterThanOrEqual(1);
  });
});

describe("MieiViaggi — ricerca", () => {
  beforeEach(() => localStorage.clear());

  it("filtra per city (case-insensitive)", () => {
    addTrip(baseTrip({ city: "Roma",   title: "Roma" }));
    addTrip(baseTrip({ city: "Milano", title: "Milano" }));
    renderPage();
    const input = screen.getByPlaceholderText(/cerca città/i);
    fireEvent.change(input, { target: { value: "roma" } });
    const cards = screen.getAllByTestId("trip-card");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveAttribute("data-city", "Roma");
  });

  it("filtra per country (case-insensitive)", () => {
    addTrip(baseTrip({ country: "Italia",  city: "Roma" }));
    addTrip(baseTrip({ country: "Francia", city: "Parigi" }));
    renderPage();
    const input = screen.getByPlaceholderText(/cerca città/i);
    fireEvent.change(input, { target: { value: "francia" } });
    const cards = screen.getAllByTestId("trip-card");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveAttribute("data-city", "Parigi");
  });

  it("filtra per title", () => {
    addTrip(baseTrip({ title: "Vacanza estiva", city: "Palermo" }));
    addTrip(baseTrip({ title: "Weekend Milano", city: "Milano" }));
    renderPage();
    const input = screen.getByPlaceholderText(/cerca città/i);
    fireEvent.change(input, { target: { value: "estiva" } });
    const cards = screen.getAllByTestId("trip-card");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveAttribute("data-city", "Palermo");
  });

  it("ricerca vuota mostra tutti i viaggi", () => {
    addTrip(baseTrip({ city: "Roma" }));
    addTrip(baseTrip({ city: "Milano" }));
    addTrip(baseTrip({ city: "Napoli" }));
    renderPage();
    const input = screen.getByPlaceholderText(/cerca città/i);
    fireEvent.change(input, { target: { value: "roma" } });
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getAllByTestId("trip-card")).toHaveLength(3);
  });

  it("nessun risultato → mostra 'Nessun risultato'", () => {
    addTrip(baseTrip({ city: "Roma" }));
    renderPage();
    const input = screen.getByPlaceholderText(/cerca città/i);
    fireEvent.change(input, { target: { value: "xyzabc" } });
    expect(screen.getByText(/nessun risultato/i)).toBeInTheDocument();
  });

  it("click sul pulsante X resetta la ricerca", () => {
    addTrip(baseTrip({ city: "Roma" }));
    addTrip(baseTrip({ city: "Milano" }));
    renderPage();
    const input = screen.getByPlaceholderText(/cerca città/i);
    fireEvent.change(input, { target: { value: "roma" } });
    expect(screen.getAllByTestId("trip-card")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "" })); // X button
    expect(screen.getAllByTestId("trip-card")).toHaveLength(2);
  });
});
