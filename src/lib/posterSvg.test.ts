import { describe, it, expect } from "vitest";
import { buildPosterSvg, routeBounds } from "./posterSvg";

const INPUT = {
  routeCoords: [[9.19, 45.46], [11.39, 47.27], [13.78, 45.65]] as [number, number][],
  stops: [
    { lon: 9.19, lat: 45.46, label: "Milano" },
    { lon: 11.39, lat: 47.27, label: "Innsbruck" },
    { lon: 13.78, lat: 45.65, label: "Trieste" },
  ],
  borders: [[[8, 44], [14, 44], [14, 48], [8, 48], [8, 44]]] as [number, number][][],
  title: "Primo viaggio insieme",
  dateLabel: "23 lug 2026 → 30 lug 2026",
  stats: "1315 km · 6 tappe",
};

describe("buildPosterSvg — master di stampa SVG", () => {
  const svg = buildPosterSvg(INPUT);

  it("è un SVG con fondo nero", () => {
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('fill="#000000"');
  });

  it("ha i livelli separati confini/tracciato/stelle/etichette/titolo", () => {
    for (const id of ["confini", "tracciato", "stelle", "etichette", "titolo"]) {
      expect(svg).toContain(`id="${id}"`);
    }
  });

  it("marca i nodi-stella come punti-LED (data-led) — uno per tappa", () => {
    const matches = svg.match(/data-led="1"/g) ?? [];
    expect(matches.length).toBe(INPUT.stops.length);
  });

  it("include i nomi delle tappe e il titolo", () => {
    expect(svg).toContain("Milano");
    expect(svg).toContain("Trieste");
    expect(svg).toContain("Primo viaggio insieme");
  });

  it("disegna il tracciato come un solo path (M…L…)", () => {
    expect(svg).toMatch(/<g id="tracciato"[^>]*><path d="M[\d.,L-]+"\/><\/g>/);
  });

  it("esce dai confini se non forniti (rotta+stelle comunque presenti)", () => {
    const noBorders = buildPosterSvg({ ...INPUT, borders: [] });
    expect(noBorders).toContain('id="tracciato"');
    expect(noBorders).toContain('id="confini"'); // gruppo presente ma vuoto
  });

  it("la didascalia sta SOTTO l'area mappa: nessuna stella la oltrepassa", () => {
    // titolo (grande, grassetto) centrato a x=W/2=800
    const m = svg.match(/<text x="800" y="([\d.]+)"[^>]*font-weight="bold"[^>]*>/);
    expect(m).toBeTruthy();
    const titleY = parseFloat(m![1]);
    const cys = Array.from(svg.matchAll(/data-led="1" cx="[\d.]+" cy="([\d.]+)"/g)).map(x => parseFloat(x[1]));
    expect(cys.length).toBe(INPUT.stops.length);
    for (const cy of cys) expect(cy).toBeLessThan(titleY);
  });

  it("escapa i caratteri XML pericolosi nei testi", () => {
    const s = buildPosterSvg({ ...INPUT, title: 'A & <B> "C"' });
    expect(s).toContain("A &amp; &lt;B&gt;");
    expect(s).not.toContain("<B>");
  });
});

describe("routeBounds", () => {
  it("racchiude i punti con un margine in gradi", () => {
    const b = routeBounds([[9, 45], [13, 47]], 1);
    expect(b.lonMin).toBe(8);
    expect(b.lonMax).toBe(14);
    expect(b.latMin).toBe(44);
    expect(b.latMax).toBe(48);
  });
});
