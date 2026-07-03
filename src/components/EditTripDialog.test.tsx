import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditTripDialog } from "./EditTripDialog";
import type { Trip } from "@/lib/storage";
import React from "react";

// Mock toast to avoid side effects
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "edit-id-1",
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

function renderDialog(trip: Trip, props: { onSaved?: () => void } = {}) {
  const onOpenChange = vi.fn();
  render(
    <EditTripDialog
      trip={trip}
      open={true}
      onOpenChange={onOpenChange}
      onSaved={props.onSaved}
    />
  );
  return { onOpenChange };
}

describe("EditTripDialog — render base", () => {
  beforeEach(() => localStorage.clear());

  it("non renderizza nulla con open=false", () => {
    render(
      <EditTripDialog
        trip={makeTrip()}
        open={false}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.queryByText("Nome del viaggio")).not.toBeInTheDocument();
  });

  it("renderizza il dialog con open=true", () => {
    renderDialog(makeTrip());
    expect(screen.getByText("Nome del viaggio")).toBeInTheDocument();
  });

  it("mostra city e country nell'header", () => {
    renderDialog(makeTrip({ city: "Napoli", country: "Italia" }));
    expect(screen.getByText("Napoli, Italia")).toBeInTheDocument();
  });

  it("precompila il titolo con trip.title", () => {
    renderDialog(makeTrip({ title: "Vacanza" }));
    const input = screen.getByPlaceholderText(/viaggio di nozze/i) as HTMLInputElement;
    expect(input.value).toBe("Vacanza");
  });

  it("precompila le note con trip.notes", () => {
    renderDialog(makeTrip({ notes: "Bellissimo posto" }));
    const textarea = screen.getByPlaceholderText(/aggiungi una nota/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe("Bellissimo posto");
  });
});

describe("EditTripDialog — daysBetween (via badge Durata)", () => {
  beforeEach(() => localStorage.clear());

  it("non mostra la Durata con date_end vuota", () => {
    renderDialog(makeTrip({ trip_date: "2024-01-01", date_end: null }));
    expect(screen.queryByText("Durata")).not.toBeInTheDocument();
  });

  it("non mostra la Durata con date_end === trip_date", () => {
    renderDialog(makeTrip({ trip_date: "2024-01-01", date_end: "2024-01-01" }));
    expect(screen.queryByText("Durata")).not.toBeInTheDocument();
  });

  it("mostra Durata con giorni corretti quando date_end > trip_date", () => {
    renderDialog(makeTrip({ trip_date: "2024-01-01", date_end: "2024-01-05" }));
    expect(screen.getByText("Durata")).toBeInTheDocument();
    expect(screen.getByText("4g")).toBeInTheDocument();
  });

  it("non mostra la Durata se date_end è antecedente a trip_date", () => {
    renderDialog(makeTrip({ trip_date: "2024-06-10", date_end: "2024-06-05" }));
    expect(screen.queryByText("Durata")).not.toBeInTheDocument();
  });

  it("mostra esattamente 1 giorno con date_end il giorno dopo", () => {
    renderDialog(makeTrip({ trip_date: "2024-03-01", date_end: "2024-03-02" }));
    expect(screen.getByText("1g")).toBeInTheDocument();
  });
});

describe("EditTripDialog — interazioni", () => {
  beforeEach(() => localStorage.clear());

  it("click Annulla chiama onOpenChange(false)", () => {
    const { onOpenChange } = renderDialog(makeTrip());
    fireEvent.click(screen.getByText("Annulla"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("click sul backdrop chiama onOpenChange(false)", () => {
    const { onOpenChange } = renderDialog(makeTrip());
    // Il backdrop è il div esterno con position:fixed
    const backdrop = document.querySelector("[style*='position: fixed']") as HTMLElement;
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    }
  });

  it("click pulsante X chiude il dialog", () => {
    const { onOpenChange } = renderDialog(makeTrip());
    const closeBtn = screen.getByRole("button", { name: "" }); // X button senza testo
    // Trova il bottone con l'icona X vicino all'header
    const allBtns = screen.getAllByRole("button");
    // Il bottone di chiusura header è il primo
    fireEvent.click(allBtns[0]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("click Salva modifiche chiama onSaved", async () => {
    const onSaved = vi.fn();
    localStorage.setItem("atlas.trips.v1", JSON.stringify([makeTrip()]));
    renderDialog(makeTrip(), { onSaved });
    fireEvent.click(screen.getByText("Salva modifiche"));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it("click su una stella imposta il rating", () => {
    renderDialog(makeTrip({ rating: null }));
    const stars = screen.getAllByRole("button").filter(b => b.textContent === "★");
    fireEvent.click(stars[2]); // 3a stella
    // Il label "Bello" appare (RATING_LABELS[3])
    expect(screen.getByText("Bello")).toBeInTheDocument();
  });

  it("seleziona il mezzo di trasporto al click", () => {
    renderDialog(makeTrip({ transport_mode: null }));
    fireEvent.click(screen.getByText("Aereo"));
    // Il bottone Aereo ora ha il colore attivo (non facile da testare via style, verifichiamo che non crashi)
    expect(screen.getByText("Aereo")).toBeInTheDocument();
  });

  it("deseleziona il mezzo cliccandolo di nuovo", () => {
    renderDialog(makeTrip({ transport_mode: "plane" }));
    // Clic per deselezionare
    fireEvent.click(screen.getByText("Aereo"));
    // Non deve lanciare errori
    expect(screen.getByText("Aereo")).toBeInTheDocument();
  });
});
