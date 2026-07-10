import { describe, it, expect, afterEach } from "vitest";
import { canRecordVideo } from "./TripFlyover";

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
