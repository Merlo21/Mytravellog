import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn — class merger", () => {
  it("unisce due classi base", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("applica tailwind-merge: l'ultima classe sovrascrive le precedenti dello stesso tipo", () => {
    // tailwind-merge risolve conflitti: px-4 sovrascrive px-2
    const result = cn("px-2", "px-4");
    expect(result).toBe("px-4");
    expect(result).not.toContain("px-2");
  });

  it("filtra valori falsy: false, undefined, null", () => {
    expect(cn(false, "a", undefined, null as any)).toBe("a");
  });

  it("ritorna stringa vuota senza argomenti", () => {
    expect(cn()).toBe("");
  });

  it("gestisce stringhe con spazi interni", () => {
    const result = cn("flex items-center", "gap-2");
    expect(result).toContain("flex");
    expect(result).toContain("items-center");
    expect(result).toContain("gap-2");
  });
});
