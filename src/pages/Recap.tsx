import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Share2, Download } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { loadTrips } from "@/lib/storage";
import { useSettings, formatDistanceKm, formatAltitudeM, formatTemperatureC } from "@/lib/settings";
import { computeYearRecap, availableYears, YearRecap } from "@/lib/recap";

const W = 1080, H = 1350;
const MODE_COLOR: Record<string, string> = {
  plane: "#378ADD", train: "#BA7517", car: "#A855F7", ship: "#0F6E56", walk: "#D85A30", bici: "#22C55E", moto: "#EAB308",
};
const MODE_LABEL: Record<string, string> = {
  plane: "Aereo", train: "Treno", car: "Auto", ship: "Nave", walk: "A piedi", bici: "Bici", moto: "Moto",
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface Fmt { dist: (km: number) => string; alt: (m: number) => string; temp: (c: number) => string }

function drawRecap(ctx: CanvasRenderingContext2D, r: YearRecap, fmt: Fmt, flag: HTMLImageElement | null) {
  const P = 70;
  const ls = (v: string) => { try { (ctx as any).letterSpacing = v; } catch { /* browser vecchio */ } };

  // Sfondo notturno (gradiente) + micro-stelle decorative.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0c1f3d"); bg.addColorStop(1, "#060b16");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const stars: [number, number, number, number][] = [
    [880, 92, 3, 0.5], [980, 150, 2, 0.4], [820, 210, 2, 0.32], [1012, 258, 2.5, 0.3],
    [758, 128, 2, 0.3], [930, 322, 2, 0.24], [700, 250, 2, 0.2], [1000, 70, 2, 0.4],
  ];
  for (const [x, y, rad, a] of stars) { ctx.beginPath(); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill(); }
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";

  // Kicker
  ls("4px");
  ctx.fillStyle = "#fbbf24"; ctx.font = '700 26px "Space Grotesk", sans-serif';
  ctx.fillText("IL TUO ANNO DI VIAGGI", P, 118);
  ls("0px");

  // Anno (gradiente blu → verde)
  const yg = ctx.createLinearGradient(P, 150, P + 460, 270);
  yg.addColorStop(0, "#60a5fa"); yg.addColorStop(1, "#34d399");
  ctx.fillStyle = yg; ctx.font = '800 150px "Space Grotesk", sans-serif';
  ctx.fillText(String(r.year), P, 262);

  // Hero km — numero grande + unità in ambra
  const distStr = fmt.dist(r.km);
  const sp = distStr.lastIndexOf(" ");
  const kmNum = sp > 0 ? distStr.slice(0, sp) : distStr;
  const kmUnit = sp > 0 ? distStr.slice(sp + 1) : "";
  ctx.fillStyle = "#f0f4ff"; ctx.font = '800 96px "JetBrains Mono", monospace';
  ctx.fillText(kmNum, P, 372);
  const kmW = ctx.measureText(kmNum).width;
  ctx.fillStyle = "#fbbf24"; ctx.font = '700 44px "Space Grotesk", sans-serif';
  ctx.fillText(kmUnit, P + kmW + 18, 372);
  ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.font = '400 28px "Space Grotesk", sans-serif';
  ctx.fillText("percorsi in totale", P, 414);

  // Statistiche su filetti (niente scatolette)
  const stats: [string, string][] = [[String(r.trips), "viaggi"], [String(r.countries), "paesi"], [String(r.cities), "città"], [String(r.days), "giorni"]];
  const sTop = 462, sBot = 600, colW = (W - 2 * P) / 4;
  ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(P, sTop); ctx.lineTo(W - P, sTop); ctx.moveTo(P, sBot); ctx.lineTo(W - P, sBot); ctx.stroke();
  stats.forEach(([v, l], i) => {
    const cx = P + i * colW + colW / 2;
    if (i > 0) { ctx.beginPath(); ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.moveTo(P + i * colW, sTop + 24); ctx.lineTo(P + i * colW, sBot - 24); ctx.stroke(); }
    ctx.textAlign = "center";
    ctx.fillStyle = "#f0f4ff"; ctx.font = '800 56px "JetBrains Mono", monospace';
    ctx.fillText(v, cx, sTop + 84);
    ls("1px"); ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = '600 22px "Space Grotesk", sans-serif';
    ctx.fillText(l.toUpperCase(), cx, sTop + 120); ls("0px");
  });

  // Come ti sei mosso — barra + legenda
  ctx.textAlign = "left";
  const barY = 690, barX = P, barW = W - 2 * P, barH = 24;
  ls("1px"); ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = '700 22px "Space Grotesk", sans-serif';
  ctx.fillText("COME TI SEI MOSSO", P, barY - 20); ls("0px");
  roundRect(ctx, barX, barY, barW, barH, 12); ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fill();
  const total = Object.values(r.byMode).reduce((a, b) => a + b, 0);
  if (total > 0) {
    let cx = barX; ctx.save(); roundRect(ctx, barX, barY, barW, barH, 12); ctx.clip();
    for (const [mode, km] of Object.entries(r.byMode)) { if (km <= 0) continue; const w = (km / total) * barW; ctx.fillStyle = MODE_COLOR[mode] ?? "#888"; ctx.fillRect(cx, barY, w, barH); cx += w; }
    ctx.restore();
  }
  let lx = barX; const ly = barY + barH + 42;
  ctx.font = '600 24px "Space Grotesk", sans-serif';
  for (const [mode, km] of Object.entries(r.byMode)) {
    if (km <= 0) continue;
    const label = MODE_LABEL[mode] ?? mode;
    ctx.fillStyle = MODE_COLOR[mode] ?? "#888"; ctx.beginPath(); ctx.arc(lx + 8, ly - 8, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.fillText(label, lx + 24, ly);
    lx += 32 + ctx.measureText(label).width + 26;
  }

  // Record 2x2 (minimali, valore in ambra)
  const recs: [string, string, string][] = [
    ["Più lontano", r.farthest ? fmt.dist(r.farthest.value) : "—", r.farthest?.city ?? ""],
    ["Più in alto", r.highest ? fmt.alt(r.highest.value) : "—", r.highest?.city ?? ""],
    ["Più caldo", r.hottest ? fmt.temp(r.hottest.value) : "—", r.hottest?.city ?? ""],
    ["Più freddo", r.coldest ? fmt.temp(r.coldest.value) : "—", r.coldest?.city ?? ""],
  ];
  const rTop = ly + 44, colRW = (W - 2 * P) / 2, rowH = 150;
  ctx.textAlign = "left";
  recs.forEach(([lab, val, sub], i) => {
    const x = P + (i % 2) * colRW, y = rTop + Math.floor(i / 2) * rowH;
    ls("1px"); ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = '700 21px "Space Grotesk", sans-serif';
    ctx.fillText(lab.toUpperCase(), x, y + 30); ls("0px");
    ctx.fillStyle = "#fbbf24"; ctx.font = '800 44px "JetBrains Mono", monospace';
    ctx.fillText(val, x, y + 86);
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = '400 24px "Space Grotesk", sans-serif';
    if (sub) ctx.fillText(sub, x, y + 122);
  });

  // Paese dell'anno
  const cTop = rTop + 2 * rowH + 30;
  if (r.topCountry) {
    let tx = P; const fw = 70, fh = 48;
    if (flag && flag.complete && flag.naturalWidth > 0) {
      ctx.save(); ctx.fillStyle = "#fff"; roundRect(ctx, tx - 2, cTop - 2, fw + 4, fh + 4, 7); ctx.fill();
      roundRect(ctx, tx, cTop, fw, fh, 6); ctx.clip(); ctx.drawImage(flag, tx, cTop, fw, fh); ctx.restore();
      tx += fw + 22;
    }
    ctx.textAlign = "left";
    ctx.fillStyle = "#f0f4ff"; ctx.font = '700 40px "Space Grotesk", sans-serif';
    ctx.fillText(r.topCountry.name, tx, cTop + 30);
    ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.font = '400 24px "Space Grotesk", sans-serif';
    ctx.fillText("paese dell'anno", tx, cTop + 64);
  }

  // Footer
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = '700 28px "Space Grotesk", sans-serif';
  ctx.fillText("NAV·TA", P, H - 58);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = '400 26px "Space Grotesk", sans-serif';
  ctx.fillText(`${r.monthsActive} ${r.monthsActive === 1 ? "mese" : "mesi"} in viaggio`, W - P, H - 58);
  ctx.textAlign = "left";
}

function canShareFile(file: File): boolean {
  try {
    return typeof navigator !== "undefined" && typeof (navigator as any).canShare === "function" && (navigator as any).canShare({ files: [file] });
  } catch { return false; }
}

const Recap = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { distanceUnit, temperatureUnit } = useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [flag, setFlag] = useState<HTMLImageElement | null>(null);

  const trips = useMemo(() => loadTrips(), []);
  const years = useMemo(() => availableYears(trips), [trips]);
  const year = useMemo(() => {
    const q = parseInt(params.get("anno") || "", 10);
    return Number.isFinite(q) && years.includes(q) ? q : (years[0] ?? new Date().getFullYear());
  }, [params, years]);
  const recap = useMemo(() => computeYearRecap(trips, year), [trips, year]);
  const fmt: Fmt = useMemo(() => ({
    dist: (km) => formatDistanceKm(km, distanceUnit),
    alt: (m) => formatAltitudeM(m, distanceUnit),
    temp: (c) => formatTemperatureC(c, temperatureUnit),
  }), [distanceUnit, temperatureUnit]);

  // Bandiera del paese dell'anno (crossOrigin per il canvas pulito).
  useEffect(() => {
    setFlag(null);
    const code = recap.topCountry?.code?.toLowerCase();
    if (!code) return;
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => setFlag(img);
    img.src = `https://flagcdn.com/w160/${code}.png`;
  }, [recap.topCountry?.code]);

  // Disegno (attende i font di marca, come il poster).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await (document as any).fonts?.ready; } catch { /* noop */ }
      if (cancelled) return;
      const c = canvasRef.current; if (!c) return;
      const ctx = c.getContext("2d"); if (!ctx) return;
      drawRecap(ctx, recap, fmt, flag);
    })();
    return () => { cancelled = true; };
  }, [recap, fmt, flag]);

  const share = async () => {
    const c = canvasRef.current; if (!c) return;
    const blob: Blob | null = await new Promise(res => c.toBlob(res, "image/png"));
    if (!blob) return;
    const file = new File([blob], `recap-${year}.png`, { type: "image/png" });
    if (canShareFile(file)) {
      try { await navigator.share({ files: [file], title: `Il mio ${year} di viaggi` }); } catch { /* annullato */ }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  };

  return (
    <main className="min-h-screen">
      <AppHeader />
      <div className="container mx-auto px-6 py-8" style={{ maxWidth: 560 }}>
        <button onClick={() => navigate(-1)} className="flex items-center gap-2" style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 16, background: "none", border: "none", cursor: "pointer" }}>
          <ArrowLeft className="w-4 h-4" /> Indietro
        </button>

        {years.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, textAlign: "center", padding: "60px 0" }}>
            Ancora nessun viaggio: il recap si popola man mano che aggiungi i tuoi viaggi.
          </p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {years.map(y => (
                <button key={y} onClick={() => setParams(y === years[0] ? {} : { anno: String(y) })}
                  style={{
                    fontSize: 13, fontWeight: 600, padding: "6px 14px", borderRadius: 999, cursor: "pointer",
                    border: y === year ? "1px solid #60a5fa" : "1px solid #1a2d4a",
                    background: y === year ? "rgba(96,165,250,0.15)" : "transparent",
                    color: y === year ? "#60a5fa" : "rgba(255,255,255,0.55)",
                  }}>{y}</button>
              ))}
            </div>

            <canvas ref={canvasRef} width={W} height={H}
              style={{ width: "100%", height: "auto", borderRadius: 16, border: "0.5px solid #1a2d4a", display: "block" }} />

            <button onClick={share}
              style={{
                marginTop: 16, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px", borderRadius: 999, background: "#60a5fa", color: "#0a1628", border: "none",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>
              {canShareFile(new File([], "x.png", { type: "image/png" })) ? <Share2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              Condividi il recap
            </button>
          </>
        )}
      </div>
    </main>
  );
};

export default Recap;
