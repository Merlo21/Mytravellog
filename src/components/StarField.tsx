// [FROZEN] — Non modificare senza esplicita richiesta
import { useEffect, useRef, useState } from "react";

const STARS: [number, number, number][] = [
  [83.8, 7.4, 0.1],   [78.6, -8.2, 0.2],  [84.1, -1.2, 1.7],
  [83.0, -1.9, 2.2],  [85.2, -0.3, 1.7],  [88.8, 7.4, 3.2],
  [82.1, -9.7, 2.8],  [165.9, 61.7, 1.8], [165.5, 56.4, 2.4],
  [178.5, 53.7, 2.4], [183.9, 57.0, 3.3], [193.5, 55.9, 1.8],
  [200.9, 54.9, 2.1], [206.9, 49.3, 1.9], [2.3, 59.1, 2.2],
  [10.1, 59.2, 2.3],  [14.2, 60.7, 2.7],  [17.4, 60.2, 2.7],
  [28.6, 63.7, 3.4],  [247.4, -26.4, 1.0],[240.1, -19.8, 2.6],
  [252.2, -34.3, 2.3],[152.1, 11.9, 1.4], [177.3, 14.6, 2.1],
  [154.2, 19.8, 2.6], [310.4, 45.3, 1.3], [292.7, 27.9, 1.2],
  [305.6, 40.3, 2.5], [311.6, 33.9, 2.5], [279.2, 38.8, 0.0],
  [297.7, 8.9, 0.8],
];

const LINES: [number, number][] = [
  [2,3],[3,4],[0,2],[0,4],[1,6],[1,3],[4,5],[6,3],
  [7,8],[8,9],[9,10],[10,11],[11,12],[12,13],
  [14,15],[15,16],[16,17],[17,18],
  [19,20],[20,21],
  [22,24],[24,23],
  [27,26],[28,26],[29,26],[26,30],
];

// Each constellation: name + star indices that belong to it (for centroid calc)
const CONSTELLATIONS: { name: string; stars: number[] }[] = [
  { name: "Orione",        stars: [0,1,2,3,4,5,6] },
  { name: "Orsa Maggiore", stars: [7,8,9,10,11,12,13] },
  { name: "Cassiopeia",    stars: [14,15,16,17,18] },
  { name: "Scorpione",     stars: [19,20,21] },
  { name: "Leone",         stars: [22,23,24] },
  { name: "Cigno",         stars: [25,26,27,28] },
  { name: "Lira",          stars: [29] },
  { name: "Aquila",        stars: [30] },
];

function starToXY(ra: number, dec: number, ox: number, oy: number, W: number, H: number) {
  const x = ((ra / 360 + ox / W) % 1) * W;
  const y = (0.5 - dec / 180) * H + oy * 0.3;
  return [x, y];
}

interface Props {
  offsetX: number;
  offsetY: number;
  mousePos?: {x:number;y:number} | null;
}

