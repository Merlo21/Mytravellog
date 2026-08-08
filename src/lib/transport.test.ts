import { describe, it, expect } from "vitest";
import {
  TRANSPORT, TRANSPORT_MODES, TRANSPORT_LIST, TRANSPORT_FALLBACK_COLOR,
  isTransportMode, transportColor, transportLabel, transportBg,
} from "./transport";

describe("transport — fonte unica dei mezzi", () => {
  it("copre i sette mezzi, ognuno completo", () => {
    expect(TRANSPORT_MODES).toEqual(["plane", "train", "car", "ship", "walk", "bici", "moto"]);
    for (const m of TRANSPORT_MODES) {
      const t = TRANSPORT[m];
      expect(t.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.labelWith.length).toBeGreaterThan(0);
      expect(t.labelShort.length).toBeGreaterThan(0);
      expect(t.emoji.length).toBeGreaterThan(0);
      expect(t.Icon).toBeTruthy();
    }
  });

  it("i colori storici restano invariati (sono già nei dati salvati e negli export)", () => {
    expect(TRANSPORT_MODES.map(m => TRANSPORT[m].color)).toEqual([
      "#378ADD", "#BA7517", "#A855F7", "#0F6E56", "#D85A30", "#22C55E", "#EAB308",
    ]);
  });

  it("riconosce i mezzi validi e rifiuta il resto", () => {
    expect(isTransportMode("car")).toBe(true);
    expect(isTransportMode("monopattino")).toBe(false);
    expect(isTransportMode(null)).toBe(false);
    expect(isTransportMode(undefined)).toBe(false);
    expect(isTransportMode("")).toBe(false);
  });

  it("mezzo mancante o sconosciuto → blu di tema", () => {
    expect(transportColor("train")).toBe("#BA7517");
    expect(transportColor(null)).toBe(TRANSPORT_FALLBACK_COLOR);
    expect(transportColor("astronave")).toBe(TRANSPORT_FALLBACK_COLOR);
  });

  it("l'etichetta ha un ripiego dichiarato dal chiamante", () => {
    expect(transportLabel("walk")).toBe("A piedi");
    expect(transportLabel(null)).toBe("");
    expect(transportLabel(null, "Viaggio")).toBe("Viaggio");
  });

  it("transportBg converte in rgba con l'opacità richiesta", () => {
    expect(transportBg("plane")).toBe("rgba(55,138,221,0.12)");
    expect(transportBg("plane", 0.15)).toBe("rgba(55,138,221,0.15)");
    expect(transportBg(null)).toBe("rgba(96,165,250,0.12)");
  });

  it("TRANSPORT_LIST è ordinata e pronta per i selettori", () => {
    expect(TRANSPORT_LIST.map(t => t.value)).toEqual([...TRANSPORT_MODES]);
    expect(TRANSPORT_LIST[0]).toMatchObject({ value: "plane", label: "Aereo", color: "#378ADD" });
  });
});
