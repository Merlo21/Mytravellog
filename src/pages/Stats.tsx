import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Settings as SettingsIcon } from "lucide-react";
import { Trip, loadTrips } from "@/lib/storage";
import { StatsSection } from "@/components/StatsSection";
import { ContinentsMap } from "@/components/ContinentsMap";
import { TravelHighlights } from "@/components/TravelHighlights";
import { TripTimelineChart } from "@/components/TripTimelineChart";

const Stats = () => {
  const [trips, setTrips] = useState<Trip[]>([]);

  useEffect(() => {
    setTrips(loadTrips());
  }, []);


  return (
    <main className="min-h-screen">
      <header className="border-b border-border bg-background/60 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:"#22d3ee"}}>
              <svg width="26" height="26" viewBox="0 0 30 30" fill="none" aria-hidden="true">
                <circle cx="15" cy="15" r="11" stroke="#020d1a" strokeWidth="1.6"/>
                <ellipse cx="15" cy="15" rx="11" ry="4.8" stroke="#020d1a" strokeWidth="1.2"/>
                <ellipse cx="15" cy="15" rx="6.5" ry="11" stroke="#020d1a" strokeWidth="1.2"/>
                <polygon points="15,5.5 13.5,13 15,11.5 16.5,13" fill="#ffffff"/>
                <polygon points="15,24.5 13.5,17 15,18.5 16.5,17" fill="#ffffff" opacity="0.35"/>
                <polygon points="24.5,15 17,13.5 18.5,15 17,16.5" fill="#fbbf24"/>
                <polygon points="5.5,15 13,13.5 11.5,15 13,16.5" fill="#fbbf24" opacity="0.35"/>
              </svg>
            </div>
            <h1 className="text-[20px] font-extrabold leading-none tracking-[0.2em]">
              <span style={{color:"#22d3ee"}}>NAV</span><span style={{color:"#fbbf24"}}>·</span><span>TA</span>
            </h1>
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

        <TravelHighlights trips={trips} />
      </div>
    </main>
  );
};

export default Stats;
