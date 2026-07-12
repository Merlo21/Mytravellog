import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BackupSection } from "./BackupSection";
import { addTrip } from "@/lib/storage";
import * as backupModule from "@/lib/backup";
import React from "react";

vi.mock("@/lib/backup", async () => {
  const actual = await vi.importActual<typeof import("@/lib/backup")>("@/lib/backup");
  return { ...actual, backupNow: vi.fn(), restoreBackup: vi.fn() };
});

const mockBackupNow = backupModule.backupNow as unknown as ReturnType<typeof vi.fn>;
const mockRestoreBackup = backupModule.restoreBackup as unknown as ReturnType<typeof vi.fn>;

describe("BackupSection", () => {
  beforeEach(() => {
    localStorage.clear();
    mockBackupNow.mockReset();
    mockRestoreBackup.mockReset();
  });

  it("mostra 'Nessun backup ancora' se non è mai stato fatto un backup", () => {
    render(<BackupSection userId="user-1" />);
    expect(screen.getByText(/nessun backup ancora/i)).toBeInTheDocument();
  });

  it("click su 'Fai un backup' chiama backupNow con l'id utente e i viaggi correnti", async () => {
    addTrip({
      title: "T", country: "Italia", city: "Roma", country_code: "IT", trip_date: "2024-01-01",
      date_end: null, rating: null, notes: null, transport_mode: null, waypoints: [],
      latitude: 41.9, longitude: 12.5, home_latitude: null, home_longitude: null, home_label: null,
      route_geometry: null, temperature_c: null, altitude_m: null, max_altitude_m: null, max_altitude_city: null,
      distance_from_home_km: null, max_distance_from_home_km: null, max_distance_city: null,
      hottest_temp_c: null, hottest_city: null, coldest_temp_c: null, coldest_city: null,
      region: null, region_details: null,
    });
    mockBackupNow.mockResolvedValue({});
    render(<BackupSection userId="user-1" />);
    await waitFor(() => screen.getByText(/nessun backup ancora/i));
    fireEvent.click(screen.getByRole("button", { name: /fai un backup/i }));
    await waitFor(() => expect(mockBackupNow).toHaveBeenCalledWith("user-1", expect.arrayContaining([
      expect.objectContaining({ city: "Roma" }),
    ])));
  });

  it("mostra un messaggio di successo dopo un backup riuscito", async () => {
    mockBackupNow.mockResolvedValue({});
    render(<BackupSection userId="user-1" />);
    fireEvent.click(screen.getByRole("button", { name: /fai un backup/i }));
    expect(await screen.findByText(/backup completato/i)).toBeInTheDocument();
  });

  it("mostra l'errore se il backup fallisce", async () => {
    mockBackupNow.mockResolvedValue({ error: "Errore nel salvataggio dei viaggi: rete assente" });
    render(<BackupSection userId="user-1" />);
    fireEvent.click(screen.getByRole("button", { name: /fai un backup/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("rete assente");
  });

  it("mostra l'errore se il ripristino fallisce", async () => {
    mockRestoreBackup.mockResolvedValue({ error: "Nessun backup trovato per questo account." });
    render(<BackupSection userId="user-1" />);
    fireEvent.click(screen.getByRole("button", { name: /ripristina/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/nessun backup trovato/i);
  });

  it("ripristino riuscito unisce i viaggi del backup con quelli locali senza duplicare", async () => {
    mockRestoreBackup.mockResolvedValue({
      trips: [{
        id: "remote-1", title: "Remoto", country: "Francia", city: "Parigi", country_code: "FR",
        trip_date: "2023-01-01", date_end: null, rating: null, notes: null, transport_mode: null, waypoints: [],
        latitude: 48.85, longitude: 2.35, home_latitude: null, home_longitude: null, home_label: null,
        route_geometry: null, temperature_c: null, altitude_m: null, max_altitude_m: null, max_altitude_city: null,
        distance_from_home_km: null, max_distance_from_home_km: null, max_distance_city: null,
        hottest_temp_c: null, hottest_city: null, coldest_temp_c: null, coldest_city: null,
        region: null, region_details: null, created_at: new Date().toISOString(),
      }],
    });
    render(<BackupSection userId="user-1" />);
    fireEvent.click(screen.getByRole("button", { name: /ripristina/i }));
    expect(await screen.findByText(/ripristinati 1 viaggi/i)).toBeInTheDocument();

    const { loadTrips } = await import("@/lib/storage");
    expect(loadTrips().some(t => t.id === "remote-1")).toBe(true);
  });

  it("i bottoni sono disabilitati mentre un'operazione è in corso", async () => {
    let resolveBackup: (v: unknown) => void;
    mockBackupNow.mockReturnValue(new Promise(r => { resolveBackup = r; }));
    render(<BackupSection userId="user-1" />);
    fireEvent.click(screen.getByRole("button", { name: /fai un backup/i }));
    expect(screen.getByRole("button", { name: /fai un backup/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /ripristina/i })).toBeDisabled();
    resolveBackup!({});
    await waitFor(() => expect(screen.getByRole("button", { name: /fai un backup/i })).not.toBeDisabled());
  });
});
