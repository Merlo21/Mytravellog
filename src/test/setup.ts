import "@testing-library/jest-dom";
import { JSDOM } from "jsdom";

// Node 22.4+ ships an experimental global `localStorage` that shadows the one
// jsdom provides on `window`, and throws/returns undefined without a
// --localstorage-file flag. Force-install a real, working Storage impl
// (the descriptor is configurable, so this is safe on every Node version).
const storageDom = new JSDOM("", { url: "http://localhost" });
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  enumerable: true,
  value: storageDom.window.localStorage,
});
Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  enumerable: true,
  value: storageDom.window.sessionStorage,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom doesn't implement <canvas> 2D context. Provide a no-op stub so components
// that draw to a canvas (CountryMapModal, StarField, ecc.) non lancino in test.
const noop = () => {};
const canvasStub2D: any = {
  canvas: null,
  clearRect: noop, fillRect: noop, strokeRect: noop,
  beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
  fill: noop, stroke: noop, arc: noop, ellipse: noop,
  save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
  setTransform: noop, transform: noop, resetTransform: noop,
  drawImage: noop, putImageData: noop,
  getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  createLinearGradient: () => ({ addColorStop: noop }),
  createRadialGradient: () => ({ addColorStop: noop }),
  createPattern: () => null,
  measureText: () => ({ width: 0 }),
  fillText: noop, strokeText: noop,
  set fillStyle(_v: unknown) {}, get fillStyle() { return "#000"; },
  set strokeStyle(_v: unknown) {}, get strokeStyle() { return "#000"; },
  set lineWidth(_v: unknown) {}, get lineWidth() { return 1; },
  set globalAlpha(_v: unknown) {}, get globalAlpha() { return 1; },
  set font(_v: unknown) {}, get font() { return "10px sans-serif"; },
};

if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = function (type: string) {
    if (type === "2d") return canvasStub2D as any;
    return null;
  } as any;
}
