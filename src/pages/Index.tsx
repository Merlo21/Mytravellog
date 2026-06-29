// [FROZEN] — Non modificare senza esplicita richiesta
import { AppHeader } from "@/components/AppHeader";
import { useEffect, useMemo, useState, Component, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loadTrips, updateTrip, Trip } from "@/lib/storage";
import { distanceKm } from "@/lib/geo";
import { fmtDistance, useSettings } from "@/lib/settings";
import { Compass, Globe, MapPin, Plane, PieChart, Plus, Search, Settings, X } from "lucide-react";
import { WorldMap, CityInfo } from "@/components/WorldMap";
import { StarField } from "@/components/StarField";
import { TripCard } from "@/components/TripCard";

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

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loadTrips, updateTrip, Trip } from "@/lib/storage";
import { distanceKm } from "@/lib/geo";
import { fmtDistance, useSettings } from "@/lib/settings";

function HomeInner() {
  const navigate = useNavigate();
  const { distanceUnit, autoRotate, homeCity } = useSettings();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Toggle body class to hide MapLibre controls when sidebar is open
  useEffect(() => {
    if (sidebarOpen) document.body.classList.add("sidebar-open");
    else document.body.classList.remove("sidebar-open");
    return () => document.body.classList.remove("sidebar-open");
  }, [sidebarOpen]);
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
    const trips = loadTrips();
    let changed = false;
    trips.forEach(t => {
      if (t.latitude && t.longitude && !isNaN(t.latitude) && !isNaN(t.longitude) &&
          (t.distance_from_home_km == null || t.distance_from_home_km === 0)) {
        const dist = distanceKm(homeCity.lat, homeCity.lon, t.latitude, t.longitude);
        updateTrip(t.id, { distance_from_home_km: dist });
        changed = true;
      }
    });
    if (changed) refresh();
  }, [homeCity]);

  const stats = useMemo(() => {
    const countries = new Set(trips.map((t) => t.country_code || t.country));
    const cities = new Set(trips.map((t) => `${t.city}|${t.country}`));
    const km = trips.reduce((s, t) => s + (t.distance_from_home_km ?? 0), 0);
    return { trips: trips.length, countries: countries.size, cities: cities.size, km };
  }, [trips]);

  const defaultHome = trips[0]
    ? { lat: trips[0].home_latitude, lon: trips[0].home_longitude, label: trips[0].home_label }
    : null;

  return (
    <main className="h-screen flex flex-col" style={{backgroundColor:"#060e1e"}}>
      <AppHeader onTripsClick={() => setSidebarOpen(true)}/>

      <div className="container mx-auto px-4 py-6 flex-1 flex flex-col gap-6">
        <div className="rounded-xl overflow-hidden" style={{background:"#0a1628", border:"0.5px solid #1a2d4a"}}>
          <div className="flex">
            {([
              { icon: <Plane className="w-[18px] h-[18px]"/>,   label: "Viaggi",   value: stats.trips.toString(),     accent: "#60a5fa" as const, border: "#60a5fa" as const },
              { icon: <Globe className="w-[18px] h-[18px]"/>,   label: "Paesi",    value: stats.countries.toString(), accent: "#fbbf24" as const, border: "#fbbf24" as const },
              { icon: <MapPin className="w-[18px] h-[18px]"/>,  label: "Città",    value: stats.cities.toString(),    accent: "#60a5fa" as const, border: "#60a5fa" as const },
              { icon: <Compass className="w-[18px] h-[18px]"/>, label: distanceUnit === "imperial" ? "Miglia" : "Km totali", value: fmtDistance(stats.km, distanceUnit), accent: "#fbbf24" as const, border: "#fbbf24" as const },
            ] as const).map(({ icon, label, value, accent, border }, i) => (
              <div key={label} className="flex-1 py-3 px-4" style={{
                borderLeft: `3px solid ${border}`,
                borderRight: i < 3 ? "0.5px solid #1a2d4a" : "none",
              }}>
                <div className="text-[10px] uppercase tracking-widest mb-1.5" style={{color:"rgba(255,255,255,0.35)"}}>{label}</div>
                <div className="flex items-center gap-2">
                  <span style={{color: accent}}>{icon}</span>
                  <span className="text-xl font-bold" style={{color: accent}}>{value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: "calc(100vh - 220px)", minHeight: "460px", background: "transparent", overflow: "hidden", position:"relative" }}
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

      {/* City selected popup — opens NewTripDialog pre-filled */}
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



      {/* Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 flex">
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="w-full max-w-sm bg-background border-l border-border flex flex-col animate-fade-up">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="font-bold">I tuoi viaggi</h2>
                <p className="text-xs text-muted-foreground">{trips.length} {trips.length === 1 ? "viaggio" : "viaggi"}</p>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2 bg-secondary/30 rounded-xl px-3 py-2">
                <Search className="w-4 h-4 text-muted-foreground flex-shrink-0"/>
                <input
                  className="bg-transparent flex-1 text-sm outline-none placeholder:text-muted-foreground"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cerca città, paese…"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5"/>
                  </button>
                )}
              </div>
            </div>

            {/* Trips grouped by year */}
            <div className="flex-1 overflow-y-auto p-4">
              {(() => {
                const filtered = trips.filter(t =>
                  !search || [t.title, t.city, t.country].some(s =>
                    s?.toLowerCase().includes(search.toLowerCase())
                  )
                );
                if (filtered.length === 0) return (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {search ? "Nessun risultato." : "Nessun viaggio ancora."}
                  </p>
                );
                // Group by year
                const byYear = filtered.reduce((acc, t) => {
                  const year = t.trip_date ? new Date(t.trip_date).getFullYear().toString() : "—";
                  if (!acc[year]) acc[year] = [];
                  acc[year].push(t);
                  return acc;
                }, {} as Record<string, typeof trips>);
                const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));
                return years.map(year => (
                  <div key={year} className="mb-4">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="text-xs font-bold tracking-widest uppercase"
                        style={{color:"rgba(255,255,255,0.25)"}}>{year}</span>
                      <div className="flex-1 h-px bg-border"/>
                      <span className="text-xs text-muted-foreground">{byYear[year].length}</span>
                    </div>
                    <div className="space-y-2">
                      {byYear[year].map(t => (
                        <TripCard key={t.id} trip={t}
                          selected={selectedId === t.id}
                          onClick={() => { setSelectedId(t.id); }}
                          onDeleted={refresh} onUpdated={refresh}/>
                      ))}
                    </div>
                  </div>
                ));
              })()}
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
