import { Link } from "react-router-dom";
import { Plane, PieChart, Settings, Plus } from "lucide-react";

interface Props {
  onTripsClick?: () => void; // solo Index ne ha bisogno per aprire la sidebar
}

export function AppHeader({ onTripsClick }: Props) {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-20">
      <div className="container mx-auto px-6 py-3 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#60a5fa" }}>
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
            <span style={{ color: "#60a5fa" }}>NAV</span>
            <span style={{ color: "#fbbf24" }}>·</span>
            <span>TA</span>
          </h1>
        </div>

        {/* Nav */}
        <div className="flex items-center gap-1">
          {onTripsClick ? (
            <button onClick={onTripsClick}
              className="btn-ghost text-sm flex items-center gap-2 py-1.5 px-3">
              <Plane className="w-4 h-4 text-primary"/> I tuoi viaggi
            </button>
          ) : (
            <Link to="/" className="btn-ghost text-sm flex items-center gap-2 py-1.5 px-3">
              <Plane className="w-4 h-4 text-primary"/> I tuoi viaggi
            </Link>
          )}
          <Link to="/statistiche" className="btn-ghost text-sm flex items-center gap-2 py-1.5 px-3">
            <PieChart className="w-4 h-4 text-primary"/> Statistiche
          </Link>
          <div className="w-px h-5 bg-border mx-1"/>
          <Link to="/impostazioni" className="btn-ghost p-2" aria-label="Impostazioni">
            <Settings className="w-4 h-4 text-muted-foreground"/>
          </Link>
          <Link to="/nuovo-viaggio"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors hover:bg-primary/10"
            style={{ color: "#60a5fa", border: "1.5px solid #60a5fa" }}>
            <Plus className="w-4 h-4"/> Nuovo viaggio
          </Link>
        </div>

      </div>
    </header>
  );
}
