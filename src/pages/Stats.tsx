import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadTrips, Trip, formatTripDate } from "@/lib/storage";
import { countryFlag } from "@/lib/geo";
import { fmtDistance, fmtAltitude, fmtTemp, useSettings } from "@/lib/settings";
import { ArrowLeft, Compass, Thermometer, Mountain, Route, Globe } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const TOTAL_COUNTRIES = 195;

export default function Stats() {
  const { distanceUnit, temperatureUnit } = useSettings();
  const [trips, setTrips] = useState<Trip[]>([]);
  useEffect(() => { setTrips(loadTrips()); }, []);

  const countries = useMemo(() => {
    const map = new Map<string, { key: string; name: string; code: string; visits: number }>();
    for (const t of trips) {
      const key = t.country_code || t.country;
      const ex = map.get(key);
      if (ex) ex.visits++;
      else map.set(key, { key, name: t.country, code: t.country_code, visits: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.visits - a.visits);
  }, [trips]);

  const highlights = useMemo(() => {
    const withTemp = trips.filter((t) => t.temperature_c != null);
    const withAlt = trips.filter((t) => t.altitude_m != null);
    const withDist = trips.filter((t) => t.distance_from_home_km != null);
    return {
      hottest: withTemp.length ? withTemp.reduce((a, b) => (a.temperature_c! > b.temperature_c! ? a : b)) : null,
      coldest: withTemp.length ? withTemp.reduce((a, b) => (a.temperature_c! < b.temperature_c! ? a : b)) : null,
      highest: withAlt.length ? withAlt.reduce((a, b) => (a.altitude_m! > b.altitude_m! ? a : b)) : null,
      farthest: withDist.length ? withDist.reduce((a, b) => (a.distance_from_home_km! > b.distance_from_home_km! ? a : b)) : null,
    };
  }, [trips]);

  const timelineData = useMemo(() => {
    const byYear = new Map<string, number>();
    for (const t of trips) {
      const y = t.trip_date.slice(0, 4);
      byYear.set(y, (byYear.get(y) ?? 0) + 1);
    }
    return Array.from(byYear.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([year, count]) => ({ year, count }));
  }, [trips]);

  const pct = Math.min(100, (countries.length / TOTAL_COUNTRIES) * 100);

  return (
    <main className="min-h-screen">
      <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Compass className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none">Statistiche</h1>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">il tuo atlante in numeri</p>
            </div>
          </div>
          <Link to="/" className="btn-ghost text-sm flex items-center gap-2 py-1.5 px-3">
            <ArrowLeft className="w-4 h-4" /> Indietro
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
        <>
            {/* Countries overview */}
            <section className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg">{countries.length} paesi visitati</h2>
                <span className="text-sm text-muted-foreground font-mono">{pct < 1 ? pct.toFixed(1) : Math.round(pct)}% del mondo</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full mb-5">
                <div className="h-2 bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex flex-wrap gap-2">
                {countries.map((c) => (
                  <div key={c.key} className="flex items-center gap-1.5 bg-secondary/60 rounded-lg px-3 py-1.5 text-sm">
                    <span>{countryFlag(c.code)}</span>
                    <span className="font-medium">{c.name}</span>
                    {c.visits > 1 && <span className="text-xs text-muted-foreground font-mono">×{c.visits}</span>}
                  </div>
                ))}
              </div>
            </section>

            {/* Timeline */}
            {timelineData.length > 0 && (
              <section className="glass-card p-6">
                <h2 className="font-bold text-lg mb-4">Viaggi per anno</h2>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={timelineData} barSize={28}>
                    <XAxis dataKey="year" tick={{ fill: "#888", fontSize: 12, fontFamily: "ui-monospace" }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ background: "hsl(222 25% 10%)", border: "1px solid hsl(220 20% 18%)", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "#e2e8f0" }}
                      formatter={(v: number) => [`${v} viaggi`, ""]}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {timelineData.map((_, i) => (
                        <Cell key={i} fill={i === timelineData.length - 1 ? "hsl(186 85% 55%)" : "hsl(220 20% 22%)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </section>
            )}

            {/* Highlights */}
            <section className="glass-card p-6">
              <h2 className="font-bold text-lg mb-4">Record personali</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: <Thermometer className="w-4 h-4" />, label: "Più caldo", trip: highlights.hottest, val: (t: Trip) => fmtTemp(t.temperature_c, temperatureUnit) },
                  { icon: <Thermometer className="w-4 h-4" />, label: "Più freddo", trip: highlights.coldest, val: (t: Trip) => fmtTemp(t.temperature_c, temperatureUnit) },
                  { icon: <Mountain className="w-4 h-4" />, label: "Più alto", trip: highlights.highest, val: (t: Trip) => fmtAltitude(t.altitude_m, distanceUnit) },
                  { icon: <Route className="w-4 h-4" />, label: "Più lontano", trip: highlights.farthest, val: (t: Trip) => fmtDistance(t.distance_from_home_km, distanceUnit) },
                ].map(({ icon, label, trip, val }) => (
                  <div key={label} className="bg-secondary/40 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">{icon} {label}</div>
                    {trip ? (
                      <>
                        <div className="font-bold">{countryFlag(trip.country_code)} {trip.city}</div>
                        <div className="font-mono text-primary text-sm mt-0.5">{val(trip)}</div>
                        <div className="text-xs text-muted-foreground mt-1">{formatTripDate(trip.trip_date)}</div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">—</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
        </>
      </div>
    </main>
  );
}
