import { describe, it, expect } from "vitest";
import { hasCoords } from "./coords";

describe("hasCoords", () => {
  it("accetta lo ZERO: equatore e meridiano di Greenwich sono validi", () => {
    // Il motivo per cui questo helper esiste: `lat && lon` scartava questi punti
    // (Quito/Nairobi sull'equatore, Accra sul meridiano 0) → spariti dal globo.
    expect(hasCoords(0, 0)).toBe(true);
    expect(hasCoords(0, 12.5)).toBe(true);
    expect(hasCoords(45.46, 0)).toBe(true);
  });

  it("accetta coordinate normali, anche negative", () => {
    expect(hasCoords(45.46, 9.19)).toBe(true);
    expect(hasCoords(-33.87, -70.67)).toBe(true);
  });

  it("rifiuta mancanti e non finite", () => {
    expect(hasCoords(null, 9)).toBe(false);
    expect(hasCoords(45, null)).toBe(false);
    expect(hasCoords(undefined, undefined)).toBe(false);
    expect(hasCoords(NaN, 9)).toBe(false);
    expect(hasCoords(45, NaN)).toBe(false);
    expect(hasCoords(Infinity, 9)).toBe(false);
  });
});
