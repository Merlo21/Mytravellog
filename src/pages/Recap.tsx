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
  ctx.fillStyle = "#060e1e"; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // Header
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = '700 26px "Space Grotesk", sans-serif';
  ctx.fillText("IL TUO ANNO DI VIAGGI", P, 110);
  ctx.fillStyle = "#60a5fa";
  ctx.font = '800 150px "Space Grotesk", sans-serif';
  ctx.fillText(String(r.year), P, 250);

  // Hero km
  ctx.fillStyle = "#f0f4ff";
  ctx.font = '800 96px "JetBrains Mono", monospace';
  const kmStr = fmt.dist(r.km);
  ctx.fillText(kmStr, P, 370);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = '400 30px "Space Grotesk", sans-serif';
  ctx.fillText("percorsi in totale", P, 412);

  // Stat tiles (4)
  const tiles: [string, string][] = [
    [String(r.trips), "viaggi"], [String(r.countries), "paesi"], [String(r.cities), "città"], [String(r.days), "giorni"],
  ];
  const tW = (W - 2 * P - 3 * 20) / 4, tY = 460, tH = 150;
  tiles.forEach(([v, l], i) => {
    const x = P + i * (tW + 20);
    ctx.fillStyle = "#0a1628"; roundRect(ctx, x, tY, tW, tH, 18); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = "#1a2d4a"; ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#f0f4ff"; ctx.font = '800 58px "JetBrains Mono", monospace';
    ctx.fillText(v, x + tW / 2, tY + 88);
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = '600 24px "Space Grotesk", sans-serif';
    ctx.fillText(l, x + tW / 2, tY + 122);
  });

  // Transport bar
  const barY = tY + tH + 60, barX = P, barW = W - 2 * P, barH = 26;
  const total = Object.values(r.byMode).reduce((a, b) => a + b, 0);
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.font = '700 22px "Space Grotesk", sans-serif';
  ctx.fillText("COME TI SEI MOSSO", P, barY - 18);
  roundRect(ctx, barX, barY, barW, barH, 13); ctx.fillStyle = "#0a1628"; ctx.fill();
  if (total > 0) {
    let cx = barX;
    ctx.save(); roundRect(ctx, barX, barY, barW, barH, 13); ctx.clip();
    for (const [mode, km] of Object.entries(r.byMode)) {
      if (km <= 0) continue;
      const w = (km / total) * barW;
      ctx.fillStyle = MODE_COLOR[mode] ?? "#888"; ctx.fillRect(cx, barY, w, barH); cx += w;
    }
    ctx.restore();
  }
  // legend (mezzi usati)
  let lx = barX, ly = barY + barH + 40;
  ctx.font = '600 24px "Space Grotesk", sans-serif';
  for (const [mode, km] of Object.entries(r.byMode)) {
    if (km <= 0) continue;
    const label = MODE_LABEL[mode] ?? mode;
    ctx.fillStyle = MODE_COLOR[mode] ?? "#888";
    ctx.beginPath(); ctx.arc(lx + 8, ly - 8, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText(label, lx + 24, ly);
    lx += 30 + ctx.measureText(label).width + 28;
  }

  // Records 2x2
  const recs: [string, string, string][] = [
    ["Più lontano", r.farthest ? fmt.dist(r.farthest.value) : "—", r.farthest?.city ?? ""],
    ["Più in alto", r.highest ? fmt.alt(r.highest.value) : "—", r.highest?.city ?? ""],
    ["Più caldo", r.hottest ? fmt.temp(r.hottest.value) : "—", r.hottest?.city ?? ""],
    ["Più freddo", r.coldest ? fmt.temp(r.coldest.value) : "—", r.coldest?.city ?? ""],
  ];
  const rY = ly + 40, rW = (W - 2 * P - 20) / 2, rH = 150;
  recs.forEach(([lab, val, sub], i) => {
    const x = P + (i % 2) * (rW + 20), y = rY + Math.floor(i / 2) * (rH + 20);
    ctx.fillStyle = "#0a1628"; roundRect(ctx, x, y, rW, rH, 18); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = "#1a2d4a"; ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.font = '700 22px "Space Grotesk", sans-serif';
    ctx.fillText(lab.toUpperCase(), x + 26, y + 46);
    ctx.fillStyle = "#fbbf24"; ctx.font = '800 46px "JetBrains Mono", monospace';
    ctx.fillText(val, x + 26, y + 100);
    ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.font = '400 24px "Space Grotesk", sans-serif';
    if (sub) ctx.fillText(sub, x + 26, y + 134);
  });

  // Top country
  const cY = rY + 2 * rH + 20 + 40;
  if (r.topCountry) {
    ctx.textAlign = "left";
    let tx = P;
    if (flag && flag.complete && flag.naturalWidth > 0) {
      const fw = 66, fh = 46;
      ctx.save(); ctx.fillStyle = "#fff"; roundRect(ctx, tx - 2, cY - fh + 2, fw + 4, fh + 4, 6); ctx.fill();
      roundRect(ctx, tx, cY - fh + 4, fw, fh, 5); ctx.clip();
      ctx.drawImage(flag, tx, cY - fh + 4, fw, fh); ctx.restore();
      tx += fw + 22;
    }
    ctx.fillStyle = "#f0f4ff"; ctx.font = '700 40px "Space Grotesk", sans-serif';
    ctx.fillText(r.topCountry.name, tx, cY);
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = '400 26px "Space Grotesk", sans-serif';
    ctx.fillText(`paese dell'anno · ${r.topCountry.visits} ${r.topCountry.visits === 1 ? "viaggio" : "viaggi"}`, tx, cY + 36);
  }

  // Footer
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = '700 28px "Space Grotesk", sans-serif';
  ctx.fillText("NAV·TA", P, H - 60);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = '400 26px "Space Grotesk", sans-serif';
  ctx.fillText(`${r.monthsActive} mesi in viaggio`, W - P, H - 60);
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
