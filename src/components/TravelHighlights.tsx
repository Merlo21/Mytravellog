// [FROZEN] — Non modificare senza esplicita richiesta
import { useMemo, useRef } from "react";
import React from "react";
import { Mountain, Globe2, Sun, Snowflake, Moon, Plane, Car, Train, Ship, Footprints, Bike, ChevronLeft, ChevronRight } from "lucide-react";
import { Motorcycle } from "@/components/icons/Motorcycle";
import { Trip as LocalTrip } from "@/lib/storage";
import { useSettings, formatDistanceKm, formatAltitudeM, formatTemperatureC } from "@/lib/settings";
import { tripTotalKm, buildFlightPath, buildFlightLegs, pathLengthKm } from "@/lib/flyover";

interface Props {
  trips: LocalTrip[];
}

const EARTH_CIRCUMFERENCE_KM = 40075;
const DISTANCE_TO_MOON_KM = 384400;

type TransportMode = "plane" | "train" | "car" | "ship" | "walk" | "bici" | "moto";
type KmByMode = Record<TransportMode, number>;

function guessMode(km: number): TransportMode {
  return km > 1000 ? "plane" : km >= 200 ? "train" : km >= 20 ? "car" : "walk";
}

/**
 * A trip's transport_mode/waypoints[].transport_mode each describe the leg
 * ARRIVING at that stop, not the whole trip — a multi-stop trip can mix
 * modes (e.g. train home->A, plane A->B). Walk the real stop sequence
 * (home -> waypoints -> destination) and attribute each segment's distance
 * to its own arrival mode, instead of dumping the trip's total distance
 * onto a single mode.
 *
 * Usa le STESSE tratte di `tripTotalKm` (buildFlightLegs → pathCoords): la
 * distanza di ogni tratta segue la STRADA reale dove disponibile
 * (route_geometry per auto/bici/moto), altrimenti la linea d'aria. Così la
 * somma del breakdown coincide sempre col totale mostrato in alto — prima il
 * totale era stradale ma il breakdown restava in linea d'aria, e non tornavano.
 */
export function computeKmByTransportMode(trips: LocalTrip[]): KmByMode {
  const acc: KmByMode = { plane: 0, train: 0, car: 0, ship: 0, walk: 0, bici: 0, moto: 0 };
  for (const t of trips) {
    const legs = buildFlightLegs(buildFlightPath([t]));
    for (const leg of legs) {
      const km = pathLengthKm(leg.pathCoords);
      const mode = (leg.to.transportMode as TransportMode | null) ?? guessMode(km);
      acc[mode] += km;
    }
  }
  return acc;
}

