import { LocalTrip } from "@/lib/storage";

function project(lat: number, lon: number): [number, number] {
  const x = ((lon + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 500;
  return [x, y];
}

interface Props {
  trips: LocalTrip[];
  onSelectTrip?: (t: LocalTrip) => void;
  selectedId?: string | null;
}

export function WorldMap({ trips, onSelectTrip, selectedId }: Props) {
  const points = trips.map((t) => ({ trip: t, pos: project(t.latitude, t.longitude) }));
  const home = trips[0]
    ? project(trips[0].home_latitude, trips[0].home_longitude)
    : null;

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-[hsl(var(--ocean))] border border-border">
      <svg viewBox="0 0 1000 500" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="grid" width="50" height="25" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 25" fill="none" stroke="hsl(var(--grid))" strokeWidth="0.5" />
          </pattern>
          <radialGradient id="dotGlow">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="homeGlow">
            <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.7" />
            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="1000" height="500" fill="url(#grid)" />

        <g fill="hsl(var(--land))" stroke="hsl(var(--border))" strokeWidth="0.5">
          <path d="M480,200 Q495,195 510,205 L530,225 Q545,250 555,290 Q558,320 545,350 Q525,375 505,378 Q485,375 478,355 Q465,325 460,290 Q462,250 470,225 Z" />
          <path d="M460,150 Q480,145 510,150 L535,158 Q545,170 530,180 Q500,188 475,185 Q455,180 450,168 Z" />
          <path d="M540,140 Q600,135 680,150 Q740,165 770,190 Q780,215 760,225 Q700,235 640,230 Q585,225 555,215 Q540,195 540,170 Z" />
          <path d="M640,225 Q655,225 665,245 Q670,265 660,278 Q645,280 638,265 Q635,245 640,225 Z" />
          <path d="M740,235 Q765,240 775,260 Q770,278 750,275 Q735,265 740,245 Z" />
          <path d="M150,140 Q200,130 270,140 Q310,155 320,180 Q310,210 280,225 Q230,235 190,225 Q155,210 140,180 Q140,155 150,140 Z" />
          <path d="M250,225 Q275,228 285,250 Q278,275 255,278 Q235,270 240,248 Z" />
          <path d="M275,290 Q295,285 310,300 Q325,335 320,375 Q310,410 290,420 Q272,415 268,395 Q265,360 268,325 Q270,305 275,290 Z" />
          <path d="M755,355 Q800,350 830,365 Q840,385 820,395 Q780,400 755,390 Q745,375 755,355 Z" />
          <path d="M385,90 Q410,85 425,100 Q425,120 405,128 Q385,125 380,110 Z" />
          <path d="M455,148 Q462,148 465,155 Q462,162 455,162 Q450,158 455,148 Z" />
          <path d="M790,180 Q800,180 803,195 Q798,205 790,200 Q785,190 790,180 Z" />
          <path d="M745,290 Q775,288 795,295 Q790,305 760,305 Q740,300 745,290 Z" />
          <path d="M572,335 Q580,335 583,355 Q578,370 572,365 Q568,350 572,335 Z" />
          <path d="M870,395 Q880,395 882,410 Q876,418 870,412 Z" />
        </g>

        {home && (
          <g>
            <circle cx={home[0]} cy={home[1]} r="14" fill="url(#homeGlow)" />
            <circle cx={home[0]} cy={home[1]} r="3.5" fill="hsl(var(--accent))" stroke="hsl(var(--background))" strokeWidth="1" />
          </g>
        )}

        {points.map(({ trip, pos }) => {
          const isSelected = selectedId === trip.id;
          return (
            <g key={trip.id} className="cursor-pointer" onClick={() => onSelectTrip?.(trip)}>
              {home && (
                <line
                  x1={home[0]} y1={home[1]} x2={pos[0]} y2={pos[1]}
                  stroke="hsl(var(--primary))"
                  strokeWidth={isSelected ? 1.2 : 0.4}
                  strokeDasharray="2 3"
                  opacity={isSelected ? 0.9 : 0.25}
                />
              )}
              <circle cx={pos[0]} cy={pos[1]} r={isSelected ? 16 : 10} fill="url(#dotGlow)" />
              <circle
                cx={pos[0]} cy={pos[1]}
                r={isSelected ? 4.5 : 3}
                fill="hsl(var(--primary))"
                stroke="hsl(var(--background))"
                strokeWidth="0.8"
                className="transition-all"
              >
                <title>{trip.city}, {trip.country}</title>
              </circle>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
