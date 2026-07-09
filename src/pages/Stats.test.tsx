import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SettingsProvider } from "@/lib/settings";
import Stats from "./Stats";
import { addTrip } from "@/lib/storage";

vi.mock("@/components/ContinentsMap", () => ({
  ContinentsMap: () => <div data-testid="continents-map" />,
}));
vi.mock("@/components/StatsSection", () => ({
  StatsSection: ({ trips }: any) => <div data-testid="stats-section">{trips.length}</div>,
}));
vi.mock("@/components/TravelHighlights", () => ({
  TravelHighlights: ({ trips }: any) => <div data-testid="highlights">{trips.length}</div>,
}));

function mount() {
  return render(
    <SettingsProvider>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Stats />
      </MemoryRouter>
    </SettingsProvider>
  );
}

describe("Stats page", () => {
  beforeEach(() => localStorage.clear());

  it("monta senza viaggi", () => {
    mount();
    expect(screen.getByTestId("stats-section").textContent).toBe("0");
    expect(screen.getByTestId("continents-map")).toBeInTheDocument();
    expect(screen.getByTestId("highlights").textContent).toBe("0");
  });

  it("passa i viaggi caricati alle sezioni", () => {
    addTrip({
      title: "T", country: "Italia", city: "Roma", country_code: "IT",
      trip_date: "2024-01-01", date_end: null, rating: null, notes: null,
      transport_mode: null, waypoints: [], latitude: 41.9, longitude: 12.5,
      home_latitude: null, home_longitude: null, home_label: null,
      temperature_c: null, altitude_m: null, distance_from_home_km: null,
      max_distance_from_home_km: null, max_distance_city: null,
      max_altitude_m: null, max_altitude_city: null,
      hottest_temp_c: null, hottest_city: null, coldest_temp_c: null,
      coldest_city: null, region: null,
    });
    mount();
    expect(screen.getByTestId("stats-section").textContent).toBe("1");
    expect(screen.getByTestId("highlights").textContent).toBe("1");
  });
});
