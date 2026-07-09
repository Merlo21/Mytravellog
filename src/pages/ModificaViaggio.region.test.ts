import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchMultiRegion } from "./ModificaViaggio";

const okJson = (data: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as Response);

function regionResponse(state: string | null) {
  return okJson({ address: state ? { state } : {} });
}

describe("fetchMultiRegion", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("ritorna null con nessuna tappa", async () => {
    expect(await fetchMultiRegion([])).toBeNull();
  });

  it("ritorna la regione di un'unica tappa", async () => {
    (fetch as any).mockReturnValue(regionResponse("Lazio"));
    expect(await fetchMultiRegion([{ lat: 41.9, lon: 12.5 }])).toBe("Lazio");
  });

  it("unisce le regioni di più tappe con ', ' senza duplicati", async () => {
    (fetch as any)
      .mockReturnValueOnce(regionResponse("Lombardia"))
      .mockReturnValueOnce(regionResponse("Campania"))
      .mockReturnValueOnce(regionResponse("Lombardia")); // stessa regione di una tappa precedente
    const region = await fetchMultiRegion([
      { lat: 45.5, lon: 9.2 },
      { lat: 40.8, lon: 14.2 },
      { lat: 45.6, lon: 9.1 },
    ]);
    expect(region).toBe("Lombardia, Campania");
  });

  it("ignora le tappe senza regione trovata (null) senza inserire buchi", async () => {
    (fetch as any)
      .mockReturnValueOnce(regionResponse("Sicilia"))
      .mockReturnValueOnce(regionResponse(null));
    const region = await fetchMultiRegion([
      { lat: 38.1, lon: 13.4 },
      { lat: 0, lon: 0 },
    ]);
    expect(region).toBe("Sicilia");
  });

  it("ritorna null se nessuna tappa ha una regione risolvibile", async () => {
    (fetch as any).mockReturnValue(Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response));
    const region = await fetchMultiRegion([{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }]);
    expect(region).toBeNull();
  });

  it("salta le tappe con coordinate mancanti (lat=0/lon=0) senza chiamare fetch", async () => {
    (fetch as any).mockReturnValue(regionResponse("Lazio"));
    const region = await fetchMultiRegion([{ lat: 0, lon: 0 }, { lat: 41.9, lon: 12.5 }]);
    expect(region).toBe("Lazio");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
