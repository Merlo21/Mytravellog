import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, within } from "@testing-library/react";
import { SettingsProvider } from "@/lib/settings";
import { TripCard } from "@/components/TripCard";
import SettingsPage from "@/pages/Settings";
import { MemoryRouter } from "react-router-dom";
import type { LocalTrip } from "@/lib/storage";

const trip: LocalTrip = {
  id: "t1",
  title: "Test",
  city: "Roma",
  country: "Italia",
  country_code: "IT",
  latitude: 41.9,
  longitude: 12.5,
  home_latitude: 45.5,
  home_longitude: 9.2,
  home_label: "Casa",
  trip_date: "2024-01-01",
  temperature_c: 20,
  altitude_m: 100,
  distance_from_home_km: 100,
  notes: null,
} as unknown as LocalTrip;

function renderAll() {
  return render(
    <SettingsProvider>
      <MemoryRouter>
        <div data-testid="card"><TripCard trip={trip} /></div>
        <SettingsPage />
      </MemoryRouter>
    </SettingsProvider>
  );
}

describe("Settings → UI integration", () => {
  beforeEach(() => localStorage.clear());

  it("changing distance unit immediately updates TripCard formats", () => {
    renderAll();
    const card = screen.getByTestId("card");
    expect(within(card).getByText(/100 km/)).toBeInTheDocument();
    expect(within(card).getByText(/100 m/)).toBeInTheDocument();

    act(() => { screen.getByRole("button", { name: /Imperiale/i }).click(); });

    expect(within(card).queryByText(/100 km/)).not.toBeInTheDocument();
    expect(within(card).getByText(/mi$/)).toBeInTheDocument();
    expect(within(card).getByText(/ft$/)).toBeInTheDocument();
  });

  it("changing temperature unit immediately updates TripCard", () => {
    renderAll();
    const card = screen.getByTestId("card");
    expect(within(card).getByText("20°C")).toBeInTheDocument();

    act(() => { screen.getByRole("button", { name: /Fahrenheit/i }).click(); });

    expect(within(card).queryByText("20°C")).not.toBeInTheDocument();
    expect(within(card).getByText("68°F")).toBeInTheDocument();
  });

  it("changing globe style persists and is reflected in settings context", () => {
    renderAll();
    act(() => { screen.getByRole("button", { name: /Satellitare/i }).click(); });
    const stored = JSON.parse(localStorage.getItem("atlas.settings.v1")!);
    expect(stored.globeStyle).toBe("satellite");

    act(() => { screen.getByRole("button", { name: /Artistico/i }).click(); });
    expect(JSON.parse(localStorage.getItem("atlas.settings.v1")!).globeStyle).toBe("artistic");
  });
});