export function StarField({ offsetX, offsetY, mousePos }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredConst, setHoveredConst] = useState<string | null>(null);
  const [labelPos, setLabelPos] = useState<{x:number;y:number}>({x:0,y:0});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      if (!W || !H) return;
      canvas.width  = W * devicePixelRatio;
      canvas.height = H * devicePixelRatio;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(devicePixelRatio, devicePixelRatio);

      // Fill entire canvas with base color first
      ctx.fillStyle = "#060e1e";
      ctx.fillRect(0, 0, W, H);
      // Then overlay radial glow only in center — stops before edges
      const bg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.min(W,H)*0.45);
      bg.addColorStop(0, "#0d1f3c");
      bg.addColorStop(0.6, "#0a1628");
      bg.addColorStop(1, "#060e1e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── Milky Way band ──────────────────────────────────────────────────────
      const mwAngle = -0.4;
      const mwCX = W * 0.52 + offsetX * 0.1;
      const mwCY = H * 0.48 + offsetY * 0.05;
      const mwLen = Math.max(W, H) * 1.8;
      const mwW = Math.min(W, H) * 0.32;

      // Nebula glow — save/restore to draw rotated band
      ctx.save();
      ctx.translate(mwCX, mwCY);
      ctx.rotate(mwAngle);
      const nebulaGrad = ctx.createLinearGradient(0, -mwW, 0, mwW);
      nebulaGrad.addColorStop(0,    "rgba(80,120,220,0)");
      nebulaGrad.addColorStop(0.25, "rgba(100,140,240,0.06)");
      nebulaGrad.addColorStop(0.5,  "rgba(120,160,255,0.1)");
      nebulaGrad.addColorStop(0.75, "rgba(100,140,240,0.06)");
      nebulaGrad.addColorStop(1,    "rgba(80,120,220,0)");
      ctx.fillStyle = nebulaGrad;
      ctx.fillRect(-mwLen / 2, -mwW, mwLen, mwW * 2);

      // Second layer — brighter core
      const coreGrad = ctx.createLinearGradient(0, -mwW * 0.3, 0, mwW * 0.3);
      coreGrad.addColorStop(0,   "rgba(140,170,255,0)");
      coreGrad.addColorStop(0.5, "rgba(160,190,255,0.07)");
      coreGrad.addColorStop(1,   "rgba(140,170,255,0)");
      ctx.fillStyle = coreGrad;
      ctx.fillRect(-mwLen / 2, -mwW * 0.3, mwLen, mwW * 0.6);
      ctx.restore();

      // Dense micro-stars along the band
      for (let i = 0; i < 900; i++) {
        const along = ((i / 900) - 0.5) * mwLen;
        const perp = Math.sin(i * 137.508) * mwW * 0.9 * (0.3 + Math.abs(Math.sin(i * 53.3)) * 0.7);
        const x = mwCX + Math.cos(mwAngle) * along - Math.sin(mwAngle) * perp;
        const y = mwCY + Math.sin(mwAngle) * along + Math.cos(mwAngle) * perp;
        if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
        const falloff = Math.max(0, 1 - Math.abs(perp) / (mwW * 0.8));
        const alpha = (0.25 + Math.abs(Math.sin(i * 91.3)) * 0.55) * falloff;
        const r = 0.3 + Math.abs(Math.sin(i * 47.3)) * 0.8;
        ctx.fillStyle = "rgba(210,225,255," + alpha + ")";
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }

      ctx.strokeStyle = "rgba(100,160,255,0.12)";
      ctx.lineWidth = 0.8;
      LINES.forEach(([a, b]) => {
        if (a >= STARS.length || b >= STARS.length) return;
        const [s1r, s1d] = STARS[a], [s2r, s2d] = STARS[b];
        const [x1, y1] = starToXY(s1r, s1d, offsetX, offsetY, W, H);
        const [x2, y2] = starToXY(s2r, s2d, offsetX, offsetY, W, H);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      });

      STARS.forEach(([ra, dec, mag]) => {
        const [x, y] = starToXY(ra, dec, offsetX, offsetY, W, H);
        const r = Math.max(0.5, 2.5 - mag * 0.6);
        const alpha = Math.min(1, 0.6 + (3 - mag) * 0.15);
        if (mag < 1.5) {
          const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
          grd.addColorStop(0, `rgba(200,220,255,${alpha * 0.4})`);
          grd.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(x, y, r*4, 0, Math.PI*2); ctx.fill();
        }
        ctx.fillStyle = `rgba(220,230,255,${alpha})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
      });

      const seed = 42;
      for (let i = 0; i < 300; i++) {
        const rx = ((Math.sin(i*127.1+seed)*0.5+0.5+offsetX/W*0.3)%1+1)%1;
        const ry = (Math.sin(i*311.7+seed)*0.5+0.5+offsetY/H*0.1+1)%1;
        const alpha = 0.2 + Math.abs(Math.sin(i*53.7))*0.5;
        const r = 0.3 + Math.abs(Math.sin(i*91.3))*0.7;
        ctx.fillStyle = `rgba(200,215,255,${alpha})`;
        ctx.beginPath(); ctx.arc(rx*W, ry*H, r, 0, Math.PI*2); ctx.fill();
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [offsetX, offsetY]);

  useEffect(() => {
    if (!mousePos || !containerRef.current) { if (!mousePos) setHoveredConst(null); return; }
    const rect = containerRef.current.getBoundingClientRect();
    const mx = mousePos.x - rect.left;
    const my = mousePos.y - rect.top;
    const W = rect.width, H = rect.height;
    let closest: string | null = null;
    let minDist = 80;
    CONSTELLATIONS.forEach(({ name, stars }) => {
      const pts = stars.filter(i => i < STARS.length)
        .map(i => starToXY(STARS[i][0], STARS[i][1], offsetX, offsetY, W, H));
      if (!pts.length) return;
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const dist = Math.hypot(mx - cx, my - cy);
      if (dist < minDist) { minDist = dist; closest = name; setLabelPos({ x: cx, y: cy - 18 }); }
    });
    setHoveredConst(closest);
  }, [mousePos, offsetX, offsetY]);

  // Mouse/touch handler — find nearest constellation centroid
  const handlePointer = (e: React.MouseEvent | React.TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const W = rect.width, H = rect.height;

    let closest: string | null = null;
    let minDist = 80; // px threshold

    CONSTELLATIONS.forEach(({ name, stars }) => {
      const pts = stars
        .filter(i => i < STARS.length)
        .map(i => starToXY(STARS[i][0], STARS[i][1], offsetX, offsetY, W, H));
      if (!pts.length) return;
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const dist = Math.hypot(mx - cx, my - cy);
      if (dist < minDist) {
        minDist = dist;
        closest = name;
        setLabelPos({ x: cx, y: cy - 18 });
      }
    });

    setHoveredConst(closest);
  };

  return (
    <div ref={containerRef} style={{ position:"absolute", inset:0, zIndex:0 }}
      onMouseMove={handlePointer}
      onMouseLeave={() => setHoveredConst(null)}
      onTouchMove={handlePointer}
      onTouchEnd={() => setHoveredConst(null)}>
      <canvas ref={canvasRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }} />
      {hoveredConst && (
        <div style={{
          position: "absolute",
          left: labelPos.x,
          top: labelPos.y,
          transform: "translate(-50%, -100%)",
          pointerEvents: "none",
          fontFamily: "ui-serif, Georgia, serif",
          fontSize: "10px",
          fontWeight: 300,
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.75)",
          textShadow: "0 0 12px rgba(180,210,255,0.5)",
          whiteSpace: "nowrap",
          transition: "opacity 0.3s",
          userSelect: "none",
        }}>
          {hoveredConst}
        </div>
      )}
    </div>
  );
}
