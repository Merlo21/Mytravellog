import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Trip } from "@/lib/types";
import { WorldMap } from "@/components/WorldMap";
import { TripCard } from "@/components/TripCard";
import { NewTripDialog } from "@/components/NewTripDialog";
import { Button } from "@/components/ui/button";
import { Compass, LogOut, Globe, MapPin, Plane, Loader2 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [authLoading, user, navigate]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .order("trip_date", { ascending: false });
    if (!error && data) setTrips(data as Trip[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const stats = useMemo(() => {
    const countries = new Set(trips.map((t) => t.country));
    const cities = new Set(trips.map((t) => `${t.city}|${t.country}`));
    const totalKm = trips.reduce((s, t) => s + (t.distance_from_home_km ?? 0), 0);
    return { countries: countries.size, cities: cities.size, trips: trips.length, km: totalKm };
  }, [trips]);

  const defaultHome = trips[0]
    ? { lat: trips[0].home_latitude, lon: trips[0].home_longitude, label: trips[0].home_label ?? "Casa" }
    : null;

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-background/60 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-aurora flex items-center justify-center shadow-glow">
              <Compass className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Atlas</h1>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                {user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NewTripDialog userId={user.id} onCreated={load} defaultHome={defaultHome} />
            <Button
              variant="ghost" size="icon"
              onClick={async () => { await supabase.auth.signOut(); navigate("/auth"); }}
              title="Esci"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<Plane />} label="Viaggi" value={stats.trips} />
          <StatCard icon={<Globe />} label="Stati" value={stats.countries} accent="primary" />
          <StatCard icon={<MapPin />} label="Città" value={stats.cities} />
          <StatCard icon={<Compass />} label="Km totali" value={stats.km.toLocaleString("it-IT")} accent="accent" />
        </section>

        {/* Map + List */}
        <section className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
          <div className="h-[500px] lg:h-[640px] glass-card p-3 animate-fade-up">
            <WorldMap
              trips={trips}
              selectedId={selectedId}
              onSelectTrip={(t) => setSelectedId(t.id)}
            />
          </div>

          <div className="space-y-3 lg:max-h-[640px] lg:overflow-y-auto pr-1 scrollbar-thin">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-lg font-semibold">I tuoi viaggi</h2>
              <span className="text-xs text-muted-foreground font-mono">{trips.length} totali</span>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : trips.length === 0 ? (
              <EmptyState />
            ) : (
              trips.map((t) => (
                <TripCard
                  key={t.id}
                  trip={t}
                  selected={selectedId === t.id}
                  onClick={() => setSelectedId(t.id)}
                  onDeleted={load}
                />
              ))
            )}
          </div>
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

function EmptyState() {
  return (
    <div className="glass-card p-8 text-center">
      <Globe className="w-12 h-12 mx-auto mb-3 text-primary opacity-60 animate-pulse-glow" />
      <h3 className="font-semibold mb-1">Il tuo atlante è vuoto</h3>
      <p className="text-sm text-muted-foreground">
        Aggiungi il tuo primo viaggio per iniziare a tracciare temperature, altitudini e km percorsi.
      </p>
    </div>
  );
}

export default Index;
