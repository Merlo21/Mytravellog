import { describe, it, expect, vi } from "vitest";
import { cn, sequentialMap } from "./utils";

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

describe("sequentialMap", () => {
  it("applica fn a ogni elemento nell'ordine giusto", async () => {
    const result = await sequentialMap([1, 2, 3], async (n) => n * 10, 0);
    expect(result).toEqual([10, 20, 30]);
  });

  it("passa anche l'indice a fn", async () => {
    const result = await sequentialMap(["a", "b"], async (item, i) => `${item}${i}`, 0);
    expect(result).toEqual(["a0", "b1"]);
  });

  it("ritorna array vuoto per input vuoto, senza chiamare fn", async () => {
    const fn = vi.fn(async () => 1);
    const result = await sequentialMap([], fn, 0);
    expect(result).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it("chiama fn una alla volta, non in parallelo: la seconda parte solo dopo che la prima ha risolto", async () => {
    const order: string[] = [];
    const fn = async (n: number) => {
      order.push(`start-${n}`);
      await new Promise(r => setTimeout(r, 5));
      order.push(`end-${n}`);
      return n;
    };
    await sequentialMap([1, 2], fn, 0);
    expect(order).toEqual(["start-1", "end-1", "start-2", "end-2"]);
  });

  it("aspetta delayMs tra una chiamata e la successiva (non prima della prima)", async () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    const fn = async (n: number) => { calls.push(n); return n; };
    const promise = sequentialMap([1, 2, 3], fn, 1000);

    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual([1]); // la prima chiamata parte subito, senza attesa

    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toEqual([1]); // non ancora la seconda

    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toEqual([1, 2]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toEqual([1, 2, 3]);

    await promise;
    vi.useRealTimers();
  });
});
