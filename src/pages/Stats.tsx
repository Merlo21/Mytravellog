import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Compass, Settings as SettingsIcon } from "lucide-react";
import { Trip, loadTrips } from "@/lib/storage";
import { fmtDistance, useSettings } from "@/lib/settings";
import { Plane, Car, Globe2 } from "lucide-react";
import { StatsSection } from "@/components/StatsSection";
import { ContinentsMap } from "@/components/ContinentsMap";
import { TravelHighlights } from "@/components/TravelHighlights";
import { TripTimelineChart } from "@/components/TripTimelineChart";

const Stats = () => {
  const [trips, setTrips] = useState<Trip[]>([]);

  useEffect(() => {
    setTrips(loadTrips());
  }, []);

  const { distanceUnit } = useSettings();

  const distanceStats = useMemo(() => {
    const total = trips.reduce((s, t) => s + (t.distance_from_home_km ?? 0), 0);
    // Trips > 500km are likely by plane, shorter ones by car/train
    const byPlane = trips.filter(t => (t.distance_from_home_km ?? 0) > 500)
      .reduce((s, t) => s + (t.distance_from_home_km ?? 0), 0);
    const byRoad = total - byPlane;
    const earthCirc = 40075;
    return { total, byPlane, byRoad, earthLaps: total / earthCirc };
  }, [trips]);

  return (
    <main className="min-h-screen">
      <header className="border-b border-border bg-background/60 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Compass className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Statistiche</h1>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                il tuo atlante in numeri
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/impostazioni" aria-label="Impostazioni"
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-muted/60 hover:bg-muted text-sm font-semibold transition-colors border border-border">
              <SettingsIcon className="w-4 h-4 text-primary" />
            </Link>
            <Link to="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50 hover:bg-muted text-sm font-semibold transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Indietro
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 space-y-8">
        <StatsSection trips={trips} />
        <TripTimelineChart trips={trips} />
        <ContinentsMap trips={trips} />
        {/* Distance stats */}
        <section className="glass-card p-6">
          <h2 className="font-bold text-lg mb-5 flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-primary" /> Distanze percorse
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-secondary/40 rounded-xl p-4 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Globe2 className="w-4 h-4" /> Totale
              </div>
              <div className="text-2xl font-bold font-mono text-primary">
                {fmtDistance(distanceStats.total, distanceUnit)}
              </div>
              <div className="text-xs text-muted-foreground">
                {distanceStats.earthLaps > 0 ? `${distanceStats.earthLaps.toFixed(2)}× giro della Terra` : "Inizia a viaggiare!"}
              </div>
            </div>
            <div className="bg-secondary/40 rounded-xl p-4 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Plane className="w-4 h-4 text-blue-400" /> In aereo <span className="text-[10px]">(tratte &gt;500km)</span>
              </div>
              <div className="text-2xl font-bold font-mono text-blue-400">
                {fmtDistance(distanceStats.byPlane, distanceUnit)}
              </div>
              <div className="text-xs text-muted-foreground">
                {distanceStats.total > 0 ? `${Math.round(distanceStats.byPlane / distanceStats.total * 100)}% del totale` : "—"}
              </div>
            </div>
            <div className="bg-secondary/40 rounded-xl p-4 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Car className="w-4 h-4 text-emerald-400" /> Su strada <span className="text-[10px]">(tratte &lt;500km)</span>
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-400">
                {fmtDistance(distanceStats.byRoad, distanceUnit)}
              </div>
              <div className="text-xs text-muted-foreground">
                {distanceStats.total > 0 ? `${Math.round(distanceStats.byRoad / distanceStats.total * 100)}% del totale` : "—"}
              </div>
            </div>
          </div>
        </section>

        <TravelHighlights trips={trips} />
      </div>
    </main>
  );
};

export default Stats;
