import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchMultiRegion } from "./ModificaViaggio";

const okJson = (data: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as Response);

function regionResponse(state: string | null, iso?: string) {
  return okJson({ address: state ? { state, "ISO3166-2-lvl4": iso } : {} });
}

describe("fetchMultiRegion", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("ritorna region=null e details=[] con nessuna tappa", async () => {
    expect(await fetchMultiRegion([])).toEqual({ region: null, details: [] });
  });

  it("ritorna la regione (nome e codice) di un'unica tappa", async () => {
    (fetch as any).mockReturnValue(regionResponse("Lazio", "IT-62"));
    const result = await fetchMultiRegion([{ lat: 41.9, lon: 12.5 }]);
    expect(result.region).toBe("Lazio");
    expect(result.details).toEqual([{ name: "Lazio", code: "IT-62" }]);
  });

  it("unisce le regioni di più tappe con ', ' senza duplicati", async () => {
    (fetch as any)
      .mockReturnValueOnce(regionResponse("Lombardia", "IT-25"))
      .mockReturnValueOnce(regionResponse("Campania", "IT-72"))
      .mockReturnValueOnce(regionResponse("Lombardia", "IT-25")); // stessa regione di una tappa precedente
    const result = await fetchMultiRegion([
      { lat: 45.5, lon: 9.2 },
      { lat: 40.8, lon: 14.2 },
      { lat: 45.6, lon: 9.1 },
    ]);
    expect(result.region).toBe("Lombardia, Campania");
    expect(result.details).toEqual([{ name: "Lombardia", code: "IT-25" }, { name: "Campania", code: "IT-72" }]);
  });

  it("deduplica per codice ISO anche se il nome differisce (es. inglese vs locale)", async () => {
    (fetch as any)
      .mockReturnValueOnce(regionResponse("Vienna", "AT-9"))
      .mockReturnValueOnce(regionResponse("Wien", "AT-9"));
    const result = await fetchMultiRegion([{ lat: 48.2, lon: 16.4 }, { lat: 48.21, lon: 16.37 }]);
    expect(result.details).toHaveLength(1);
  });

  it("ignora le tappe senza regione trovata (null) senza inserire buchi", async () => {
    (fetch as any)
      .mockReturnValueOnce(regionResponse("Sicilia", "IT-82"))
      .mockReturnValueOnce(regionResponse(null));
    const result = await fetchMultiRegion([
      { lat: 38.1, lon: 13.4 },
      { lat: 0, lon: 0 },
    ]);
    expect(result.region).toBe("Sicilia");
  });

  it("ritorna region=null se nessuna tappa ha una regione risolvibile", async () => {
    (fetch as any).mockReturnValue(Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response));
    const result = await fetchMultiRegion([{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }]);
    expect(result.region).toBeNull();
    expect(result.details).toEqual([]);
  });

  it("salta le tappe con coordinate mancanti (lat=0/lon=0) senza chiamare fetch", async () => {
    (fetch as any).mockReturnValue(regionResponse("Lazio", "IT-62"));
    const result = await fetchMultiRegion([{ lat: 0, lon: 0 }, { lat: 41.9, lon: 12.5 }]);
    expect(result.region).toBe("Lazio");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
