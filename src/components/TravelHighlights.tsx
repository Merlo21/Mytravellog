// [FROZEN] — Non modificare senza esplicita richiesta
import { useMemo } from "react";
import React from "react";
import { Mountain, Globe2, Sun, Snowflake, Plane, Car, Train, Ship, Footprints, CalendarDays } from "lucide-react";
import { Trip as LocalTrip } from "@/lib/storage";
import { useSettings, formatDistanceKm, formatAltitudeM, formatTemperatureC } from "@/lib/settings";

interface Props {
  trips: LocalTrip[];
}

const EARTH_CIRCUMFERENCE_KM = 40075;
const DISTANCE_TO_MOON_KM = 384400;

export function TravelHighlights({ trips }: Props) {
  const { distanceUnit, temperatureUnit } = useSettings();

  const highest = useMemo(
    () => trips.filter(t => t.altitude_m != null).sort((a, b) => (b.altitude_m! - a.altitude_m!))[0],
    [trips]
  );
  const farthest = useMemo(
    () => trips
      .filter(t => (t.max_distance_from_home_km ?? t.distance_from_home_km) != null)
      .sort((a, b) =>
        (b.max_distance_from_home_km ?? b.distance_from_home_km!) -
        (a.max_distance_from_home_km ?? a.distance_from_home_km!)
      )[0],
    [trips]
  );
  const totalDays = useMemo(
    () => trips.reduce((s, t) => {
      if (!t.date_end || t.date_end === t.trip_date) return s + 1;
      const d = Math.round((new Date(t.date_end).getTime() - new Date(t.trip_date).getTime()) / 86400000);
      return s + Math.max(1, d);
    }, 0),
    [trips]
  );
  const hottest = useMemo(
    () => trips.filter(t => t.temperature_c != null).sort((a, b) => (b.temperature_c! - a.temperature_c!))[0],
    [trips]
  );
  const coldest = useMemo(
    () => trips.filter(t => t.temperature_c != null).sort((a, b) => (a.temperature_c! - b.temperature_c!))[0],
    [trips]
  );
  const totalKm = useMemo(
    () => trips.reduce((sum, t) => sum + (t.distance_from_home_km ?? 0), 0),
    [trips]
  );
  const aroundWorld = totalKm / EARTH_CIRCUMFERENCE_KM;
  const toMoon = totalKm / DISTANCE_TO_MOON_KM;
  const byMode = useMemo(() => {
    const acc = { plane:0, train:0, car:0, ship:0, walk:0 };
    for (const t of trips) {
      const d = t.distance_from_home_km ?? 0;
      const mode = t.transport_mode ?? (d > 1000 ? "plane" : d >= 200 ? "train" : d >= 20 ? "car" : "walk");
      acc[mode] = (acc[mode] ?? 0) + d;
    }
    return acc;
  }, [trips]);
  const byPlane = byMode.plane;
  const byTrain = byMode.train;
  const byCar   = byMode.car;
  const byShip  = byMode.ship;
  const byWalk  = byMode.walk;
  const byRoad  = byCar;

  type HlItem = { label: string; value: string; sub?: string; color: string; bg: string; Icon: React.ElementType; angle: number };
  const hlItems: HlItem[] = [
    { label:"Altitudine più alta",  value: highest ? formatAltitudeM(highest.altitude_m, distanceUnit) : "—",      sub: highest?.city,                                                color:"#34d399", bg:"rgba(52,211,153,0.12)",  Icon:Mountain,    angle:-90 },
    { label:"Più distante da casa", value: farthest ? formatDistanceKm(farthest.max_distance_from_home_km ?? farthest.distance_from_home_km, distanceUnit) : "—", sub: farthest?.max_distance_city ?? farthest?.city, color:"#f472b6", bg:"rgba(244,114,182,0.12)", Icon:Globe2, angle:-18 },
    { label:"Il posto più caldo",   value: hottest  ? formatTemperatureC(hottest.temperature_c, temperatureUnit) : "—", sub: hottest?.city,  color:"#fb7185", bg:"rgba(251,113,133,0.12)", Icon:Sun,         angle:54  },
    { label:"Giorni in viaggio",    value: String(totalDays), sub: trips.length > 0 ? ("in " + trips.length + (trips.length === 1 ? " viaggio" : " viaggi")) : undefined, color:"#fbbf24", bg:"rgba(251,191,36,0.12)",  Icon:CalendarDays, angle:126 },
    { label:"Il posto più freddo",  value: coldest  ? formatTemperatureC(coldest.temperature_c, temperatureUnit) : "—",  sub: coldest?.city,  color:"#93c5fd", bg:"rgba(147,197,253,0.12)", Icon:Snowflake,   angle:198 },
  ];

  return (
    <div className="space-y-6 animate-fade-up">

      {/* Circular highlights */}
      <div style={{position:"relative",width:"100%",display:"flex",justifyContent:"center",alignItems:"center",minHeight:420}}>
        <svg style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)"}} width="500" height="420" viewBox="0 0 500 420">
          <circle cx="250" cy="210" r="140" fill="none" stroke="#1a2d4a" strokeWidth={1} strokeDasharray="5 4"/>
        </svg>
        {hlItems.map(({ label, value, sub, color, bg, Icon, angle }) => {
          const rad = (angle * Math.PI) / 180;
          const px = 250 + 140 * Math.cos(rad);
          const py = 210 + 140 * Math.sin(rad);
          return (
            <div key={label} style={{
              position:"absolute",
              left:"calc(50% + "+(px-250)+"px)",
              top:py,
              transform:"translate(-50%,-50%)",
              width:120,
              background:"#0a1628",
              border:"0.5px solid "+color,
              borderRadius:12,
              padding:"10px 12px",
              display:"flex",
              flexDirection:"column",
              alignItems:"center",
              textAlign:"center",
              gap:4,
            }}>
              <div style={{width:32,height:32,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {React.createElement(Icon, {style:{width:16,height:16,color:color}})}
              </div>
              <div style={{fontSize:14,fontWeight:700,color:"#f0f4ff",lineHeight:1.1}}>{value}</div>
              <div style={{fontSize:9,letterSpacing:"1px",textTransform:"uppercase",color:"rgba(255,255,255,0.3)"}}>{label}</div>
              {sub && <div style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>{sub}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
