import { useEffect, useRef } from "react";

// Real constellation data: name + pairs of [ra, dec] star indices
// RA = right ascension (0-24h → 0-360°), Dec = declination (-90 to +90)
const STARS: [number, number, number][] = [ // [ra_deg, dec_deg, magnitude]
  // Orion
  [83.8, 7.4, 0.1],   // Betelgeuse
  [78.6, -8.2, 0.2],  // Rigel
  [84.1, -1.2, 1.7],  // Alnilam (belt)
  [83.0, -1.9, 2.2],  // Alnitak (belt)
  [85.2, -0.3, 1.7],  // Mintaka (belt)
  [88.8, 7.4, 3.2],   // Bellatrix
  [82.1, -9.7, 2.8],  // Saiph
  // Ursa Major (Big Dipper)
  [165.9, 61.7, 1.8], // Dubhe
  [165.5, 56.4, 2.4], // Merak
  [178.5, 53.7, 2.4], // Phecda
  [183.9, 57.0, 3.3], // Megrez
  [193.5, 55.9, 1.8], // Alioth
  [200.9, 54.9, 2.1], // Mizar
  [206.9, 49.3, 1.9], // Alkaid
  // Cassiopeia
  [2.3, 59.1, 2.2],   // Shedar
  [10.1, 59.2, 2.3],  // Caph
  [14.2, 60.7, 2.7],  // Gamma Cas
  [17.4, 60.2, 2.7],  // Ruchbah
  [28.6, 63.7, 3.4],  // Segin
  // Scorpius
  [247.4, -26.4, 1.0],// Antares
  [240.1, -19.8, 2.6],// Graffias
  [252.2, -34.3, 2.3],// Shaula
  // Leo
  [152.1, 11.9, 1.4], // Regulus
  [177.3, 14.6, 2.1], // Denebola
  [154.2, 19.8, 2.6], // Algieba
  // Cygnus (Northern Cross)
  [310.4, 45.3, 1.3], // Deneb
  [292.7, 27.9, 1.2], // Albireo
  [305.6, 40.3, 2.5], // Delta Cyg
  [311.6, 33.9, 2.5], // Gienah
  // Lyra
  [279.2, 38.8, 0.0], // Vega
  // Aquila
  [297.7, 8.9, 0.8],  // Altair
  // Plus ~200 random background stars
];

// Constellation lines: [star_index_a, star_index_b]
const LINES: [number, number][] = [
  // Orion belt
  [2,3],[3,4],
  // Orion body
  [0,2],[0,4],[1,6],[1,3],[4,5],[6,3],
  // Big Dipper
  [7,8],[8,9],[9,10],[10,11],[11,12],[12,13],
  // Cassiopeia W
  [14,15],[15,16],[16,17],[17,18],
  // Leo sickle
  [22,24],[24,23],
  // Cygnus cross
  [27,26],[28,26],[29,26],[26,30],
];

function starToXY(ra: number, dec: number, offsetX: number, offsetY: number, W: number, H: number) {
  // Convert RA/Dec to canvas position with offset for globe rotation simulation
  const x = ((ra / 360 + offsetX / W) % 1) * W;
  const y = (0.5 - dec / 180) * H + offsetY * 0.3;
  return [x, y];
}

interface Props {
  offsetX: number; // horizontal rotation from globe drag
  offsetY: number;
}

export function StarField({ offsetX, offsetY }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

      // Background gradient — slightly lighter deep space
      const bg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.7);
      bg.addColorStop(0, "#0d1a35");
      bg.addColorStop(0.5, "#080e1e");
      bg.addColorStop(1, "#03060f");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const ox = offsetX;
      const oy = offsetY;

      // Draw constellation lines first (faint)
      ctx.strokeStyle = "rgba(100,160,255,0.12)";
      ctx.lineWidth = 0.8;
      LINES.forEach(([a, b]) => {
        const [s1r, s1d] = STARS[a], [s2r, s2d] = STARS[b];
        const [x1, y1] = starToXY(s1r, s1d, ox, oy, W, H);
        const [x2, y2] = starToXY(s2r, s2d, ox, oy, W, H);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      });

      // Draw main stars
      STARS.forEach(([ra, dec, mag]) => {
        const [x, y] = starToXY(ra, dec, ox, oy, W, H);
        const r = Math.max(0.5, 2.5 - mag * 0.6);
        const alpha = Math.min(1, 0.6 + (3 - mag) * 0.15);

        // Glow for bright stars
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

      // Add 300 random background stars
      const seed = 42;
      for (let i = 0; i < 300; i++) {
        const rx = ((Math.sin(i * 127.1 + seed) * 0.5 + 0.5 + ox / W * 0.3) % 1 + 1) % 1;
        const ry = (Math.sin(i * 311.7 + seed) * 0.5 + 0.5 + oy / H * 0.1 + 1) % 1;
        const alpha = 0.2 + Math.abs(Math.sin(i * 53.7)) * 0.5;
        const r = 0.3 + Math.abs(Math.sin(i * 91.3)) * 0.7;
        ctx.fillStyle = `rgba(200,215,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(rx * W, ry * H, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [offsetX, offsetY]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:0 }}
    />
  );
}
