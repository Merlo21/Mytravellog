import { useState } from "react";
import { Trip, deleteTrip, formatTripDate } from "@/lib/storage";
import { countryFlag } from "@/lib/geo";
import { fmtDistance, fmtAltitude, fmtTemp, useSettings } from "@/lib/settings";
import { Thermometer, Mountain, Route, Calendar, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { EditTripDialog } from "./EditTripDialog";

interface Props {
  trip: Trip;
  selected?: boolean;
  onClick?: () => void;
  onDeleted?: () => void;
  onUpdated?: () => void;
}

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
      className={`glass-card p-4 cursor-pointer transition-all duration-200 hover:border-primary/40 animate-fade-up ${selected ? "border-primary/60" : ""}`}>
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
