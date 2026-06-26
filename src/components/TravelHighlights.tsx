import { useMemo } from "react";
import { Mountain, Globe2, Sun, Snowflake, Moon, Compass, Plane, Car, Train } from "lucide-react";
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
    () => trips.filter(t => (t.distance_from_home_km ?? 0) > 1000)
      .reduce((s, t) => s + (t.distance_from_home_km ?? 0), 0),
    [trips]
  );
  const byTrain = useMemo(
    () => trips.filter(t => { const d = t.distance_from_home_km ?? 0; return d >= 200 && d <= 1000; })
      .reduce((s, t) => s + (t.distance_from_home_km ?? 0), 0),
    [trips]
  );
  const byRoad = totalKm - byPlane - byTrain;

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

        {/* 5-cell grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-border border border-border rounded-xl overflow-hidden">
          {[
            { icon: <Globe2 className="w-6 h-6" />, color: "text-primary", val: formatDistanceKm(totalKm, distanceUnit), label: "Totale" },
            { icon: <Compass className="w-6 h-6" />, color: "text-muted-foreground", val: `${aroundWorld.toFixed(2).replace(".",",")}×`, label: "Giri del mondo" },
            { icon: <Moon className="w-6 h-6" />, color: "text-muted-foreground", val: `${toMoon.toFixed(3).replace(".",",")}×`, label: "Alla luna" },
            { icon: <Plane className="w-6 h-6" />, color: "text-blue-400", val: formatDistanceKm(byPlane, distanceUnit), label: "In aereo" },
            { icon: <Train className="w-6 h-6" />, color: "text-amber-400", val: formatDistanceKm(byTrain, distanceUnit), label: "In treno" },
            { icon: <Car className="w-6 h-6" />, color: "text-emerald-400", val: formatDistanceKm(byRoad, distanceUnit), label: "Su strada" },
          ].map(({ icon, color, val, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 py-4 px-2 bg-secondary/20">
              <div className={color}>{icon}</div>
              <div className={`text-sm font-bold font-mono ${color}`}>{val}</div>
              <div className="text-[10px] text-muted-foreground text-center leading-tight">{label}</div>
            </div>
          ))}
        </div>

        {/* Proportional bar */}
        {totalKm > 0 && (
          <div className="mt-4 bg-secondary/30 rounded-xl p-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-2 flex-wrap gap-2">
              <span className="flex items-center gap-1"><Plane className="w-3 h-3 text-blue-400" /> Aereo {Math.round(byPlane / totalKm * 100)}%</span>
              <span className="flex items-center gap-1"><Train className="w-3 h-3 text-amber-400" /> Treno {Math.round(byTrain / totalKm * 100)}%</span>
              <span className="flex items-center gap-1"><Car className="w-3 h-3 text-emerald-400" /> Strada {Math.round(byRoad / totalKm * 100)}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden flex bg-muted">
              <div className="h-full bg-blue-400 transition-all" style={{ width: `${byPlane / totalKm * 100}%` }} />
              <div className="h-full bg-amber-400 transition-all" style={{ width: `${byTrain / totalKm * 100}%` }} />
              <div className="h-full bg-emerald-400 transition-all" style={{ width: `${byRoad / totalKm * 100}%` }} />
            </div>
          </div>
        )}
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
