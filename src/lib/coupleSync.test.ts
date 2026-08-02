import { describe, it, expect } from "vitest";
import { mergeSharedContribution } from "./coupleSync";
import type { Trip } from "./storage";

const t = (id: string, sharedBy?: string): Trip => ({ id, sharedBy } as Trip);

describe("mergeSharedContribution (cuore sync viaggi di coppia)", () => {
  const ME = "me@gmail.com", YOU = "you@gmail.com";

  it("timbra i miei viaggi con la mia email", () => {
    const out = mergeSharedContribution([], [t("a"), t("b")], ME);
    expect(out.map(x => x.id)).toEqual(["a", "b"]);
    expect(out.every(x => x.sharedBy === ME)).toBe(true);
  });

  it("preserva i viaggi del partner e aggiunge i miei", () => {
    const remote = [t("p1", YOU), t("p2", YOU)];
    const out = mergeSharedContribution(remote, [t("a")], ME);
    expect(out.map(x => `${x.id}:${x.sharedBy}`)).toEqual([`p1:${YOU}`, `p2:${YOU}`, `a:${ME}`]);
  });

  it("SOSTITUISCE i miei vecchi (togliere la condivisione si propaga)", () => {
    // il file aveva 2 miei; ora ne condivido solo 1 → l'altro sparisce
    const remote = [t("p1", YOU), t("a", ME), t("b", ME)];
    const out = mergeSharedContribution(remote, [t("a")], ME);
    expect(out.map(x => x.id)).toEqual(["p1", "a"]); // b rimosso, p1 (partner) intatto
  });

  it("riassorbe i viaggi legacy senza timbro (non li tratta come del partner)", () => {
    const remote = [t("legacy")]; // sharedBy assente
    const out = mergeSharedContribution(remote, [t("a")], ME);
    expect(out.map(x => x.id)).toEqual(["a"]); // legacy scartato, sostituito dai miei timbrati
  });

  it("non tocca mai i viaggi del partner anche se non ho nulla da condividere", () => {
    const remote = [t("p1", YOU)];
    const out = mergeSharedContribution(remote, [], ME);
    expect(out.map(x => x.id)).toEqual(["p1"]);
  });
});
