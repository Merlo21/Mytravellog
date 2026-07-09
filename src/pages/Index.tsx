// [FROZEN] — Non modificare senza esplicita richiesta
import { AppHeader } from "@/components/AppHeader";
import { useEffect, useMemo, useState, Component, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loadTrips, updateTrip, Trip } from "@/lib/storage";
import { distanceKm } from "@/lib/geo";
import { fmtDistance, useSettings } from "@/lib/settings";
import { CalendarDays, Compass, Globe, MapPin, Plane, PieChart, Plus, Search, Settings, X } from "lucide-react";
import { WorldMap, CityInfo } from "@/components/WorldMap";
import { StarField } from "@/components/StarField";

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

  const defaultHome = trips[0]
    ? { lat: trips[0].home_latitude, lon: trips[0].home_longitude, label: trips[0].home_label }
    : null;

  return (
    <main className="h-screen flex flex-col" style={{backgroundColor:"#060e1e"}}>
      <AppHeader/>

      <div className="container mx-auto px-4 py-6 flex-1 flex flex-col gap-6">
        <div style={{display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10}}>
          {([
            { icon: <Plane       className="w-[18px] h-[18px]"/>, label: "Viaggi",   value: stats.trips.toString(),     accent: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
            { icon: <Globe       className="w-[18px] h-[18px]"/>, label: "Paesi",    value: stats.countries.toString(), accent: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
            { icon: <MapPin      className="w-[18px] h-[18px]"/>, label: "Città",    value: stats.cities.toString(),    accent: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
            { icon: <Compass     className="w-[18px] h-[18px]"/>, label: distanceUnit === "imperial" ? "Miglia" : "Km totali", value: fmtDistance(stats.km, distanceUnit), accent: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
            { icon: <CalendarDays className="w-[18px] h-[18px]"/>, label: "Giorni",  value: stats.days.toString(),      accent: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
          ]).map(({ icon, label, value, accent, bg }) => (
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
          ))}
        </div>

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



          </main>
  );
}


export default function Home() {
  return <ErrorBoundary><HomeInner /></ErrorBoundary>;
}
