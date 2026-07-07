import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("unisce classi semplici", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("ignora falsy", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("gestisce oggetti condizionali", () => {
    expect(cn("a", { b: true, c: false })).toBe("a b");
  });

  it("fonde classi Tailwind conflittuali (twMerge)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  it("supporta array annidati", () => {
    expect(cn(["a", ["b", "c"]])).toBe("a b c");
  });

  it("ritorna stringa vuota senza argomenti", () => {
    expect(cn()).toBe("");
  });
});
