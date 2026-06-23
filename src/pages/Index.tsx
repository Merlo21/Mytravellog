import { useEffect, useMemo, useState, Component, ReactNode } from "react";
import { Link } from "react-router-dom";
import { loadTrips, Trip } from "@/lib/storage";
import { fmtDistance, useSettings } from "@/lib/settings";
import { WorldMap, CityInfo } from "@/components/WorldMap";
import { TripCard } from "@/components/TripCard";
import { NewTripDialog } from "@/components/NewTripDialog";
import { Compass, Globe, MapPin, Plane, PieChart, Settings, X, Plus, CheckCircle } from "lucide-react";

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
import { TripCard } from "@/components/TripCard";
import { NewTripDialog } from "@/components/NewTripDialog";
import { Compass, Globe, MapPin, Plane, PieChart, Settings, X, Plus, CheckCircle } from "lucide-react";

function HomeInner() {
  const { distanceUnit, globeLabels, autoRotate } = useSettings();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<CityInfo | null>(null);
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
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Compass className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none">Atlas</h1>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">trip tracker</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(true)}
              className="btn-ghost text-sm flex items-center gap-2 py-1.5 px-3">
              <Plane className="w-4 h-4 text-primary" /> I tuoi viaggi
            </button>
            <Link to="/statistiche" className="btn-ghost text-sm flex items-center gap-2 py-1.5 px-3">
              <PieChart className="w-4 h-4 text-primary" /> Statistiche
            </Link>
            <Link to="/impostazioni" className="btn-ghost p-2" aria-label="Impostazioni">
              <Settings className="w-4 h-4 text-primary" />
            </Link>
            <NewTripDialog onCreated={refresh} defaultHome={defaultHome} />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 flex-1 flex flex-col gap-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: <Plane className="w-4 h-4" />, label: "Viaggi", value: stats.trips },
            { icon: <Globe className="w-4 h-4" />, label: "Paesi", value: stats.countries, accent: "text-primary" },
            { icon: <MapPin className="w-4 h-4" />, label: "Città", value: stats.cities },
            { icon: <Compass className="w-4 h-4" />, label: distanceUnit === "imperial" ? "Miglia" : "Km totali", value: fmtDistance(stats.km, distanceUnit), accent: "text-accent" },
          ].map(({ icon, label, value, accent }) => (
            <div key={label} className="glass-card p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center ${accent ?? "text-foreground"}`}>{icon}</div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{label}</div>
                <div className={`text-2xl font-bold font-mono ${accent ?? ""}`}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 min-h-[460px] lg:min-h-[600px]">
          <WorldMap
            trips={trips}
            selectedId={selectedId}
            onSelectTrip={(t) => setSelectedId(t.id)}
            onSelectCity={(city) => setSelectedCity(city)}
            globeLabels={globeLabels}
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
