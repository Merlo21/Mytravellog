import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TripExpenses, totalSpent } from "./TripExpenses";
import { addTrip, loadTrips, type Trip } from "@/lib/storage";

vi.mock("@/lib/photoStorage", async (orig) => ({ ...(await orig<any>()) }));

function makeTrip(over: Partial<Trip> = {}): Trip {
  return addTrip({
    title: "Barcellona", city: "Barcellona", country: "Spagna", country_code: "ES",
    trip_date: "2025-06-02", date_end: "2025-06-08", rating: null, notes: null,
    transport_mode: "plane", waypoints: [], latitude: 41.39, longitude: 2.15,
    home_latitude: 45.46, home_longitude: 9.19, home_label: "Milano",
    route_geometry: null, temperature_c: null, altitude_m: null, max_altitude_m: null,
    max_altitude_city: null, distance_from_home_km: null, max_distance_from_home_km: null,
    max_distance_city: null, hottest_temp_c: null, hottest_city: null,
    coldest_temp_c: null, coldest_city: null, region: null, region_details: null,
    ...over,
  } as any);
}

describe("totalSpent — quanto è costato", () => {
  it("somma ciò che è uscito davvero, non il preventivo", () => {
    // Un viaggio nato da un programma: preventivo 900, pagati 340.
    const budget = [
      { label: "Viaggio", amount: 400, paid: 240 },
      { label: "Alloggio", amount: 500, paid: 100 },
    ];
    expect(totalSpent({ budget })).toBe(340);
  });

  it("nessuna spesa registrata → zero", () => {
    expect(totalSpent({ budget: [] })).toBe(0);
    expect(totalSpent({ budget: undefined })).toBe(0);
  });
});

describe("TripExpenses — pannello delle spese", () => {
  beforeEach(() => localStorage.clear());

  it("eredita le voci del programma e mostra il totale speso", () => {
    const trip = makeTrip({ budget: [{ label: "Volo", amount: 400, paid: 240 }] } as any);
    render(<TripExpenses trip={trip} onClose={() => {}} />);
    expect((screen.getByLabelText("Voce di spesa 1") as HTMLInputElement).value).toBe("Volo");
    expect(screen.getByText(/240/)).toBeTruthy();
  });

  it("scrivere una spesa aggiorna il totale", () => {
    const trip = makeTrip();
    render(<TripExpenses trip={trip} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/Speso per Viaggio/i), { target: { value: "320" } });
    expect(screen.getByText(/320/)).toBeTruthy();
  });

  // Lezione già pagata con diario e pianificazione: il tasto indietro smonta il
  // pannello senza passare da "chiudi", e i numeri appena scritti si perdono.
  it("salva allo SMONTAGGIO, non solo dal pulsante di chiusura", () => {
    const trip = makeTrip();
    const { unmount } = render(<TripExpenses trip={trip} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/Speso per Alloggio/i), { target: { value: "410" } });
    unmount();

    const saved = loadTrips().find(t => t.id === trip.id)!;
    expect(totalSpent(saved)).toBe(410);
  });

  it("senza modifiche non scrive nulla", () => {
    const trip = makeTrip();
    const { unmount } = render(<TripExpenses trip={trip} onClose={() => {}} />);
    unmount();
    expect(loadTrips().find(t => t.id === trip.id)!.budget).toBeUndefined();
  });
});
