// [FROZEN] — Non modificare senza esplicita richiesta
import { AppHeader } from "@/components/AppHeader";
import { useEffect, useMemo, useState, Component, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loadTrips, updateTrip, formatTripDate, Trip } from "@/lib/storage";
import { distanceKm } from "@/lib/geo";
import { fmtDistance, useSettings } from "@/lib/settings";
import { Compass, Globe, MapPin, Pencil, Plane, PieChart, Plus, Search, Settings, Video, X, ChevronDown } from "lucide-react";
import { WorldMap, CityInfo } from "@/components/WorldMap";
import { StarField } from "@/components/StarField";
import { TripFlyover } from "@/components/TripFlyover";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

// Stessa palette per-mezzo di TripCardTicket/WorldMap/TripFlyover.
const TRANSPORT_BADGE: Record<string, { color: string; label: string }> = {
  plane: { color: "#378ADD", label: "Aereo" },
  train: { color: "#BA7517", label: "Treno" },
  car:   { color: "#A855F7", label: "Auto" },
  ship:  { color: "#0F6E56", label: "Nave" },
  walk:  { color: "#D85A30", label: "A piedi" },
  bici:  { color: "#22C55E", label: "Bici" },
  moto:  { color: "#EAB308", label: "Moto" },
};

/**
 * Ogni viaggio tocca anche i paesi/città delle tappe intermedie (waypoint),
 * non solo la destinazione finale (stessa logica di StatsSection.tsx).
 */
export function computeHomeStats(trips: Trip[]) {
  const countries = new Set<string>();
  const cities = new Set<string>();
  for (const t of trips) {
    countries.add(t.country_code || t.country);
    cities.add(`${t.city}|${t.country}`);
    for (const w of t.waypoints ?? []) {
      countries.add(w.country_code || w.country);
      cities.add(`${w.city}|${w.country}`);
    }
  }
  const km = trips.reduce((s, t) => s + (t.distance_from_home_km ?? 0), 0);
  const days = trips.reduce((s, t) => {
    if (!t.date_end || t.date_end === t.trip_date) return s + 1;
    const d = Math.round((new Date(t.date_end).getTime() - new Date(t.trip_date).getTime()) / 86400000);
    return s + Math.max(1, d);
  }, 0);
  return { trips: trips.length, countries: countries.size, cities: cities.size, km, days };
}

/**
 * Ricalcola la distanza da casa di un viaggio percorrendo home → tappa1 →
 * tappa2 → ... → destinazione (non la linea retta home→destinazione, che
 * ignorerebbe le tappe intermedie). Usata per il backfill dei viaggi creati
 * prima che la città di residenza fosse impostata nelle Impostazioni.
 */
export function backfillDistanceFromHome(trip: Trip, homeCity: { lat: number; lon: number }) {
  const waypointStops = (trip.waypoints ?? [])
    .filter(w => w.lat != null && w.lon != null)
    .map(w => ({ lat: w.lat as number, lon: w.lon as number, city: w.city }));
  const allStops = [...waypointStops, { lat: trip.latitude, lon: trip.longitude, city: trip.city }];
  let dist = 0;
  let prev = { lat: homeCity.lat, lon: homeCity.lon };
  for (const stop of allStops) {
    dist += distanceKm(prev.lat, prev.lon, stop.lat, stop.lon);
    prev = stop;
  }
  const distances = allStops.map(p => ({ city: p.city, d: distanceKm(homeCity.lat, homeCity.lon, p.lat, p.lon) }));
  const max = distances.reduce((a, b) => (b.d > a.d ? b : a));
  return {
    distance_from_home_km: dist,
    max_distance_from_home_km: trip.max_distance_from_home_km ?? max.d,
    max_distance_city: trip.max_distance_city ?? max.city,
  };
}

class ErrorBoundary extends Component<{children:ReactNode},{error:string|null}> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message + "\n" + e.stack }; }
  render() {
    if (this.state.error) return (
      <div style={{padding:20,color:'#f87171',background:'#1a0a0a',minHeight:'100vh',fontFamily:'monospace',whiteSpace:'pre-wrap',fontSize:12}}>
        <h2>Runtime Error:</h2>{this.state.error}
      </div>
    );
    return this.props.children;
  }
}



