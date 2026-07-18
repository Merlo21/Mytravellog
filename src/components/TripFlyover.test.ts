import { describe, it, expect, afterEach } from "vitest";
import { canRecordVideo, fanCardLayout } from "./TripFlyover";

describe("canRecordVideo", () => {
  const originalCaptureStream = (HTMLCanvasElement.prototype as any).captureStream;
  const originalMediaRecorder = (globalThis as any).MediaRecorder;

  afterEach(() => {
    (HTMLCanvasElement.prototype as any).captureStream = originalCaptureStream;
    (globalThis as any).MediaRecorder = originalMediaRecorder;
  });

  it("false se captureStream non è supportato (jsdom di default, come Safari/WebKit)", () => {
    delete (HTMLCanvasElement.prototype as any).captureStream;
    delete (globalThis as any).MediaRecorder;
    expect(canRecordVideo()).toBe(false);
  });

  it("true quando captureStream e MediaRecorder(webm) sono entrambi disponibili", () => {
    (HTMLCanvasElement.prototype as any).captureStream = () => ({});
    (globalThis as any).MediaRecorder = { isTypeSupported: (t: string) => t === "video/webm" };
    expect(canRecordVideo()).toBe(true);
  });

  it("false se MediaRecorder esiste ma non supporta video/webm", () => {
    (HTMLCanvasElement.prototype as any).captureStream = () => ({});
    (globalThis as any).MediaRecorder = { isTypeSupported: () => false };
    expect(canRecordVideo()).toBe(false);
  });

  it("false se manca solo MediaRecorder", () => {
    (HTMLCanvasElement.prototype as any).captureStream = () => ({});
    delete (globalThis as any).MediaRecorder;
    expect(canRecordVideo()).toBe(false);
  });
});

describe("fanCardLayout — ventaglio 'mano di carte' delle foto per tappa", () => {
  it("la carta corrente è dritta, ingrandita e sopra tutte le altre", () => {
    const n = 4;
    const front = fanCardLayout(2, 2, n);
    expect(front.rotate).toBe(0);
    expect(front.scale).toBeGreaterThan(1);
    // z più alto di qualsiasi carta non in primo piano
    for (let i = 0; i < n; i++) {
      if (i === 2) continue;
      expect(front.z).toBeGreaterThan(fanCardLayout(i, 2, n).z);
    }
  });

  it("le carte non in primo piano sono ruotate e aperte a ventaglio verso destra", () => {
    const n = 4;
    // rotazione e offset orizzontale crescono con l'indice (ventaglio a destra)
    const c0 = fanCardLayout(0, 3, n);
    const c1 = fanCardLayout(1, 3, n);
    expect(c1.rotate).toBeGreaterThan(c0.rotate);
    expect(c1.tx).toBeGreaterThan(c0.tx);
    expect(c0.scale).toBe(1);
  });

  it("al variare della carta corrente cambia quale è in primo piano (effetto sfoglia)", () => {
    const n = 3;
    expect(fanCardLayout(0, 0, n).rotate).toBe(0); // corrente=0 → carta 0 dritta
    expect(fanCardLayout(0, 1, n).rotate).not.toBe(0); // corrente=1 → carta 0 torna nel ventaglio
    expect(fanCardLayout(1, 1, n).rotate).toBe(0); // corrente=1 → carta 1 dritta
  });
});
