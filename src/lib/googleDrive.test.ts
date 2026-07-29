import { describe, it, expect } from "vitest";
import { mergeTrips } from "./googleDrive";
import type { Trip } from "./storage";

const t = (id: string, title: string): Trip => ({ id, title } as unknown as Trip);

describe("mergeTrips — unione senza perdita di dati", () => {
  it("nuovo dispositivo (locale vuoto): scarica tutti i remoti", () => {
    const out = mergeTrips([], 0, [t("a", "A"), t("b", "B")], 1000);
    expect(out.map(x => x.id).sort()).toEqual(["a", "b"]);
  });

  it("viaggio aggiunto offline (solo locale): non si perde", () => {
    const out = mergeTrips([t("a", "A"), t("c", "C")], 2000, [t("a", "A"), t("b", "B")], 1000);
    expect(out.map(x => x.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("stesso id modificato: vince il lato più recente", () => {
    const local = [t("a", "Locale nuovo")];
    const remote = [t("a", "Remoto vecchio")];
    // remoto più vecchio → vince locale
    expect(mergeTrips(local, 5000, remote, 1000)[0].title).toBe("Locale nuovo");
    // remoto più recente → vince remoto
    expect(mergeTrips(local, 1000, remote, 5000)[0].title).toBe("Remoto vecchio");
  });

  it("unione completa mantenendo gli id unici", () => {
    const out = mergeTrips([t("a", "A"), t("b", "B")], 3000, [t("b", "B2"), t("c", "C")], 1000);
    expect(out.map(x => x.id).sort()).toEqual(["a", "b", "c"]);
    // b è in entrambi, locale più recente → resta "B"
    expect(out.find(x => x.id === "b")?.title).toBe("B");
  });
});
