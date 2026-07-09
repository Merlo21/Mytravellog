import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchMapStyle, __clearMapStyleCache } from "./WorldMap";

describe("fetchMapStyle", () => {
  beforeEach(() => __clearMapStyleCache());
  afterEach(() => vi.restoreAllMocks());

  it("scarica lo style al primo utilizzo", async () => {
    global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ layers: [] }) });
    const style = await fetchMapStyle();
    expect(style).toEqual({ layers: [] });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("una seconda chiamata non rifà il fetch: usa la cache in memoria", async () => {
    global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ layers: [] }) });
    await fetchMapStyle();
    await fetchMapStyle();
    await fetchMapStyle();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("ritorna una copia indipendente ad ogni chiamata: mutare il risultato non altera la cache", async () => {
    global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ projection: undefined }) });
    const first = await fetchMapStyle();
    first.projection = { type: "globe" };
    const second = await fetchMapStyle();
    expect(second.projection).toBeUndefined();
  });

  it("__clearMapStyleCache forza un nuovo fetch alla chiamata successiva", async () => {
    global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ layers: [] }) });
    await fetchMapStyle();
    __clearMapStyleCache();
    await fetchMapStyle();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