function HomeInner() {
  const navigate = useNavigate();
  const { distanceUnit, autoRotate, homeCity } = useSettings();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);


  const [selectedCity, setSelectedCity] = useState<CityInfo | null>(null);
  const [starOffset, setStarOffset] = useState({ x: 0, y: 0 });
  const [starMouse, setStarMouse] = useState<{x:number;y:number}|null>(null);
  // Solo su mobile le 4 card sono a comparsa (chiuse di default, per non
  // occupare spazio sopra il globo) — da desktop restano sempre visibili,
  // vedi il rendering "hidden sm:grid" più sotto.
  const [statsOpen, setStatsOpen] = useState(false);
  // Clean up legacy visited cities data
  useEffect(() => { localStorage.removeItem("atlas.visited.v1"); }, []);
  const refresh = () => setTrips(loadTrips());
  useEffect(() => { refresh(); }, []);

  // Ricalcola distanze per viaggi senza distance_from_home_km quando homeCity è impostata
  useEffect(() => {
    if (!homeCity) return;
    const allTrips = loadTrips();
    let changed = false;
    allTrips.forEach(t => {
      if (t.latitude && t.longitude && !isNaN(t.latitude) && !isNaN(t.longitude) &&
          (t.distance_from_home_km == null || t.distance_from_home_km === 0)) {
        updateTrip(t.id, backfillDistanceFromHome(t, homeCity));
        changed = true;
      }
    });
    if (changed) refresh();
  }, [homeCity]);

  const stats = useMemo(() => computeHomeStats(trips), [trips]);

  // Viaggio selezionato toccando un pallino sul globo: prima evidenziava solo
  // la rotta, senza mostrare alcuna informazione né un modo per aprirlo.
  const selectedTrip = useMemo(() => trips.find(t => t.id === selectedId) ?? null, [trips, selectedId]);
  const [flyoverTrip, setFlyoverTrip] = useState<Trip | null>(null);

  const defaultHome = trips[0]
    ? { lat: trips[0].home_latitude, lon: trips[0].home_longitude, label: trips[0].home_label }
    : null;

  return (
    <main className="h-screen flex flex-col" style={{backgroundColor:"#060e1e"}}>
      <AppHeader/>

      <div className="container mx-auto px-4 py-6 flex-1 flex flex-col gap-6">
        {(() => {
          const statItems = [
            { icon: <Plane       className="w-[18px] h-[18px]"/>, label: "Viaggi",   value: stats.trips.toString(),     accent: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
            { icon: <Globe       className="w-[18px] h-[18px]"/>, label: "Paesi",    value: stats.countries.toString(), accent: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
            { icon: <MapPin      className="w-[18px] h-[18px]"/>, label: "Città",    value: stats.cities.toString(),    accent: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
            { icon: <Compass     className="w-[18px] h-[18px]"/>, label: distanceUnit === "imperial" ? "Miglia" : "Km totali", value: fmtDistance(stats.km, distanceUnit), accent: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
          ];
          const StatCard = ({ icon, label, value, accent, bg }: typeof statItems[number]) => (
            <div key={label} style={{
              background:"#0a1628", border:"0.5px solid #1a2d4a", borderRadius:12,
              padding:"14px 16px", display:"flex", alignItems:"center", gap:12,
              position:"relative", overflow:"hidden",
            }}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:accent,borderRadius:"12px 12px 0 0"}}/>
              <div style={{width:36,height:36,borderRadius:9,background:bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{color:accent}}>{icon}</span>
              </div>
              <div>
                <div style={{fontSize:20,fontWeight:700,color:"#f0f4ff",lineHeight:1.1}}>{value}</div>
                <div style={{fontSize:10,letterSpacing:"1.2px",textTransform:"uppercase",color:"rgba(255,255,255,0.35)",marginTop:3}}>{label}</div>
              </div>
            </div>
          );
          return (
            <>
              {/* Desktop: sempre visibili, struttura invariata */}
              <div className="hidden sm:grid grid-cols-4 gap-2.5">
                {statItems.map(item => <StatCard key={item.label} {...item}/>)}
              </div>

              {/* Mobile: a comparsa, chiuse di default per non occupare spazio sopra il globo */}
              <div className="sm:hidden">
                <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
                  <CollapsibleTrigger asChild>
                    <button type="button" className="flex flex-col items-center w-full py-1.5 gap-0.5"
                      aria-label={statsOpen ? "Nascondi le tue statistiche" : "Mostra le tue statistiche"}>
                      <span style={{width:30,height:3,borderRadius:2,background:"rgba(255,255,255,0.25)"}}/>
                      <ChevronDown className="w-3 h-3 transition-transform" style={{ color:"rgba(255,255,255,0.35)", transform: statsOpen ? "rotate(180deg)" : "none" }}/>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="grid grid-cols-2 gap-2.5">
                      {statItems.map(item => <StatCard key={item.label} {...item}/>)}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </>
          );
        })()}

        <div style={{ display:"flex", height:"calc(100vh - 220px)", minHeight:"460px", overflow:"hidden", transition:"all 0.3s ease" }}>
          {/* Globe */}
          <div style={{ flex:1, position:"relative", overflow:"hidden", transition:"all 0.3s ease" }}
            onMouseMove={(e) => {
              if (e.buttons===1) setStarOffset(p=>({x:p.x+e.movementX*0.5,y:p.y+e.movementY*0.5}));
              setStarMouse({x: e.clientX, y: e.clientY});
            }}
            onMouseLeave={() => setStarMouse(null)}>
            <StarField offsetX={starOffset.x} offsetY={starOffset.y} mousePos={starMouse} />
            <WorldMap
              trips={trips}
              selectedId={selectedId}
              onSelectTrip={(t) => setSelectedId(t.id)}
              onSelectCity={(city) => setSelectedCity(city)}
              autoRotateSetting={autoRotate}
            />

            {/* Mini-card del viaggio selezionato: flottante (non modale) così
                la rotta evidenziata sul globo resta visibile dietro. */}
            {selectedTrip && (
              <div style={{position:"absolute", left:12, right:12, bottom:12, zIndex:30, display:"flex", justifyContent:"center", pointerEvents:"none"}}>
                <div style={{
                  pointerEvents:"auto", width:"100%", maxWidth:380,
                  background:"rgba(10,22,40,0.92)", border:"0.5px solid #1a2d4a",
                  borderRadius:14, padding:"12px 14px", backdropFilter:"blur(6px)",
                }}>
                  <div style={{display:"flex", alignItems:"flex-start", gap:10}}>
                    <div style={{width:26, height:26, borderRadius:"50%", overflow:"hidden", border:"1px solid rgba(255,255,255,0.1)", flexShrink:0}}>
                      {selectedTrip.country_code
                        ? <img src={"https://flagcdn.com/w80/"+selectedTrip.country_code.toLowerCase()+".png"} width="26" height="26" style={{objectFit:"cover"}} alt=""/>
                        : <div style={{width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14}}>🌍</div>}
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:13, fontWeight:700, color:"#f0f4ff", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>
                        {selectedTrip.title && selectedTrip.title !== selectedTrip.city ? selectedTrip.title : selectedTrip.city}
                      </div>
                      <div style={{fontSize:11, color:"rgba(255,255,255,0.4)"}}>{selectedTrip.city}, {selectedTrip.country}</div>
                    </div>
                    <button onClick={() => setSelectedId(null)} aria-label="Chiudi scheda viaggio"
                      style={{width:24, height:24, background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.4)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
                      <X style={{width:14, height:14}}/>
                    </button>
                  </div>

                  <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", margin:"8px 0 10px"}}>
                    <span style={{fontSize:11, color:"rgba(255,255,255,0.55)", fontWeight:600}}>
                      {formatTripDate(selectedTrip.trip_date)}
                      {selectedTrip.date_end && selectedTrip.date_end !== selectedTrip.trip_date && (
                        <span style={{color:"rgba(255,255,255,0.35)", fontWeight:400}}> → {formatTripDate(selectedTrip.date_end)}</span>
                      )}
                    </span>
                    {selectedTrip.transport_mode && TRANSPORT_BADGE[selectedTrip.transport_mode] && (
                      <span style={{
                        fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:99,
                        color: TRANSPORT_BADGE[selectedTrip.transport_mode].color,
                        background: TRANSPORT_BADGE[selectedTrip.transport_mode].color + "1f",
                      }}>
                        {TRANSPORT_BADGE[selectedTrip.transport_mode].label}
                      </span>
                    )}
                    {selectedTrip.distance_from_home_km != null && (
                      <span style={{fontSize:11, color:"rgba(255,255,255,0.35)"}}>{fmtDistance(selectedTrip.distance_from_home_km, distanceUnit)}</span>
                    )}
                  </div>

                  <div style={{display:"flex", gap:8}}>
                    <button onClick={() => setFlyoverTrip(selectedTrip)}
                      style={{
                        flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                        fontSize:11, fontWeight:600, padding:"7px 0", borderRadius:999, cursor:"pointer",
                        background:"rgba(96,165,250,0.15)", border:"1px solid #60a5fa", color:"#60a5fa",
                      }}>
                      <Video style={{width:12, height:12}}/> Rivivi in 3D
                    </button>
                    <button onClick={() => navigate("/modifica-viaggio/"+selectedTrip.id)}
                      style={{
                        flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                        fontSize:11, fontWeight:600, padding:"7px 0", borderRadius:999, cursor:"pointer",
                        background:"rgba(255,255,255,0.06)", border:"0.5px solid #1a2d4a", color:"rgba(255,255,255,0.7)",
                      }}>
                      <Pencil style={{width:12, height:12}}/> Modifica
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>


        </div>
      </div>

      {selectedCity && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedCity(null)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <div className="text-2xl">
                {selectedCity.country_code.length === 2
                  ? String.fromCodePoint(...selectedCity.country_code.toUpperCase().split("").map(c => 0x1f1e6 + c.charCodeAt(0) - 65))
                  : "🌍"}
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-base">{selectedCity.name}</h2>
                <p className="text-xs text-muted-foreground">{selectedCity.country}</p>
              </div>
              <button onClick={() => setSelectedCity(null)}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            {/* Actions */}
            <div className="p-3 flex flex-col gap-2">
              <button
                className="w-full btn-primary py-3 text-sm font-semibold flex items-center justify-center gap-2"
                onClick={() => {
                  if (selectedCity) {
                    sessionStorage.setItem("navta.prefill.city", JSON.stringify(selectedCity));
                  }
                  setSelectedCity(null);
                  navigate("/nuovo-viaggio");
                }}
              >
                ✈ Aggiungi come viaggio
              </button>

            </div>
          </div>
        </div>
      )}

      {flyoverTrip && <TripFlyover trips={[flyoverTrip]} onClose={() => setFlyoverTrip(null)} />}

          </main>
  );
}


export default function Home() {
  return <ErrorBoundary><HomeInner /></ErrorBoundary>;
}
