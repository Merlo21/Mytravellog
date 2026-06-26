import { useMemo } from "react";
import { Mountain, Globe2, Sun, Snowflake, Moon, Compass, Plane, Car } from "lucide-react";
import { Trip as LocalTrip } from "@/lib/storage";
import { useSettings, formatDistanceKm, formatAltitudeM, formatTemperatureC } from "@/lib/settings";

interface Props {
  trips: LocalTrip[];
}

const EARTH_CIRCUMFERENCE_KM = 40075;
const DISTANCE_TO_MOON_KM = 384400;

export function TravelHighlights({ trips }: Props) {
  const { distanceUnit, temperatureUnit } = useSettings();
  const highest = useMemo(
    () => trips.filter(t => t.altitude_m != null).sort((a, b) => (b.altitude_m! - a.altitude_m!))[0],
    [trips]
  );
  const farthest = useMemo(
    () => trips.filter(t => t.distance_from_home_km != null).sort((a, b) => (b.distance_from_home_km! - a.distance_from_home_km!))[0],
    [trips]
  );
  const hottest = useMemo(
    () => trips.filter(t => t.temperature_c != null).sort((a, b) => (b.temperature_c! - a.temperature_c!))[0],
    [trips]
  );
  const coldest = useMemo(
    () => trips.filter(t => t.temperature_c != null).sort((a, b) => (a.temperature_c! - b.temperature_c!))[0],
    [trips]
  );

  const totalKm = useMemo(
    () => trips.reduce((sum, t) => sum + (t.distance_from_home_km ?? 0), 0),
    [trips]
  );
  const aroundWorld = totalKm / EARTH_CIRCUMFERENCE_KM;
  const toMoon = totalKm / DISTANCE_TO_MOON_KM;

  const byPlane = useMemo(
    () => trips.filter(t => (t.distance_from_home_km ?? 0) > 500)
      .reduce((s, t) => s + (t.distance_from_home_km ?? 0), 0),
    [trips]
  );
  const byRoad = totalKm - byPlane;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <HighlightCard
          icon={<Mountain className="w-12 h-12" strokeWidth={1.5} />}
          color="text-emerald-500"
          label="Altitudine più alta"
          value={highest ? formatAltitudeM(highest.altitude_m, distanceUnit) : "—"}
          sub={highest?.city}
        />
        <HighlightCard
          icon={<Globe2 className="w-12 h-12" strokeWidth={1.5} />}
          color="text-pink-500"
          label="Più distante da casa"
          value={farthest ? formatDistanceKm(farthest.distance_from_home_km, distanceUnit) : "—"}
          sub={farthest?.city}
        />
        <HighlightCard
          icon={<Sun className="w-12 h-12" strokeWidth={1.5} />}
          color="text-orange-500"
          label="Il posto più caldo"
          value={hottest ? formatTemperatureC(hottest.temperature_c, temperatureUnit) : "—"}
          sub={hottest?.city}
        />
        <HighlightCard
          icon={<Snowflake className="w-12 h-12" strokeWidth={1.5} />}
          color="text-sky-500"
          label="Il posto più freddo"
          value={coldest ? formatTemperatureC(coldest.temperature_c, temperatureUnit) : "—"}
          sub={coldest?.city}
        />
      </div>

      <div className="glass-card p-6">
        <h2 className="text-lg font-bold mb-4">Distanze</h2>
        <div className="border-t border-border pt-6 flex flex-col items-center text-center">
          <Globe2 className="w-20 h-20 text-primary mb-3" strokeWidth={1.5} />
          <div className="text-3xl font-extrabold tracking-tight">
            {formatDistanceKm(totalKm, distanceUnit)}
          </div>
          <div className="text-sm text-muted-foreground mt-1">{distanceUnit === "imperial" ? "miglia percorse" : "chilometri percorsi"}</div>
        </div>

        <div className="border-t border-border mt-6 pt-5 grid grid-cols-2 gap-4 text-center">
          <div className="flex flex-col items-center">
            <Compass className="w-7 h-7 text-primary mb-2" strokeWidth={1.8} />
            <div className="text-xl font-bold">
              {aroundWorld.toFixed(1).replace(".", ",")} <span className="text-sm font-semibold">x</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Intorno al mondo</div>
          </div>
          <div className="flex flex-col items-center">
            <Moon className="w-7 h-7 text-primary mb-2" strokeWidth={1.8} />
            <div className="text-xl font-bold">
              {toMoon.toFixed(1).replace(".", ",")} <span className="text-sm font-semibold">x</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">alla luna</div>
          </div>
        </div>

        <div className="border-t border-border mt-5 pt-5 grid grid-cols-2 gap-4 text-center">
          <div className="flex flex-col items-center">
            <Plane className="w-7 h-7 text-blue-400 mb-2" strokeWidth={1.8} />
            <div className="text-xl font-bold text-blue-400">
              {formatDistanceKm(byPlane, distanceUnit)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">In aereo</div>
          </div>
          <div className="flex flex-col items-center">
            <Car className="w-7 h-7 text-emerald-400 mb-2" strokeWidth={1.8} />
            <div className="text-xl font-bold text-emerald-400">
              {formatDistanceKm(byRoad, distanceUnit)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Su strada</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HighlightCard({
  icon, color, label, value, sub,
}: { icon: React.ReactNode; color: string; label: string; value: string; sub?: string }) {
  return (
    <div className="glass-card p-5 flex flex-col items-center text-center">
      <div className={color}>{icon}</div>
      <div className="text-2xl font-extrabold mt-3 tracking-tight">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      <div className={`text-sm font-semibold mt-2 ${color}`}>{label}</div>
    </div>
  );
}
