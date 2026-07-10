// [FROZEN] — Non modificare senza esplicita richiesta
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { Trip, loadTrips } from "@/lib/storage";
import { StatsSection } from "@/components/StatsSection";
import { ContinentsMap } from "@/components/ContinentsMap";
import { TravelHighlights } from "@/components/TravelHighlights";
import { TravelHeatmap } from "@/components/TravelHeatmap";

const Stats = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const location = useLocation();

  useEffect(() => {
    setTrips(loadTrips());
  }, [location]);


  return (
    <main className="min-h-screen">
      <AppHeader/>

      <div className="container mx-auto px-6 py-8 space-y-8">
        <StatsSection trips={trips} />
        
        <ContinentsMap trips={trips} />

        <TravelHighlights trips={trips} />

        <TravelHeatmap trips={trips} />
      </div>
    </main>
  );
};

export default Stats;
