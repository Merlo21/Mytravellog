import { describe, it, expect } from "vitest";
import { splitRingAtAntimeridian, deriveCountryId } from "./ContinentsMap";

describe("deriveCountryId", () => {
  it("usa l'id numerico se presente", () => {
    expect(deriveCountryId({ id: 380 }, 0)).toBe("380");
  });

  it("ricade sul nome se l'id manca (es. Antartide nel world-atlas)", () => {
    expect(deriveCountryId({ properties: { name: "Antarctica" } }, 7)).toBe("Antarctica");
  });

  it("ricade sull'indice se manca sia id che nome", () => {
    expect(deriveCountryId({}, 3)).toBe("unknown-3");
  });

  it("due feature senza id ma con nomi diversi non collidono", () => {
    const a = deriveCountryId({ properties: { name: "Antarctica" } }, 1);
    const b = deriveCountryId({ properties: { name: "Somaliland" } }, 2);
    expect(a).not.toBe(b);
  });
});

describe("splitRingAtAntimeridian", () => {
  it("keeps a normal ring as a single segment", () => {
    const ring = [
      [10, 40],
      [12, 41],
      [14, 39],
      [10, 40],
    ];
    const segs = splitRingAtAntimeridian(ring);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toHaveLength(4);
  });

  it("splits a ring that crosses the antimeridian (Russia-like)", () => {
    // Jumps from +178 to -179 → must split.
    const ring = [
      [170, 65],
      [178, 66],
      [-179, 65],
      [-175, 64],
    ];
    const segs = splitRingAtAntimeridian(ring);
    expect(segs.length).toBeGreaterThanOrEqual(2);
    // No segment should contain points on opposite sides of the antimeridian
    for (const seg of segs) {
      for (let i = 1; i < seg.length; i++) {
        expect(Math.abs(seg[i][0] - seg[i - 1][0])).toBeLessThanOrEqual(180);
      }
    }
  });

  it("splits multiple times for rings crossing the antimeridian repeatedly (Fiji-like)", () => {
    const ring = [
      [177, -17],
      [-178, -17],
      [178, -18],
      [-177, -18],
    ];
    const segs = splitRingAtAntimeridian(ring);
    expect(segs.length).toBeGreaterThanOrEqual(3);
  });

  it("handles empty rings", () => {
    expect(splitRingAtAntimeridian([])).toEqual([]);
  });
});
