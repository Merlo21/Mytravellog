import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { createRef } from "react";
import { StarField, StarFieldController } from "./StarField";

/**
 * Il campo stellato riceve i pointer event dalla Home tramite un handle
 * imperativo: prima passavano da due useState, e ogni movimento del mouse sul
 * globo ri-renderizzava l'intera Home (60-120 volte al secondo) ridisegnando
 * il canvas senza alcun throttling.
 */

// jsdom non fa layout: senza dimensioni reali i centroidi sarebbero tutti 0.
const W = 1000, H = 500;
// jsdom non implementa ResizeObserver (StarField lo usa per ridisegnare).
class FakeResizeObserver { observe() {} unobserve() {} disconnect() {} }
(globalThis as any).ResizeObserver ??= FakeResizeObserver;
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0, top: 0, width: W, height: H, right: W, bottom: H, x: 0, y: 0, toJSON: () => ({}),
  } as DOMRect);
  Object.defineProperty(HTMLCanvasElement.prototype, "offsetWidth", { value: W, configurable: true });
  Object.defineProperty(HTMLCanvasElement.prototype, "offsetHeight", { value: H, configurable: true });
});
afterEach(() => vi.restoreAllMocks());

/** Centroide di Orione con offset 0, stessa formula di starToXY. */
const ORIONE = (() => {
  const stars: [number, number][] = [[83.8,7.4],[78.6,-8.2],[84.1,-1.2],[83.0,-1.9],[85.2,-0.3],[88.8,7.4],[82.1,-9.7]];
  const pts = stars.map(([ra, dec]) => [((ra / 360) % 1) * W, (0.5 - dec / 180) * H]);
  return {
    x: pts.reduce((s, p) => s + p[0], 0) / pts.length,
    y: pts.reduce((s, p) => s + p[1], 0) / pts.length,
  };
})();

function setup() {
  const ref = createRef<StarFieldController>() as React.MutableRefObject<StarFieldController | null>;
  const utils = render(<StarField controllerRef={ref} />);
  return { ref, ...utils };
}

const labelText = (c: HTMLElement) =>
  Array.from(c.querySelectorAll("div")).find(d => d.style.textTransform === "uppercase")?.textContent ?? null;

describe("StarField — interazione senza stato nella Home", () => {
  it("espone il controller e mostra la costellazione più vicina al puntatore", async () => {
    const { ref, container } = setup();
    expect(ref.current).not.toBeNull();

    await act(async () => { ref.current!.pointerMove(ORIONE.x, ORIONE.y); await new Promise(r => setTimeout(r, 30)); });
    expect(labelText(container)).toBe("Orione");
  });

  it("uscendo dal globo l'etichetta sparisce", async () => {
    const { ref, container } = setup();
    await act(async () => { ref.current!.pointerMove(ORIONE.x, ORIONE.y); await new Promise(r => setTimeout(r, 30)); });
    expect(labelText(container)).toBe("Orione");

    await act(async () => { ref.current!.pointerLeave(); });
    expect(labelText(container)).toBeNull();
  });

  it("una raffica di movimenti produce UN SOLO lavoro per frame (coalescing)", async () => {
    const { ref } = setup();
    const raf = vi.spyOn(window, "requestAnimationFrame");

    await act(async () => {
      for (let i = 0; i < 20; i++) ref.current!.pointerMove(ORIONE.x + i, ORIONE.y, 2, 1);
    });
    // 20 eventi → una sola richiesta di frame finché il tick non è girato
    expect(raf).toHaveBeenCalledTimes(1);
  });

  it("lontano da ogni costellazione non mostra nulla", async () => {
    const { ref, container } = setup();
    await act(async () => { ref.current!.pointerMove(ORIONE.x + 400, ORIONE.y + 200); await new Promise(r => setTimeout(r, 30)); });
    expect(labelText(container)).toBeNull();
  });
});
