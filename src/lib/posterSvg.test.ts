import { describe, it, expect } from "vitest";
import { buildPosterSvg, buildEditorQuadroSvg, panelGeoBounds, pickPanelIndex, routeBounds, type EditorPanel } from "./posterSvg";

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

  it("porta la firma 'By' col logo incorporato (xlink) in basso a destra", () => {
    expect(svg).toContain('id="firma"');
    expect(svg).toContain(">By<");
    expect(svg).toContain('xlink:href="data:image/png;base64,');
    expect(svg).toContain('xmlns:xlink=');
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

  it("con hideLabels non disegna i nomi delle tappe (Mappa della vita)", () => {
    const s = buildPosterSvg({ ...INPUT, hideLabels: true });
    expect(s).not.toContain("Milano");
    expect(s).not.toContain("Trieste");
    // le stelle-LED restano (una per tappa)
    expect((s.match(/data-led="1"/g) ?? []).length).toBe(INPUT.stops.length);
  });

  it("con routeSegments disegna un path per viaggio (Mappa della vita)", () => {
    const s = buildPosterSvg({
      routeSegments: [
        [[9.19, 45.46], [2.35, 48.86]],
        [[9.19, 45.46], [2.17, 41.39]],
      ],
      stops: [
        { lon: 9.19, lat: 45.46, label: "Milano" },
        { lon: 2.35, lat: 48.86, label: "Parigi" },
        { lon: 2.17, lat: 41.39, label: "Barcellona" },
      ],
      title: "La mappa della mia vita",
    });
    const g = s.match(/<g id="tracciato"[^>]*>(.*?)<\/g>/)?.[1] ?? "";
    expect((g.match(/<path /g) ?? []).length).toBe(2);
    expect(s).toContain("La mappa della mia vita");
  });
});

describe("buildEditorQuadroSvg — quadro dall'editor (pannelli a mano)", () => {
  const panels: EditorPanel[] = [
    { id: "a", x: 0, y: 0, w: 800, h: 500, refLon: -10, refLat: 60, scale: 8 },
    { id: "b", x: 800, y: 0, w: 800, h: 500, refLon: 50, refLat: 60, scale: 8 },
  ];
  const svg = buildEditorQuadroSvg({
    panels,
    borders: [[[0, 40], [20, 40], [20, 55], [0, 55], [0, 40]]],
    links: [[[9, 45], [70, 35]]],
    // 3ª città (200,80) è FUORI da ogni pannello: col fallback "pannello più
    // vicino" deve comparire lo stesso (nessuna città/linea sparisce).
    stops: [{ lon: 9, lat: 45 }, { lon: 70, lat: 35 }, { lon: 200, lat: 80 }],
    width: 1600, height: 500,
  });

  it("una tela + clip per pannello, fondo trasparente", () => {
    expect((svg.match(/<clipPath/g) ?? []).length).toBe(panels.length);
    expect((svg.match(/fill="#050505"/g) ?? []).length).toBe(panels.length);
    expect(svg).not.toContain('fill="#000000"');
  });

  it('resa "corpo + gerarchia": terre riempite (evenodd) sotto confini al 50%', () => {
    expect((svg.match(/fill-opacity="0\.055"/g) ?? []).length).toBe(panels.length);
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg).toContain('stroke-opacity="0.5"');
  });

  it("linee dei viaggi sopra + una stella-LED per città (anche fuori pannello: fallback)", () => {
    expect(svg).toContain('id="tratte"');
    expect((svg.match(/data-led="1"/g) ?? []).length).toBe(3);
  });

  it("porta la firma 'By' col logo anche sul quadro", () => {
    expect(svg).toContain('id="firma"');
    expect(svg).toContain('xlink:href="data:image/png;base64,');
  });
});

describe("panelGeoBounds / pickPanelIndex", () => {
  it("bounds coerenti col riquadro (ref = angolo alto-sinistra)", () => {
    const p: EditorPanel = { id: "x", x: 0, y: 0, w: 400, h: 300, refLon: 0, refLat: 50, scale: 10 };
    const b = panelGeoBounds(p);
    expect(b.lonMin).toBeCloseTo(0);
    expect(b.lonMax).toBeCloseTo(40); // 0 + 400/10
    expect(b.latMax).toBeCloseTo(50);
    expect(b.latMin).toBeLessThan(50);
  });

  it("assegna la città alla tela più zoomata quando più tele la contengono", () => {
    const wide: EditorPanel = { id: "w", x: 0, y: 0, w: 400, h: 300, refLon: -50, refLat: 60, scale: 2 };
    const tight: EditorPanel = { id: "t", x: 0, y: 0, w: 400, h: 300, refLon: 5, refLat: 47, scale: 40 };
    // (9,45) è dentro entrambe → vince la più zoomata (area minore) = tight (indice 1)
    expect(pickPanelIndex([wide, tight], 9, 45)).toBe(1);
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
