import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LocalTrip, loadTrips } from "@/lib/storage";
import { WorldMap } from "@/components/WorldMap";
import { TripCard } from "@/components/TripCard";
import { NewTripDialog } from "@/components/NewTripDialog";
import { Compass, Globe, MapPin, Plane, PieChart, Settings as SettingsIcon, Thermometer, ThermometerSun, Mountain } from "lucide-react";
import { formatDistanceKm, formatAltitudeM, formatTemperatureC, useSettings } from "@/lib/settings";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";


const Index = () => {
  const [trips, setTrips] = useState<LocalTrip[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { distanceUnit, temperatureUnit } = useSettings();

  const refresh = () => setTrips(loadTrips());

  useEffect(() => { refresh(); }, []);

  const stats = useMemo(() => {
    const countries = new Set(trips.map((t) => t.country));
    const cities = new Set(trips.map((t) => `${t.city}|${t.country}`));
    const totalKm = trips.reduce((s, t) => s + (t.distance_from_home_km ?? 0), 0);
    const temps = trips.map((t) => t.temperature_c).filter((v): v is number => v != null);
    const alts = trips.map((t) => t.altitude_m).filter((v): v is number => v != null);
    return {
      countries: countries.size,
      cities: cities.size,
      trips: trips.length,
      km: totalKm,
      minTemp: temps.length ? Math.min(...temps) : null,
      maxTemp: temps.length ? Math.max(...temps) : null,
      maxAlt: alts.length ? Math.max(...alts) : null,
    };
  }, [trips]);

  const defaultHome = trips[0]
    ? { lat: trips[0].home_latitude, lon: trips[0].home_longitude, label: trips[0].home_label ?? "Casa" }
    : null;

  return (
    <main className="min-h-screen">
      <header className="border-b border-border bg-background/60 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-aurora flex items-center justify-center shadow-glow">
              <Compass className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Atlas</h1>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                trip tracker
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/60 hover:bg-muted text-sm font-semibold transition-colors border border-border"
                >
                  <Plane className="w-4 h-4 text-primary" />
                  I tuoi viaggi
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>I tuoi viaggi</SheetTitle>
                  <SheetDescription>{trips.length} viaggi totali. Tocca la matita per modificare.</SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-3">
                  {trips.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nessun viaggio. Aggiungi il primo dal pulsante "Nuovo viaggio".
                    </p>
                  ) : (
                    trips.map((t) => (
                      <TripCard
                        key={t.id}
                        trip={t}
                        selected={selectedId === t.id}
                        onClick={() => setSelectedId(t.id)}
                        onDeleted={refresh}
                        onUpdated={refresh}
                      />
                    ))
                  )}
                </div>
              </SheetContent>
            </Sheet>

            <Link
              to="/statistiche"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/60 hover:bg-muted text-sm font-semibold transition-colors border border-border"
            >
              <PieChart className="w-4 h-4 text-primary" />
              Statistiche
            </Link>
            <Link
              to="/impostazioni"
              aria-label="Impostazioni"
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-muted/60 hover:bg-muted text-sm font-semibold transition-colors border border-border"
            >
              <SettingsIcon className="w-4 h-4 text-primary" />
            </Link>
            <NewTripDialog onCreated={refresh} defaultHome={defaultHome} />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <section className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Plane />} label="Viaggi" value={stats.trips} />
          <StatCard icon={<Globe />} label="Stati" value={stats.countries} accent="primary" />
          <StatCard icon={<MapPin />} label="Città" value={stats.cities} />
          <StatCard icon={<Compass />} label={distanceUnit === "imperial" ? "Mi totali" : "Km totali"} value={formatDistanceKm(stats.km, distanceUnit)} accent="accent" />
        </section>

        <section className="mb-8 h-[500px] lg:h-[640px] glass-card p-3 animate-fade-up">
          <WorldMap
            trips={trips}
            selectedId={selectedId}
            onSelectTrip={(t) => setSelectedId(t.id)}
          />
        </section>
      </div>


    </main>
  );
};

function StatCard({
  icon, label, value, accent,
}: { icon: React.ReactNode; label: string; value: string | number; accent?: "primary" | "accent" }) {
  const accentClass =
    accent === "primary" ? "text-primary" : accent === "accent" ? "text-accent" : "text-foreground";
  return (
    <div className="glass-card p-4 flex items-center gap-3 hover:shadow-glow transition-shadow">
      <div className={`w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center ${accentClass} [&_svg]:w-5 [&_svg]:h-5`}>
        {icon}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{label}</div>
        <div className={`text-2xl font-bold font-mono ${accentClass}`}>{value}</div>
      </div>
    </div>
  );
}


export default Index;