export function TravelHighlights({ trips }: Props) {
  const { distanceUnit, temperatureUnit } = useSettings();
  const transportScrollRef = useRef<HTMLDivElement>(null);
  const scrollTransportBy = (dir: 1 | -1) => {
    transportScrollRef.current?.scrollBy({ left: dir * 140, behavior: "smooth" });
  };

  const highest = useMemo(
    () => trips
      .filter(t => (t.max_altitude_m ?? t.altitude_m) != null)
      .sort((a, b) => (b.max_altitude_m ?? b.altitude_m!) - (a.max_altitude_m ?? a.altitude_m!))[0],
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
  const hottest = useMemo(
    () => trips
      .filter(t => (t.hottest_temp_c ?? t.temperature_c) != null)
      .sort((a, b) => (b.hottest_temp_c ?? b.temperature_c!) - (a.hottest_temp_c ?? a.temperature_c!))[0],
    [trips]
  );
  const coldest = useMemo(
    () => trips
      .filter(t => (t.coldest_temp_c ?? t.temperature_c) != null)
      .sort((a, b) => (a.coldest_temp_c ?? a.temperature_c!) - (b.coldest_temp_c ?? b.temperature_c!))[0],
    [trips]
  );
  // Km percorsi: stradali reali dove disponibile (tripTotalKm), coerente con
  // Home/card/poster. (Il "più distante da casa" qui sotto resta invece la
  // distanza max in linea d'aria — è un'altra metrica.)
  const totalKm = useMemo(
    () => trips.reduce((sum, t) => sum + tripTotalKm(t), 0),
    [trips]
  );
  const aroundWorld = totalKm / EARTH_CIRCUMFERENCE_KM;
  const toMoon = totalKm / DISTANCE_TO_MOON_KM;
  const byMode = useMemo(() => computeKmByTransportMode(trips), [trips]);
  const byPlane = byMode.plane;
  const byTrain = byMode.train;
  const byCar   = byMode.car;
  const byShip  = byMode.ship;
  const byWalk  = byMode.walk;
  const byBici  = byMode.bici;
  const byMoto  = byMode.moto;
  const byRoad  = byCar;

  return (
    <div className="space-y-6 animate-fade-up">

      {/* A differenza delle altre sezioni della pagina Statistiche (che hanno
          già un proprio h2 interno, es. "Distanze" più sotto), la griglia di
          card qui sotto non aveva alcun titolo. Stesso stile delle altre. */}
      <h2 className="text-lg font-bold">Highlights di viaggio</h2>

      {/* Highlights grid — "Giorni in viaggio" è ora nella sezione Anni e mesi
          di viaggio, insieme a "giorni senza viaggiare" (metrica complementare) */}
      {(() => {
        type HlItem = { label: string; value: string; sub?: string; color: string; Icon: React.ElementType };
        const items: HlItem[] = [
          { label:"Altitudine più alta",  value: highest ? formatAltitudeM(highest.max_altitude_m ?? highest.altitude_m, distanceUnit) : "—",      sub: highest?.max_altitude_city ?? highest?.city,                                                color:"#34d399", Icon:Mountain    },
          { label:"Più distante da casa", value: farthest ? formatDistanceKm(farthest.max_distance_from_home_km ?? farthest.distance_from_home_km, distanceUnit) : "—", sub: farthest?.max_distance_city ?? farthest?.city, color:"#f472b6", Icon:Globe2 },
          { label:"Il posto più caldo",   value: hottest  ? formatTemperatureC(hottest.hottest_temp_c ?? hottest.temperature_c, temperatureUnit) : "—", sub: hottest?.hottest_city ?? hottest?.city,  color:"#fb7185", Icon:Sun      },
          { label:"Il posto più freddo",  value: coldest  ? formatTemperatureC(coldest.coldest_temp_c ?? coldest.temperature_c, temperatureUnit) : "—",  sub: coldest?.coldest_city ?? coldest?.city,  color:"#93c5fd", Icon:Snowflake },
        ];
        // Icona grande "illustrata" invece del badge circolare piccolo (spunto
        // preso da un'app concorrente, poi estesa anche al desktop su richiesta
        // di Stefano — è pura estetica, non una soluzione "di spazio" come il
        // carosello o il menu hamburger, quindi ha senso unificarla ovunque.
        const Card = ({ item }: { item: HlItem }) => (
          <div style={{background:"#0a1628",border:"0.5px solid #1a2d4a",borderRadius:14,padding:"18px 10px",display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",gap:4}}>
            <item.Icon style={{width:30,height:30,color:item.color,strokeWidth:1.6}}/>
            <div className="font-mono" style={{fontSize:19,fontWeight:800,color:"#f0f4ff",marginTop:4}}>{item.value}</div>
            <div style={{fontSize:10,letterSpacing:"0.5px",textTransform:"uppercase",fontWeight:700,color:item.color}}>{item.label}</div>
            {item.sub && <div style={{fontSize:11,color:"rgba(255,255,255,0.45)"}}>{item.sub}</div>}
          </div>
        );
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {items.map(item => <Card key={item.label} item={item}/>)}
          </div>
        );
      })()}

      <div className="mt-6 glass-card p-6">
        <h2 className="text-lg font-bold mb-4">Distanze</h2>

        {/* Hero row — desktop invariato */}
        <div className="hidden sm:flex items-center justify-between gap-4 pb-5 border-b border-border mb-5 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:"rgba(55,138,221,0.12)"}}>
              <Globe2 className="w-5 h-5" style={{color:"#378ADD"}} strokeWidth={1.5}/>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono">{formatDistanceKm(totalKm, distanceUnit)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">chilometri percorsi in totale</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:"rgba(99,153,34,0.12)"}}>
              <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" stroke="#639922" strokeWidth="1.5"/>
                <ellipse cx="11" cy="11" rx="3.5" ry="6.5" stroke="#639922" strokeWidth="1.2"/>
                <line x1="4.5" y1="11" x2="17.5" y2="11" stroke="#639922" strokeWidth="1.2"/>
                <path d="M6.5 7Q11 9 15.5 7" stroke="#639922" strokeWidth="1" fill="none"/>
                <path d="M6.5 15Q11 13 15.5 15" stroke="#639922" strokeWidth="1" fill="none"/>
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono">{aroundWorld.toFixed(3).replace(".",",")}×</div>
              <div className="text-xs text-muted-foreground mt-0.5">intorno al mondo</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:"rgba(127,119,221,0.12)"}}>
              <Moon className="w-5 h-5" style={{color:"#7F77DD"}} strokeWidth={1.5}/>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono">{toMoon.toFixed(3).replace(".",",")}×</div>
              <div className="text-xs text-muted-foreground mt-0.5">alla luna</div>
            </div>
          </div>
        </div>

        {/* Hero row — mobile: km totali come "momento hero" con icona grande
            (spunto preso da un'app concorrente), intorno-al-mondo/alla-luna
            restano compatte ma affiancate 2x2 sotto, con etichetta sempre
            visibile visto che ora c'è spazio a sufficienza. */}
        <div className="sm:hidden pb-5 border-b border-border mb-5">
          <div className="flex flex-col items-center text-center gap-1.5 mb-4">
            <div style={{width:76,height:76,borderRadius:"50%",border:"2px dashed #378ADD",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Globe2 style={{width:32,height:32,color:"#378ADD"}} strokeWidth={1.5}/>
            </div>
            <div className="text-2xl font-bold font-mono mt-1">{formatDistanceKm(totalKm, distanceUnit)}</div>
            <div className="text-xs text-muted-foreground">chilometri percorsi in totale</div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col items-center text-center gap-1.5 rounded-xl py-3" style={{background:"rgba(99,153,34,0.08)"}}>
              <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" stroke="#639922" strokeWidth="1.5"/>
                <ellipse cx="11" cy="11" rx="3.5" ry="6.5" stroke="#639922" strokeWidth="1.2"/>
                <line x1="4.5" y1="11" x2="17.5" y2="11" stroke="#639922" strokeWidth="1.2"/>
                <path d="M6.5 7Q11 9 15.5 7" stroke="#639922" strokeWidth="1" fill="none"/>
                <path d="M6.5 15Q11 13 15.5 15" stroke="#639922" strokeWidth="1" fill="none"/>
              </svg>
              <div className="text-lg font-bold font-mono">{aroundWorld.toFixed(3).replace(".",",")}×</div>
              <div className="text-[11px] text-muted-foreground">intorno al mondo</div>
            </div>
            <div className="flex flex-col items-center text-center gap-1.5 rounded-xl py-3" style={{background:"rgba(127,119,221,0.08)"}}>
              <Moon className="w-5 h-5" style={{color:"#7F77DD"}} strokeWidth={1.5}/>
              <div className="text-lg font-bold font-mono">{toMoon.toFixed(3).replace(".",",")}×</div>
              <div className="text-[11px] text-muted-foreground">alla luna</div>
            </div>
          </div>
        </div>

        {/* 5 mezzi di trasporto — i non usati (0 km) sono attenuati per far
            risaltare solo quelli effettivamente usati nei viaggi. */}
        {(() => {
          const transportItems = ([
            { icon: <Plane strokeWidth={1.5}/>,      color:"#378ADD", bg:"rgba(55,138,221,0.12)",  border:"rgba(55,138,221,0.3)",  km: byPlane, val: formatDistanceKm(byPlane, distanceUnit), label:"In aereo" },
            { icon: <Train strokeWidth={1.5}/>,      color:"#BA7517", bg:"rgba(186,117,23,0.12)",  border:"rgba(186,117,23,0.3)",  km: byTrain, val: formatDistanceKm(byTrain, distanceUnit), label:"In treno" },
            { icon: <Car strokeWidth={1.5}/>,        color:"#A855F7", bg:"rgba(168,85,247,0.12)",  border:"rgba(168,85,247,0.3)",  km: byCar,   val: formatDistanceKm(byCar,   distanceUnit), label:"In auto"  },
            { icon: <Ship strokeWidth={1.5}/>,       color:"#0F6E56", bg:"rgba(15,110,86,0.12)",   border:"rgba(15,110,86,0.3)",   km: byShip,  val: formatDistanceKm(byShip,  distanceUnit), label:"In nave"  },
            { icon: <Footprints strokeWidth={1.5}/>, color:"#D85A30", bg:"rgba(216,90,48,0.12)",   border:"rgba(216,90,48,0.3)",   km: byWalk,  val: formatDistanceKm(byWalk,  distanceUnit), label:"A piedi"  },
            { icon: <Bike strokeWidth={1.5}/>,       color:"#22C55E", bg:"rgba(34,197,94,0.12)",   border:"rgba(34,197,94,0.3)",   km: byBici,  val: formatDistanceKm(byBici,  distanceUnit), label:"In bici"  },
            { icon: <Motorcycle strokeWidth={1.5}/>, color:"#EAB308", bg:"rgba(234,179,8,0.12)",   border:"rgba(234,179,8,0.3)",   km: byMoto,  val: formatDistanceKm(byMoto,  distanceUnit), label:"In moto"  },
          ] as const);
          return (
            <>
              {/* Desktop — layout in riga invariato (ora 7 colonne), icona senza
                  badge come da mobile (pura estetica, richiesta espressamente
                  da Stefano). */}
              <div className="hidden sm:grid grid-cols-7 gap-2 mb-4">
                {transportItems.map(({ icon, color, bg, border, km, val, label }) => {
                  const used = km > 0;
                  return (
                    <div key={label} className="flex items-center gap-2.5 rounded-xl px-3 py-3 border hover:-translate-y-0.5 transition-transform"
                      style={used ? {background:bg, borderColor:border} : {background:"rgba(255,255,255,0.02)", borderColor:"rgba(255,255,255,0.06)"}}>
                      <span style={{color: used ? color : "rgba(255,255,255,0.2)", flexShrink: 0}}>{React.cloneElement(icon, { style: { width: 26, height: 26 } })}</span>
                      <div>
                        <div className="text-lg font-extrabold font-mono leading-none" style={{color: used ? color : "rgba(255,255,255,0.25)"}}>{val}</div>
                        <div className="text-[11px] mt-1" style={{color: used ? undefined : "rgba(255,255,255,0.2)"}}>{label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile — carosello orizzontale con freccine, icona grande senza
                  badge (stesso spunto grafico delle highlights card, e delle
                  freccine visibili ◀▶ prese da un'app concorrente per rendere
                  lo scroll orizzontale scopribile invece che "alla cieca"). */}
              <div className="sm:hidden relative mb-4">
                <button type="button" onClick={() => scrollTransportBy(-1)} aria-label="Scorri a sinistra"
                  className="absolute left-0 top-1/2 z-10 flex items-center justify-center"
                  style={{ transform: "translateY(-50%)", width: 26, height: 26, borderRadius: "50%", background: "rgba(10,22,40,0.92)", border: "1px solid #1a2d4a" }}>
                  <ChevronLeft className="w-3.5 h-3.5"/>
                </button>
                <div ref={transportScrollRef} className="flex gap-2.5 overflow-x-auto" style={{ scrollbarWidth: "none", paddingLeft: 32, paddingRight: 32 }}>
                  {transportItems.map(({ icon, color, km, val, label }) => {
                    const used = km > 0;
                    return (
                      <div key={label} className="flex-shrink-0 flex flex-col items-center justify-center gap-1.5 rounded-xl border"
                        style={{ width: 92, padding: "14px 8px", background: "#0a1628", borderColor: "#1a2d4a" }}>
                        <span style={{color: used ? color : "rgba(255,255,255,0.2)"}}>{React.cloneElement(icon, { style: { width: 26, height: 26 } })}</span>
                        <div className="text-sm font-extrabold font-mono" style={{color: used ? color : "rgba(255,255,255,0.25)"}}>{val}</div>
                        <div style={{fontSize:10,letterSpacing:"0.3px",textTransform:"uppercase",fontWeight:700,textAlign:"center",color: used ? color : "rgba(255,255,255,0.2)"}}>{label}</div>
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={() => scrollTransportBy(1)} aria-label="Scorri a destra"
                  className="absolute right-0 top-1/2 z-10 flex items-center justify-center"
                  style={{ transform: "translateY(-50%)", width: 26, height: 26, borderRadius: "50%", background: "rgba(10,22,40,0.92)", border: "1px solid #1a2d4a" }}>
                  <ChevronRight className="w-3.5 h-3.5"/>
                </button>
              </div>
            </>
          );
        })()}

        {/* Proportional bar */}
        <div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground mb-1.5">
            {([
              {color:"#378ADD", label:"Aereo", pct:byPlane},
              {color:"#BA7517", label:"Treno", pct:byTrain},
              {color:"#A855F7", label:"Auto",  pct:byCar},
              {color:"#0F6E56", label:"Nave",  pct:byShip},
              {color:"#D85A30", label:"Piedi", pct:byWalk},
              {color:"#22C55E", label:"Bici",  pct:byBici},
              {color:"#EAB308", label:"Moto",  pct:byMoto},
            ] as const).map(x => (
              <span key={x.label} className={"flex items-center gap-1 " + (x.pct > 0 ? "opacity-100" : "opacity-30")}>
                <span className="w-2 h-2 rounded-full inline-block" style={{background:x.color}}/>
                {x.label}
              </span>
            ))}
          </div>
          <div className="h-2 rounded-full overflow-hidden flex bg-muted">
            {totalKm > 0 ? ([
              {color:"#378ADD", w:byPlane, k:0},
              {color:"#BA7517", w:byTrain, k:1},
              {color:"#A855F7", w:byCar,   k:2},
              {color:"#0F6E56", w:byShip,  k:3},
              {color:"#D85A30", w:byWalk,  k:4},
              {color:"#22C55E", w:byBici,  k:5},
              {color:"#EAB308", w:byMoto,  k:6},
            ] as const).map(x => (
              <div key={x.k} className="h-full transition-all duration-700" style={{flexGrow:x.w, background:x.color}}/>
            )) : <div className="h-full w-full rounded-full bg-muted"/>}
          </div>
        </div>
      </div>
    </div>
  );
}


