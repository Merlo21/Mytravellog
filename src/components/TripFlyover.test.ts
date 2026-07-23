import { describe, it, expect } from "vitest";
import { finaleFanLayout } from "./TripFlyover";

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
