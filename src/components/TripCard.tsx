import { LocalTrip } from "@/lib/storage";
import { Thermometer, Mountain, Route, Calendar, Trash2 } from "lucide-react";
import { countryFlag } from "@/lib/geo";
import { deleteTrip } from "@/lib/storage";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSettings, formatDistanceKm, formatAltitudeM, formatTemperatureC } from "@/lib/settings";

interface Props {
  trip: LocalTrip;
  selected?: boolean;
  onClick?: () => void;
  onDeleted?: () => void;
}

export function TripCard({ trip, selected, onClick, onDeleted }: Props) {
  const { distanceUnit, temperatureUnit } = useSettings();
  const remove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Eliminare questo viaggio?")) return;
    deleteTrip(trip.id);
    toast.success("Viaggio eliminato");
    onDeleted?.();
  };

  const tempGradient =
    trip.temperature_c == null ? "" :
    trip.temperature_c < 12 ? "bg-gradient-temp-cold" : "bg-gradient-temp-warm";

  return (
    <div
      onClick={onClick}
      className={`glass-card p-4 cursor-pointer transition-all duration-300 hover:border-primary/40 hover:shadow-glow group animate-fade-up
        ${selected ? "border-primary/60 shadow-glow" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl">{countryFlag(trip.country_code)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{trip.title}</h3>
              <p className="text-sm text-muted-foreground truncate">
                {trip.city}, {trip.country}
              </p>
            </div>
            <Button
              size="icon" variant="ghost"
              onClick={remove}
              className="opacity-0 group-hover:opacity-100 transition h-8 w-8 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 font-mono">
            <Calendar className="w-3 h-3" />
            {new Date(trip.trip_date).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
          </div>

          <div className="grid grid-cols-3 gap-1.5 mt-3">
            <div className={`rounded-lg p-2 text-center ${tempGradient || "bg-muted/40"}`}>
              <Thermometer className="w-3 h-3 mx-auto mb-0.5 opacity-80" />
              <div className="font-mono text-xs font-bold">
                {trip.temperature_c != null ? formatTemperatureC(trip.temperature_c, temperatureUnit, 0) : "—"}
              </div>
            </div>
            <div className="rounded-lg p-2 text-center bg-muted/40">
              <Mountain className="w-3 h-3 mx-auto mb-0.5 opacity-80" />
              <div className="font-mono text-xs font-bold">
                {formatAltitudeM(trip.altitude_m, distanceUnit)}
              </div>
            </div>
            <div className="rounded-lg p-2 text-center bg-muted/40">
              <Route className="w-3 h-3 mx-auto mb-0.5 opacity-80" />
              <div className="font-mono text-xs font-bold">
                {formatDistanceKm(trip.distance_from_home_km, distanceUnit)}
              </div>
            </div>
          </div>

          {trip.notes && (
            <p className="text-xs text-muted-foreground mt-2.5 line-clamp-2 italic">"{trip.notes}"</p>
          )}
        </div>
      </div>
    </div>
  );
}
