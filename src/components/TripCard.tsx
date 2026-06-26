import { useState } from "react";
import { Trip, deleteTrip, formatTripDate } from "@/lib/storage";
import { countryFlag } from "@/lib/geo";
import { fmtDistance, fmtAltitude, fmtTemp, useSettings } from "@/lib/settings";
import { Thermometer, Mountain, Route, Calendar, Trash2, Pencil, Plane, Train, Car, Ship, Footprints } from "lucide-react";
import { toast } from "sonner";
import { EditTripDialog } from "./EditTripDialog";

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

export function TripCard({ trip, selected, onClick, onDeleted, onUpdated }: Props) {
  const { distanceUnit, temperatureUnit } = useSettings();
  const [editOpen, setEditOpen] = useState(false);

  const remove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Eliminare questo viaggio?")) return;
    deleteTrip(trip.id);
    toast.success("Viaggio eliminato");
    onDeleted?.();
  };

  return (
    <div onClick={onClick}
      className="glass-card p-4 cursor-pointer transition-all duration-200 animate-fade-up"
      style={{
        borderLeft: `3px solid ${(TRANSPORT_STYLE[trip.transport_mode ?? ""] ?? DEFAULT_STYLE).color}`,
        borderColor: selected ? (TRANSPORT_STYLE[trip.transport_mode ?? ""] ?? DEFAULT_STYLE).color : undefined,
      }}>
      <div className="flex items-start gap-3">
        <div className="text-3xl">{countryFlag(trip.country_code)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold truncate text-sm">{trip.title}</h3>
              <p className="text-xs text-muted-foreground truncate">{trip.city}, {trip.country}</p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors" aria-label="Modifica">
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button onClick={remove}
                className="p-1.5 rounded-lg hover:bg-destructive/20 transition-colors" aria-label="Elimina">
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 font-mono">
            <Calendar className="w-3 h-3" />
            {formatTripDate(trip.trip_date)}
          </div>

          <div className="grid grid-cols-3 gap-1.5 mt-2.5">
            {[
              { icon: <Thermometer className="w-3 h-3 mx-auto mb-0.5 opacity-70" />, val: fmtTemp(trip.temperature_c, temperatureUnit) },
              { icon: <Mountain className="w-3 h-3 mx-auto mb-0.5 opacity-70" />, val: fmtAltitude(trip.altitude_m, distanceUnit) },
              { icon: <Route className="w-3 h-3 mx-auto mb-0.5 opacity-70" />, val: fmtDistance(trip.distance_from_home_km, distanceUnit) },
            ].map(({ icon, val }, i) => (
              <div key={i} className="rounded-lg p-2 text-center bg-muted/40">
                {icon}
                <div className="font-mono text-xs font-semibold">{val}</div>
              </div>
            ))}
          </div>

          {trip.notes && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">"{trip.notes}"</p>
          )}
        </div>
      </div>

      <EditTripDialog trip={trip} open={editOpen} onOpenChange={setEditOpen} onSaved={onUpdated} />
    </div>
  );
}
