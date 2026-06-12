import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Compass, Settings as SettingsIcon } from "lucide-react";
import { LocalTrip, loadTrips } from "@/lib/storage";
import { StatsSection } from "@/components/StatsSection";
import { ContinentsMap } from "@/components/ContinentsMap";
import { TravelHighlights } from "@/components/TravelHighlights";
import { TripTimelineChart } from "@/components/TripTimelineChart";

const Stats = () => {
  const [trips, setTrips] = useState<LocalTrip[]>([]);

  useEffect(() => {
    setTrips(loadTrips());
  }, []);

  return (
    <main className="min-h-screen">
      <header className="border-b border-border bg-background/60 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-aurora flex items-center justify-center shadow-glow">
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
            <Link
              to="/impostazioni"
              aria-label="Impostazioni"
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-muted/60 hover:bg-muted text-sm font-semibold transition-colors border border-border"
            >
              <SettingsIcon className="w-4 h-4 text-primary" />
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50 hover:bg-muted text-sm font-semibold transition-colors"
            >
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
        <TravelHighlights trips={trips} />
      </div>
    </main>
  );
};

export default Stats;
