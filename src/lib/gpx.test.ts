import { describe, it, expect } from "vitest";
import { parseGpx, downsample, trackLengthKm, summarizeGpx, buildTrackPreviewSvg } from "./gpx";

const GPX = `<?xml version="1.0"?>
<gpx version="1.1">
  <trk><trkseg>
    <trkpt lat="45.46" lon="9.19"><ele>120</ele><time>2026-07-23T08:00:00Z</time></trkpt>
    <trkpt lat="46.00" lon="9.50"><ele>900</ele><time>2026-07-23T10:00:00Z</time></trkpt>
    <trkpt lat="46.50" lon="11.00"><ele>1500</ele><time>2026-07-24T09:00:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

describe("parseGpx", () => {
  it("estrae coordinate [lon,lat], time ed ele", () => {
    const d = parseGpx(GPX);
    expect(d.coords.length).toBe(3);
    expect(d.coords[0]).toEqual([9.19, 45.46]);
    expect(d.times[0]).toBe("2026-07-23T08:00:00Z");
    expect(d.eles[2]).toBe(1500);
  });

  it("lancia se il GPX non è valido", () => {
    expect(() => parseGpx("non xml <")).toThrow();
  });

  it("usa rtept se non ci sono trkpt", () => {
    const d = parseGpx(`<gpx><rte><rtept lat="1" lon="2"/><rtept lat="3" lon="4"/></rte></gpx>`);
    expect(d.coords).toEqual([[2, 1], [4, 3]]);
  });
});

describe("downsample", () => {
  it("non tocca sotto la soglia", () => {
    const c = [[0, 0], [1, 1]] as [number, number][];
    expect(downsample(c, 800)).toBe(c);
  });
  it("riduce a max mantenendo primo e ultimo", () => {
    const c = Array.from({ length: 5000 }, (_, i) => [i / 1000, i / 1000] as [number, number]);
    const out = downsample(c, 800);
    expect(out.length).toBe(800);
    expect(out[0]).toEqual(c[0]);
    expect(out[out.length - 1]).toEqual(c[c.length - 1]);
  });
});

describe("summarizeGpx", () => {
  it("calcola estremi, lunghezza (> retta), date e quota max", () => {
    const s = summarizeGpx(parseGpx(GPX));
    expect(s.start).toEqual([9.19, 45.46]);
    expect(s.end).toEqual([11.00, 46.50]);
    expect(s.lengthKm).toBeGreaterThan(s.straightKm); // il percorso spezzato è più lungo della retta
    expect(s.dateStart).toBe("2026-07-23");
    expect(s.dateEnd).toBe("2026-07-24");
    expect(s.maxEle).toBe(1500);
  });
});

describe("trackLengthKm", () => {
  it("somma i segmenti", () => {
    const km = trackLengthKm([[9, 45], [9, 46]]);
    expect(km).toBeGreaterThan(100);
    expect(km).toBeLessThan(120); // ~111 km per grado di latitudine
  });
});

describe("buildTrackPreviewSvg", () => {
  it("disegna path + due estremi su fondo scuro", () => {
    const svg = buildTrackPreviewSvg([[9, 45], [10, 46], [11, 45.5]]);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('fill="#0a1628"');
    expect(svg).toContain("<path");
    expect((svg.match(/<circle/g) ?? []).length).toBe(2); // partenza + arrivo
  });
  it("con meno di 2 punti rende solo lo sfondo", () => {
    const svg = buildTrackPreviewSvg([[9, 45]]);
    expect(svg).not.toContain("<path");
  });
});
