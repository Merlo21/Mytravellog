import { describe, it, expect } from "vitest";
import { finaleFanLayout, buildConstellationStyle } from "./TripFlyover";

describe("finaleFanLayout — ventaglio foto del poster (tutte le foto visibili)", () => {
  it("le carte sono spaziate abbastanza da vedersi tutte (offset ≥ ~metà carta)", () => {
    const n = 5;
    for (let i = 1; i < n; i++) {
      const dx = finaleFanLayout(i, n).tx - finaleFanLayout(i - 1, n).tx;
      expect(dx).toBeGreaterThanOrEqual(84);
    }
  });

  it("è un ventaglio simmetrico (rotazioni opposte ai due estremi, nessuna carta 'in primo piano')", () => {
    const n = 5;
    const first = finaleFanLayout(0, n).rotate;
    const last = finaleFanLayout(n - 1, n).rotate;
    expect(first).toBeCloseTo(-last, 5);
    expect(finaleFanLayout(2, n).rotate).toBe(0);
  });

  it("z crescente da sinistra a destra (l'ordine di sovrapposizione è stabile)", () => {
    const n = 4;
    expect(finaleFanLayout(0, n).z).toBeLessThan(finaleFanLayout(3, n).z);
  });
});

describe("buildConstellationStyle — vista costellazione (master di stampa)", () => {
  const style = buildConstellationStyle();

  it("ha il fondo nero", () => {
    const bg = style.layers.find((l: any) => l.type === "background");
    expect(bg?.paint["background-color"]).toBe("#000000");
  });

  it("confini e coste tenui in bianco (fanno da sfondo stellato)", () => {
    const borders = style.layers.find((l: any) => l.id === "country-borders");
    const coast = style.layers.find((l: any) => l.id === "coastline");
    expect(borders?.type).toBe("line");
    expect(coast?.type).toBe("line");
    expect(String(borders?.paint["line-color"])).toContain("255,255,255");
  });

  it("è piatta (nessuna proiezione globo): master di stampa senza prospettiva", () => {
    expect(style.projection).toBeUndefined();
  });
});
