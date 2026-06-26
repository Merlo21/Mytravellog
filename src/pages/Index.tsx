import { useEffect, useMemo, useState, Component, ReactNode } from "react";
import { Link } from "react-router-dom";
import { loadTrips, Trip } from "@/lib/storage";
import { fmtDistance, useSettings } from "@/lib/settings";
import { WorldMap, CityInfo } from "@/components/WorldMap";
import { StarField } from "@/components/StarField";
import { TripCard } from "@/components/TripCard";
import { NewTripDialog } from "@/components/NewTripDialog";
import { Compass, Globe, MapPin, Plane, PieChart, Settings, X, CheckCircle } from "lucide-react";

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
import { Link } from "react-router-dom";
import { loadTrips, Trip } from "@/lib/storage";
import { fmtDistance, useSettings } from "@/lib/settings";
import { WorldMap, CityInfo } from "@/components/WorldMap";
import { StarField } from "@/components/StarField";
import { TripCard } from "@/components/TripCard";
import { NewTripDialog } from "@/components/NewTripDialog";

function HomeInner() {
  const { distanceUnit, autoRotate } = useSettings();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<CityInfo | null>(null);
  const [starOffset, setStarOffset] = useState({ x: 0, y: 0 });
  const [starMouse, setStarMouse] = useState<{x:number;y:number}|null>(null);
  const [pendingCity, setPendingCity] = useState<CityInfo | null>(null);

  const refresh = () => setTrips(loadTrips());
  useEffect(() => { refresh(); }, []);

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
    <main className="h-screen flex flex-col overflow-hidden" style={{backgroundColor:"#060e1e"}}>
      <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:"#60a5fa"}}>
              <svg width="26" height="26" viewBox="0 0 30 30" fill="none" aria-hidden="true">
                <circle cx="15" cy="15" r="11" stroke="#020d1a" strokeWidth="1.6"/>
                <ellipse cx="15" cy="15" rx="11" ry="4.8" stroke="#020d1a" strokeWidth="1.2"/>
                <ellipse cx="15" cy="15" rx="6.5" ry="11" stroke="#020d1a" strokeWidth="1.2"/>
                {/* Nord — bianco pieno */}
                <polygon points="15,5.5 13.5,13 15,11.5 16.5,13" fill="#ffffff"/>
                {/* Sud — bianco semitrasparente */}
                <polygon points="15,24.5 13.5,17 15,18.5 16.5,17" fill="#ffffff" opacity="0.35"/>
                {/* Est — dorato */}
                <polygon points="24.5,15 17,13.5 18.5,15 17,16.5" fill="#fbbf24"/>
                {/* Ovest — dorato semitrasparente */}
                <polygon points="5.5,15 13,13.5 11.5,15 13,16.5" fill="#fbbf24" opacity="0.35"/>
              </svg>
            </div>
            <div>
              <h1 className="text-[20px] font-extrabold leading-none tracking-[0.2em]">
                <span style={{color:"#60a5fa"}}>NAV</span><span style={{color:"#fbbf24"}}>·</span><span>TA</span>
              </h1>
            </div>
          </div>

          {/* Nav */}
          <div className="flex items-center gap-1">
            <button onClick={() => setSidebarOpen(true)}
              className="btn-ghost text-sm flex items-center gap-2 py-1.5 px-3">
              <Plane className="w-4 h-4 text-primary" /> I tuoi viaggi
            </button>
            <Link to="/statistiche" className="btn-ghost text-sm flex items-center gap-2 py-1.5 px-3">
              <PieChart className="w-4 h-4 text-primary" /> Statistiche
            </Link>
            <div className="w-px h-5 bg-border mx-1" />
            <Link to="/impostazioni" className="btn-ghost p-2" aria-label="Impostazioni">
              <Settings className="w-4 h-4 text-muted-foreground" />
            </Link>
            <NewTripDialog onCreated={refresh} defaultHome={defaultHome} prefilledCity={pendingCity} />
          </div>
        </div>
      </header>

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
              <div onClick={() => setSelectedCity(null)}>
                <NewTripDialog
                  onCreated={refresh}
                  defaultHome={defaultHome}
                  prefilledCity={selectedCity}
                  triggerLabel={`✈ Aggiungi come viaggio`}
                  triggerClassName="w-full btn-primary py-3 text-sm font-semibold flex items-center justify-center gap-2"
                />
              </div>
              <button
                onClick={() => {
                  // Mark as visited without adding to trips
                  const visited = JSON.parse(localStorage.getItem("atlas.visited.v1") || "[]");
                  const already = visited.find((v: any) => v.name === selectedCity!.name && v.country === selectedCity!.country);
                  if (!already) {
                    visited.push({ name: selectedCity!.name, country: selectedCity!.country, country_code: selectedCity!.country_code, latitude: selectedCity!.latitude, longitude: selectedCity!.longitude, visited_at: new Date().toISOString() });
                    localStorage.setItem("atlas.visited.v1", JSON.stringify(visited));
                  }
                  setSelectedCity(null);
                }}
                className="w-full py-3 text-sm font-semibold flex items-center justify-center gap-2 rounded-xl border border-border hover:bg-secondary transition-colors text-foreground"
              >
                <CheckCircle className="w-4 h-4 text-green-400" />
                Segna come visitata
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingCity && (
        <div style={{display:'none'}}>
          <NewTripDialog
            onCreated={() => { refresh(); setPendingCity(null); }}
            defaultHome={defaultHome}
            prefilledCity={pendingCity}
            triggerLabel="open"
          />
        </div>
      )}

      {/* Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 flex">
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="w-full max-w-sm bg-background border-l border-border flex flex-col animate-fade-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="font-bold">I tuoi viaggi</h2>
                <p className="text-xs text-muted-foreground">{trips.length} totali</p>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {trips.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-8">Nessun viaggio ancora.</p>
                : trips.map((t) => (
                  <TripCard key={t.id} trip={t}
                    selected={selectedId === t.id}
                    onClick={() => { setSelectedId(t.id); setSidebarOpen(false); }}
                    onDeleted={refresh} onUpdated={refresh} />
                ))
              }
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
