import { useMemo } from "react";
import { Mountain, Globe2, Sun, Snowflake, Moon, Plane, Car, Train, Ship, Footprints } from "lucide-react";
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
    () => trips.filter(t => t.distance_from_home_km != null).sort((a, b) => (b.distance_from_home_km! - a.distance_from_home_km!))[0],
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

  // Use actual transport_mode if set, otherwise estimate by distance
  const byMode = useMemo(() => {
    const acc = { plane:0, train:0, car:0, ship:0, walk:0 };
    for (const t of trips) {
      const d = t.distance_from_home_km ?? 0;
      const mode = t.transport_mode ?? (d > 1000 ? "plane" : d >= 200 ? "train" : d >= 20 ? "car" : "walk");
      acc[mode] = (acc[mode] ?? 0) + d;
      // Add waypoints distances (approximate)
      for (const wp of t.waypoints ?? []) {
        acc[wp.transport_mode] = (acc[wp.transport_mode] ?? 0) + d * 0.3;
      }
    }
    return acc;
  }, [trips]);
  const byPlane = byMode.plane;
  const byTrain = byMode.train;
  const byCar   = byMode.car;
  const byShip  = byMode.ship;
  const byWalk  = byMode.walk;
  const byRoad  = byCar;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <HighlightCard
          icon={<Mountain className="w-12 h-12" strokeWidth={1.5} />}
          color="text-emerald-500"
          label="Altitudine più alta"
          value={highest ? formatAltitudeM(highest.altitude_m, distanceUnit) : "—"}
          sub={highest?.city}
        />
        <HighlightCard
          icon={<Globe2 className="w-12 h-12" strokeWidth={1.5} />}
          color="text-pink-500"
          label="Più distante da casa"
          value={farthest ? formatDistanceKm(farthest.distance_from_home_km, distanceUnit) : "—"}
          sub={farthest?.city}
        />
        <HighlightCard
          icon={<Sun className="w-12 h-12" strokeWidth={1.5} />}
          color="text-orange-500"
          label="Il posto più caldo"
          value={hottest ? formatTemperatureC(hottest.temperature_c, temperatureUnit) : "—"}
          sub={hottest?.city}
        />
        <HighlightCard
          icon={<Snowflake className="w-12 h-12" strokeWidth={1.5} />}
          color="text-sky-500"
          label="Il posto più freddo"
          value={coldest ? formatTemperatureC(coldest.temperature_c, temperatureUnit) : "—"}
          sub={coldest?.city}
        />
      </div>

      <div className="glass-card p-6">
        <h2 className="text-lg font-bold mb-4">Distanze</h2>

        {/* Hero row: total km + globe/moon mini cards */}
        <div className="flex items-center justify-between gap-3 pb-5 border-b border-border mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:"rgba(55,138,221,0.12)"}}>
              <Globe2 className="w-6 h-6" style={{color:"#378ADD"}} strokeWidth={1.5}/>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono">{formatDistanceKm(totalKm, distanceUnit)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">chilometri percorsi in totale</div>
            </div>
          </div>
          <div className="flex gap-2">
            {/* Intorno al mondo — globe with meridians + orbit arrow */}
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 border transition-transform hover:-translate-y-0.5"
              style={{background:"rgba(99,153,34,0.08)", borderColor:"rgba(99,153,34,0.3)"}}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" stroke="#639922" strokeWidth="1.5"/>
                <path d="M4.5 11 Q11 4.5 17.5 11 Q11 17.5 4.5 11Z" stroke="#639922" strokeWidth="1.2" fill="none"/>
                <path d="M11 4.5 V17.5" stroke="#639922" strokeWidth="1.2"/>
                <path d="M18 8 A8 8 0 0 0 18 14" stroke="#639922" strokeWidth="1.8" strokeLinecap="round"/>
                <polyline points="16.5,6.5 18,8 19.5,6.5" fill="#639922"/>
              </svg>
              <div>
                <div className="text-sm font-bold font-mono" style={{color:"#639922"}}>{aroundWorld.toFixed(2).replace(".",",")}×</div>
                <div className="text-[10px] text-muted-foreground">Intorno al mondo</div>
              </div>
            </div>
            {/* Alla luna */}
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 border transition-transform hover:-translate-y-0.5"
              style={{background:"rgba(127,119,221,0.08)", borderColor:"rgba(127,119,221,0.3)"}}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:"rgba(127,119,221,0.12)"}}>
                <Moon className="w-4 h-4" style={{color:"#7F77DD"}} strokeWidth={1.5}/>
              </div>
              <div>
                <div className="text-sm font-bold font-mono" style={{color:"#7F77DD"}}>{toMoon.toFixed(3).replace(".",",")}×</div>
                <div className="text-[10px] text-muted-foreground">Alla luna</div>
              </div>
            </div>
          </div>
        </div>

        {/* 3 transport cards */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          {[
            { icon: <Plane className="w-5 h-5" strokeWidth={1.5}/>,      color: "#378ADD", bg: "rgba(55,138,221,0.12)", border: "rgba(55,138,221,0.3)", val: formatDistanceKm(byPlane, distanceUnit), label: "In aereo" },
            { icon: <Train className="w-5 h-5" strokeWidth={1.5}/>,      color: "#BA7517", bg: "rgba(186,117,23,0.12)", border: "rgba(186,117,23,0.3)", val: formatDistanceKm(byTrain, distanceUnit), label: "In treno" },
            { icon: <Car className="w-5 h-5" strokeWidth={1.5}/>,        color: "#639922", bg: "rgba(99,153,34,0.12)", border: "rgba(99,153,34,0.3)",  val: formatDistanceKm(byCar,   distanceUnit), label: "In auto" },
            { icon: <Ship className="w-5 h-5" strokeWidth={1.5}/>,       color: "#0F6E56", bg: "rgba(15,110,86,0.12)", border: "rgba(15,110,86,0.3)",  val: formatDistanceKm(byShip,  distanceUnit), label: "In nave" },
            { icon: <Footprints className="w-5 h-5" strokeWidth={1.5}/>, color: "#D85A30", bg: "rgba(216,90,48,0.12)", border: "rgba(216,90,48,0.3)",  val: formatDistanceKm(byWalk,  distanceUnit), label: "A piedi" },
          ].map(({ icon, color, bg, border, val, label }) => (
            <div key={label} className="flex items-center gap-2.5 rounded-xl px-3 py-3 border transition-transform hover:-translate-y-0.5"
              style={{background: bg.replace("0.12","0.08"), borderColor: border}}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{background: bg}}>
                <span style={{color}}>{icon}</span>
              </div>
              <div>
                <div className="text-sm font-bold font-mono" style={{color}}>{val}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Proportional bar */}
        {totalKm > 0 && (
          <div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground mb-1.5">
              {[
                {color:"#378ADD",label:"Aereo",  pct:byPlane},
                {color:"#BA7517",label:"Treno",  pct:byTrain},
                {color:"#639922",label:"Auto",   pct:byCar},
                {color:"#0F6E56",label:"Nave",   pct:byShip},
                {color:"#D85A30",label:"Piedi",  pct:byWalk},
              ].filter(x=>x.pct>0).map(x=>(
                <span key={x.label} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{background:x.color}}/>
                  {x.label} {Math.round(x.pct/totalKm*100)}%
                </span>
              ))}
            </div>
            <div className="h-1.5 rounded-full overflow-hidden flex bg-muted">
              {[
                {color:"#378ADD",pct:byPlane},
                {color:"#BA7517",pct:byTrain},
                {color:"#639922",pct:byCar},
                {color:"#0F6E56",pct:byShip},
                {color:"#D85A30",pct:byWalk},
              ].map((x,i)=>(
                <div key={i} className="h-full transition-all duration-700" style={{width:`${x.pct/totalKm*100}%`, background:x.color}}/>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}