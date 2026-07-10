import { useMemo, Fragment } from "react";
import { Trip, parseLocalDate } from "@/lib/storage";
import { Hourglass } from "lucide-react";

const MONTH_LABELS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

/**
 * Giorni di viaggio (trip_date..date_end inclusi) per ogni mese, aggregati
 * per anno — usati per l'intensità della heatmap. Un viaggio a cavallo tra
 * due mesi/anni contribuisce a entrambi in proporzione ai giorni effettivi.
 */
export function computeMonthlyTravelDays(trips: Trip[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of trips) {
    const start = parseLocalDate(t.trip_date);
    const end = t.date_end ? parseLocalDate(t.date_end) : start;
    if (end < start) continue;
    const cur = new Date(start);
    while (cur <= end) {
      const key = `${cur.getFullYear()}-${cur.getMonth()}`;
      map.set(key, (map.get(key) ?? 0) + 1);
      cur.setDate(cur.getDate() + 1);
    }
  }
  return map;
}

/** Giorni trascorsi dalla fine dell'ultimo viaggio (0 se in corso oggi). */
export function daysSinceLastTrip(trips: Trip[]): number | null {
  if (trips.length === 0) return null;
  let lastEnd = parseLocalDate(trips[0].date_end || trips[0].trip_date);
  for (const t of trips) {
    const end = parseLocalDate(t.date_end || t.trip_date);
    if (end > lastEnd) lastEnd = end;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - lastEnd.getTime()) / 86400000);
  return Math.max(0, diff);
}

interface Props {
  trips: Trip[];
}

export function TravelHeatmap({ trips }: Props) {
  const monthlyDays = useMemo(() => computeMonthlyTravelDays(trips), [trips]);
  const abstinence = useMemo(() => daysSinceLastTrip(trips), [trips]);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    if (trips.length === 0) return [currentYear];
    const earliest = trips.reduce((min, t) => Math.min(min, parseLocalDate(t.trip_date).getFullYear()), currentYear);
    const out: number[] = [];
    for (let y = earliest; y <= currentYear; y++) out.push(y);
    return out;
  }, [trips]);

  const maxDays = useMemo(() => Math.max(1, ...Array.from(monthlyDays.values())), [monthlyDays]);

  const cellColor = (days: number) => {
    if (days === 0) return "rgba(255,255,255,0.06)";
    const alpha = 0.18 + (days / maxDays) * 0.82;
    return `rgba(96,165,250,${alpha.toFixed(2)})`;
  };

  return (
    <div className="glass-card p-5 animate-fade-up">
      <div className="flex items-center gap-3 mb-5">
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(96,165,250,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Hourglass className="w-5 h-5" style={{ color: "#60a5fa" }} />
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#f0f4ff", lineHeight: 1 }}>
            {abstinence == null ? "—" : abstinence}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>giorni senza viaggiare</div>
        </div>
      </div>

      <h2 className="text-lg font-bold mb-4">Anni e mesi di viaggio</h2>

      <div style={{ display: "grid", gridTemplateColumns: "34px repeat(12,1fr)", gap: 4, alignItems: "center" }}>
        <div />
        {MONTH_LABELS.map(m => (
          <div key={m} style={{ fontSize: 9, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>{m}</div>
        ))}
        {years.map(year => (
          <Fragment key={year}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{year}</div>
            {MONTH_LABELS.map((label, m) => {
              const days = monthlyDays.get(`${year}-${m}`) ?? 0;
              return (
                <div key={`${year}-${m}`}
                  title={`${label} ${year}: ${days} giorn${days === 1 ? "o" : "i"} di viaggio`}
                  style={{ aspectRatio: "1", borderRadius: 4, background: cellColor(days) }} />
              );
            })}
          </Fragment>
        ))}
      </div>

      <div className="flex items-center justify-end gap-1.5 mt-3.5">
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>meno</span>
        {[0, 0.25, 0.5, 0.75, 1].map(a => (
          <div key={a} style={{ width: 10, height: 10, borderRadius: 3, background: a === 0 ? "rgba(255,255,255,0.06)" : `rgba(96,165,250,${a})` }} />
        ))}
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>più</span>
      </div>
    </div>
  );
}
