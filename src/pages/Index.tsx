import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadTrips, Trip } from "@/lib/storage";
import { fmtDistance, useSettings } from "@/lib/settings";
import { WorldMap, CityInfo } from "@/components/WorldMap";
import { TripCard } from "@/components/TripCard";
import { NewTripDialog } from "@/components/NewTripDialog";
import { Compass, Globe, MapPin, Plane, PieChart, Settings, X } from "lucide-react";

export default function Home() {
  const { distanceUnit, globeLabels } = useSettings();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<CityInfo | null>(null);

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
          />
        </div>
      </div>

      {/* City selected popup — opens NewTripDialog pre-filled */}
      {selectedCity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedCity(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="text-3xl">
                {selectedCity.country_code.length === 2
                  ? String.fromCodePoint(...selectedCity.country_code.toUpperCase().split("").map(c => 0x1f1e6 + c.charCodeAt(0) - 65))
                  : "🌍"}
              </div>
              <div>
                <h2 className="text-lg font-bold">{selectedCity.name}</h2>
                <p className="text-sm text-muted-foreground">{selectedCity.country}</p>
              </div>
              <button onClick={() => setSelectedCity(null)} className="ml-auto p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Vuoi aggiungere <strong>{selectedCity.name}</strong> ai tuoi viaggi?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setSelectedCity(null)}
                className="flex-1 btn-ghost text-sm py-2">
                Annulla
              </button>
              <div className="flex-1" onClick={() => setSelectedCity(null)}>
                <NewTripDialog
                  onCreated={refresh}
                  defaultHome={defaultHome}
                  prefilledCity={{ name: selectedCity.name, country: selectedCity.country, country_code: selectedCity.country_code, latitude: selectedCity.latitude, longitude: selectedCity.longitude }}
                  triggerLabel={`Aggiungi ${selectedCity.name}`}
                />
              </div>
            </div>
          </div>
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
