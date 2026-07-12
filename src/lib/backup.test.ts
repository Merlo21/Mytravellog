import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { backupNow, restoreBackup, getLastBackupInfo, isBackupStale } from "./backup";
import { savePhoto, __resetPhotoDB } from "./photoStorage";
import type { Trip } from "./storage";

const mockUpload = vi.fn();
const mockList = vi.fn();
const mockDownload = vi.fn();
const mockUpsert = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
        list: (...args: unknown[]) => mockList(...args),
        download: (...args: unknown[]) => mockDownload(...args),
      }),
    },
    from: () => ({
      upsert: (...args: unknown[]) => mockUpsert(...args),
      select: () => ({
        eq: () => ({
          maybeSingle: (...args: unknown[]) => mockMaybeSingle(...args),
        }),
      }),
    }),
  },
}));

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "trip-1", created_at: new Date().toISOString(), title: "Test", country: "Italia", city: "Roma",
    country_code: "IT", trip_date: "2024-06-01", date_end: null, rating: null, notes: null,
    transport_mode: null, waypoints: [], latitude: 41.9, longitude: 12.5,
    home_latitude: null, home_longitude: null, home_label: null, route_geometry: null,
    temperature_c: null, altitude_m: null, max_altitude_m: null, max_altitude_city: null,
    distance_from_home_km: null, max_distance_from_home_km: null, max_distance_city: null,
    hottest_temp_c: null, hottest_city: null, coldest_temp_c: null, coldest_city: null,
    region: null, region_details: null,
    ...overrides,
  };
}

describe("isBackupStale", () => {
  beforeEach(() => localStorage.clear());

  it("è stale se non è mai stato fatto un backup ma ci sono viaggi", () => {
    expect(isBackupStale(3)).toBe(true);
  });

  it("non è stale se non è mai stato fatto un backup e non ci sono viaggi", () => {
    expect(isBackupStale(0)).toBe(false);
  });

  it("non è stale subito dopo un backup recente con pochi viaggi nuovi", () => {
    localStorage.setItem("navta.last_backup_at", new Date().toISOString());
    localStorage.setItem("navta.last_backup_trip_count", "5");
    expect(isBackupStale(6)).toBe(false);
  });

  it("è stale se sono passati più di 30 giorni", () => {
    const old = new Date();
    old.setDate(old.getDate() - 31);
    localStorage.setItem("navta.last_backup_at", old.toISOString());
    localStorage.setItem("navta.last_backup_trip_count", "5");
    expect(isBackupStale(5)).toBe(true);
  });

  it("è stale se sono stati aggiunti 5 o più viaggi dall'ultimo backup", () => {
    localStorage.setItem("navta.last_backup_at", new Date().toISOString());
    localStorage.setItem("navta.last_backup_trip_count", "5");
    expect(isBackupStale(10)).toBe(true);
  });
});

describe("backupNow", () => {
  beforeEach(() => {
    localStorage.clear();
    indexedDB = new IDBFactory();
    __resetPhotoDB();
    vi.clearAllMocks();
  });

  it("carica il JSON dei viaggi e aggiorna l'ultimo backup", async () => {
    mockUpsert.mockResolvedValue({ error: null });
    const trips = [makeTrip()];
    const result = await backupNow("user-1", trips);
    expect(result.error).toBeUndefined();
    expect(mockUpsert).toHaveBeenCalledWith({ user_id: "user-1", trips_json: trips });
    expect(getLastBackupInfo().tripCount).toBe(1);
  });

  it("carica anche le foto di ogni viaggio", async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockUpsert.mockResolvedValue({ error: null });
    const photoId = await savePhoto("trip-1", new Blob(["x"], { type: "image/jpeg" }));
    await backupNow("user-1", [makeTrip()]);
    expect(mockUpload).toHaveBeenCalledWith(`user-1/trip-1/${photoId}`, expect.anything(), expect.objectContaining({ upsert: true }));
  });

  it("ritorna un errore se il caricamento di una foto fallisce", async () => {
    mockUpload.mockResolvedValue({ error: { message: "quota superata" } });
    await savePhoto("trip-1", new Blob(["x"], { type: "image/jpeg" }));
    const result = await backupNow("user-1", [makeTrip()]);
    expect(result.error).toMatch(/quota superata/);
  });

  it("ritorna un errore se il salvataggio dei viaggi fallisce", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "rete assente" } });
    const result = await backupNow("user-1", [makeTrip()]);
    expect(result.error).toMatch(/rete assente/);
  });

  it("non aggiorna l'ultimo backup se fallisce", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "errore" } });
    await backupNow("user-1", [makeTrip()]);
    expect(getLastBackupInfo().at).toBeNull();
  });
});

describe("restoreBackup", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
    __resetPhotoDB();
    vi.clearAllMocks();
  });

  it("ritorna i viaggi dal backup", async () => {
    const trips = [makeTrip()];
    mockMaybeSingle.mockResolvedValue({ data: { trips_json: trips }, error: null });
    mockList.mockResolvedValue({ data: [], error: null });
    const result = await restoreBackup("user-1");
    expect(result.trips).toEqual(trips);
  });

  it("ritorna un errore se non esiste nessun backup", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await restoreBackup("user-1");
    expect(result.error).toMatch(/nessun backup/i);
  });

  it("ritorna un errore se la query fallisce", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "connessione persa" } });
    const result = await restoreBackup("user-1");
    expect(result.error).toMatch(/connessione persa/);
  });

  it("scarica le foto elencate per ogni viaggio e le salva in IndexedDB", async () => {
    const trips = [makeTrip()];
    mockMaybeSingle.mockResolvedValue({ data: { trips_json: trips }, error: null });
    mockList.mockResolvedValue({ data: [{ name: "foto-1" }], error: null });
    mockDownload.mockResolvedValue({ data: new Blob(["y"], { type: "image/png" }), error: null });

    await restoreBackup("user-1");

    const { getPhotosForTrip } = await import("./photoStorage");
    const photos = await getPhotosForTrip("trip-1");
    expect(photos).toHaveLength(1);
  });
});
