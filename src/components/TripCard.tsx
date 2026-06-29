// [FROZEN] — Non modificare senza esplicita richiesta
import { useState } from "react";
import { Trip, deleteTrip, formatTripDate } from "@/lib/storage";
import { countryFlag } from "@/lib/geo";
import { fmtDistance, fmtAltitude, fmtTemp, useSettings } from "@/lib/settings";
import { Thermometer, Mountain, Trash2, Pencil, Plane, Train, Car, Ship, Footprints, Route } from "lucide-react";
import { useNavigate } from "react-router-dom";
import React from "react";

interface Props {
  trip: Trip;
  selected?: boolean;
  onClick?: () => void;
  onDeleted?: () => void;
  onUpdated?: () => void;
}

const TRANSPORT_STYLE: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  plane: { color: "#378ADD", bg: "rgba(55,138,221,0.12)", icon: <Plane className="w-3 h-3"/> },
  train: { color: "#BA7517", bg: "rgba(186,117,23,0.12)", icon: <Train className="w-3 h-3"/> },
  car:   { color: "#639922", bg: "rgba(99,153,34,0.12)",  icon: <Car className="w-3 h-3"/> },
  ship:  { color: "#0F6E56", bg: "rgba(15,110,86,0.12)",  icon: <Ship className="w-3 h-3"/> },
  walk:  { color: "#D85A30", bg: "rgba(216,90,48,0.12)",  icon: <Footprints className="w-3 h-3"/> },
};
const DEFAULT_STYLE = { color: "#60a5fa", bg: "rgba(96,165,250,0.12)", icon: <Route className="w-3 h-3"/> };

function StarDisplay({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{
          fontSize: "12px",
          color: i <= rating ? "#fbbf24" : "rgba(255,255,255,0.15)"
        }}>★</span>
      ))}
    </div>
  );
}

export function TripCard({ trip, selected, onClick, onDeleted, onUpdated }: Props) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { distanceUnit, temperatureUnit } = useSettings();
  const ts = TRANSPORT_STYLE[trip.transport_mode ?? ""] ?? DEFAULT_STYLE;
  const flag = countryFlag(trip.country_code ?? "");

  const handleDelete = () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    deleteTrip(trip.id);
    onDeleted?.();
  };

  // Title: use custom title if different from city name
  const displayTitle = trip.title && trip.title !== trip.city ? trip.title : trip.city;
  const showSubtitle = trip.title && trip.title !== trip.city;

  return (
    <>
      <div onClick={onClick}
        className="glass-card p-4 cursor-pointer transition-all duration-200 animate-fade-up"
        style={{
          borderLeft: `3px solid ${ts.color}`,
          outline: selected ? `1.5px solid ${ts.color}` : "none",
          outlineOffset: "1px",
        }}>

        <div className="flex items-start gap-3">
          {/* Flag */}
          <div className="text-2xl flex-shrink-0 mt-0.5">{flag}</div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Title + stars */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-foreground leading-tight">{displayTitle}</div>
                {showSubtitle && (
                  <div className="text-xs text-muted-foreground mt-0.5">{trip.city}, {trip.country}</div>
                )}
                {!showSubtitle && (
                  <div className="text-xs text-muted-foreground mt-0.5">{trip.country}</div>
                )}
              </div>
              <StarDisplay rating={trip.rating ?? null} />
            </div>

            {/* Date */}
            <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
              <span>{formatTripDate(trip.trip_date)}</span>
              {trip.date_end && trip.date_end !== trip.trip_date && (
                <>
                  <span style={{color:"rgba(255,255,255,0.2)"}}>→</span>
                  <span>{formatTripDate(trip.date_end)}</span>
                </>
              )}
            </div>

            {/* Pills */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {trip.transport_mode && (() => {
                const s = TRANSPORT_STYLE[trip.transport_mode] ?? DEFAULT_STYLE;
                return (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{background: s.bg, color: s.color}}>
                    {s.icon}
                    {{plane:"Aereo",train:"Treno",car:"Auto",ship:"Nave",walk:"A piedi"}[trip.transport_mode]}
                  </span>
                );
              })()}
              {trip.distance_from_home_km != null && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground">
                  {fmtDistance(trip.distance_from_home_km, distanceUnit)}
                </span>
              )}
              {trip.altitude_m != null && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground">
                  <Mountain className="w-2.5 h-2.5"/> {fmtAltitude(trip.altitude_m, distanceUnit)}
                </span>
              )}
              {trip.temperature_c != null && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground">
                  <Thermometer className="w-2.5 h-2.5"/> {fmtTemp(trip.temperature_c, temperatureUnit)}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={e => { e.stopPropagation(); navigate(`/modifica-viaggio/${trip.id}`); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-secondary/60">
              <Pencil className="w-3.5 h-3.5 text-muted-foreground"/>
            </button>
            <button onClick={e => { e.stopPropagation(); handleDelete(); }}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${confirmDelete ? "bg-red-500/20" : "hover:bg-secondary/60"}`}>
              <Trash2 className={`w-3.5 h-3.5 ${confirmDelete ? "text-red-400" : "text-muted-foreground"}`}/>
            </button>
          </div>
        </div>
      </div>

    </>
  );
}
