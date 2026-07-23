import { describe, it, expect } from "vitest";
import { finaleFanLayout, buildLinesStyle } from "./TripFlyover";

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

describe("buildLinesStyle — vista a linee bianco/nero del poster", () => {
  const style = buildLinesStyle();

  it("ha il fondo nero", () => {
    const bg = style.layers.find((l: any) => l.type === "background");
    expect(bg?.paint["background-color"]).toBe("#000000");
  });

  it("disegna i confini di stato in bianco dal layer boundary (admin_level ≤ 2, no marittimi)", () => {
    const borders = style.layers.find((l: any) => l.id === "country-borders");
    expect(borders?.["source-layer"]).toBe("boundary");
    expect(String(borders?.paint["line-color"])).toContain("255,255,255");
    // filtra i confini nazionali (admin_level <= 2) escludendo quelli marittimi
    expect(JSON.stringify(borders?.filter)).toContain("admin_level");
    expect(JSON.stringify(borders?.filter)).toContain("maritime");
  });

  it("include i contorni costieri come layer line (layer water)", () => {
    const coast = style.layers.find((l: any) => l.id === "coastline");
    expect(coast?.type).toBe("line");
    expect(coast?.["source-layer"]).toBe("water");
    expect(String(coast?.paint["line-color"])).toContain("255,255,255");
  });

  it("coste e confini hanno lo STESSO spessore (linee uniformi)", () => {
    const coast = style.layers.find((l: any) => l.id === "coastline");
    const borders = style.layers.find((l: any) => l.id === "country-borders");
    expect(coast?.paint["line-width"]).toEqual(borders?.paint["line-width"]);
  });

  it("usa una sola sorgente vector (MapTiler), non imagery satellitare", () => {
    expect(style.sources.omt.type).toBe("vector");
  });
});
