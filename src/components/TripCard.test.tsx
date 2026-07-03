import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TripCard } from "./TripCard";
import { SettingsProvider } from "@/lib/settings";
import type { Trip } from "@/lib/storage";
import React from "react";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderCard(trip: Trip, props: Partial<{ selected: boolean; onClick: () => void; onDeleted: () => void }> = {}) {
  return render(
    <MemoryRouter>
      <SettingsProvider>
        <TripCard trip={trip} {...props} />
      </SettingsProvider>
    </MemoryRouter>
  );
}

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "card-id-1",
    created_at: new Date().toISOString(),
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

describe("TripCard — render base", () => {
  beforeEach(() => { localStorage.clear(); mockNavigate.mockClear(); });

  it("renderizza senza crash con campi minimi", () => {
    expect(() => renderCard(makeTrip())).not.toThrow();
  });

  it("mostra city come displayTitle quando title === city", () => {
    renderCard(makeTrip({ title: "Roma", city: "Roma" }));
    expect(screen.getAllByText("Roma").length).toBeGreaterThanOrEqual(1);
  });

  it("mostra title custom quando title !== city", () => {
    renderCard(makeTrip({ title: "Vacanza al mare", city: "Rimini" }));
    expect(screen.getByText("Vacanza al mare")).toBeInTheDocument();
  });

  it("mostra city e country come sottotitolo quando title !== city", () => {
    renderCard(makeTrip({ title: "Vacanza al mare", city: "Rimini", country: "Italia" }));
    expect(screen.getByText("Rimini, Italia")).toBeInTheDocument();
  });

  it("mostra solo country nel sottotitolo quando title === city", () => {
    renderCard(makeTrip({ title: "Roma", city: "Roma", country: "Italia" }));
    expect(screen.getByText("Italia")).toBeInTheDocument();
  });

  it("mostra 🌍 senza country_code", () => {
    renderCard(makeTrip({ country_code: undefined as any }));
    expect(screen.getByText("🌍")).toBeInTheDocument();
  });
});

describe("TripCard — StarDisplay", () => {
  it("non renderizza stelle con rating=null", () => {
    renderCard(makeTrip({ rating: null }));
    // Le stelle colorate (gialle) non devono essere visibili
    const stars = screen.queryAllByText("★");
    const yellowStars = stars.filter(s => (s as HTMLElement).style?.color === "rgb(251, 191, 36)");
    expect(yellowStars).toHaveLength(0);
  });

  it("renderizza 3 stelle gialle con rating=3", () => {
    renderCard(makeTrip({ rating: 3 }));
    // 5 stelle totali presenti nel DOM (3 colorate + 2 grigie)
    const stars = screen.getAllByText("★");
    expect(stars).toHaveLength(5);
  });
});

describe("TripCard — date e giorni", () => {
  it("non mostra i giorni con date_end=null", () => {
    renderCard(makeTrip({ trip_date: "2024-01-01", date_end: null }));
    expect(screen.queryByText(/\dg$/)).not.toBeInTheDocument();
  });

  it("non mostra i giorni con date_end === trip_date", () => {
    renderCard(makeTrip({ trip_date: "2024-01-01", date_end: "2024-01-01" }));
    expect(screen.queryByText(/\dg$/)).not.toBeInTheDocument();
  });

  it("mostra i giorni corretti con date_end diversa", () => {
    renderCard(makeTrip({ trip_date: "2024-01-01", date_end: "2024-01-08" }));
    expect(screen.getByText("· 7g")).toBeInTheDocument();
  });
});

describe("TripCard — pills (mezzo, distanza, altitudine, temperatura)", () => {
  it("mostra pill 'Aereo' con transport_mode=plane", () => {
    renderCard(makeTrip({ transport_mode: "plane" }));
    expect(screen.getByText("Aereo")).toBeInTheDocument();
  });

  it("non mostra pill mezzo senza transport_mode", () => {
    renderCard(makeTrip({ transport_mode: null }));
    expect(screen.queryByText("Aereo")).not.toBeInTheDocument();
  });

  it("mostra la distanza se distance_from_home_km è presente", () => {
    renderCard(makeTrip({ distance_from_home_km: 750 }));
    expect(screen.getByText("750 km")).toBeInTheDocument();
  });

  it("mostra l'altitudine se altitude_m è presente", () => {
    renderCard(makeTrip({ altitude_m: 1500 }));
    expect(screen.getByText("1500 m")).toBeInTheDocument();
  });

  it("mostra la temperatura se temperature_c è presente", () => {
    renderCard(makeTrip({ temperature_c: 18 }));
    expect(screen.getByText("18.0°C")).toBeInTheDocument();
  });
});

describe("TripCard — selected prop", () => {
  it("con selected=false non applica outline visibile", () => {
    const { container } = renderCard(makeTrip(), { selected: false });
    const card = container.querySelector("[style*='outline']");
    expect(card?.getAttribute("style")).toContain("outline: none");
  });

  it("con selected=true applica outline", () => {
    const { container } = renderCard(makeTrip(), { selected: true });
    const card = container.querySelector("[style*='outline']");
    expect(card?.getAttribute("style")).not.toContain("outline: none");
  });
});

describe("TripCard — onClick", () => {
  it("chiama onClick al click sulla card", () => {
    const onClick = vi.fn();
    const { container } = renderCard(makeTrip(), { onClick });
    const card = container.querySelector(".glass-card")!;
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("TripCard — edit e delete", () => {
  beforeEach(() => { localStorage.clear(); mockNavigate.mockClear(); });

  it("click edit naviga a /modifica-viaggio/:id e stoppa propagazione", () => {
    const onClick = vi.fn();
    renderCard(makeTrip({ id: "xyz-99" }), { onClick });
    const buttons = screen.getAllByRole("button");
    const editBtn = buttons[0]; // primo bottone = edit
    fireEvent.click(editBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/modifica-viaggio/xyz-99");
    expect(onClick).not.toHaveBeenCalled(); // stopPropagation
  });

  it("primo click delete non elimina (richiede conferma)", () => {
    const onDeleted = vi.fn();
    renderCard(makeTrip(), { onDeleted });
    const buttons = screen.getAllByRole("button");
    const deleteBtn = buttons[1];
    fireEvent.click(deleteBtn);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("secondo click delete chiama onDeleted", () => {
    const trip = makeTrip({ id: "del-card" });
    localStorage.setItem("atlas.trips.v1", JSON.stringify([trip]));
    const onDeleted = vi.fn();
    renderCard(trip, { onDeleted });
    const buttons = screen.getAllByRole("button");
    const deleteBtn = buttons[1];
    fireEvent.click(deleteBtn); // confirm
    fireEvent.click(deleteBtn); // delete
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it("click delete stoppa propagazione verso onClick della card", () => {
    const onClick = vi.fn();
    const onDeleted = vi.fn();
    renderCard(makeTrip(), { onClick, onDeleted });
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]);
    expect(onClick).not.toHaveBeenCalled();
  });
});
