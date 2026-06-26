import { useMemo } from "react";
import { Trip as LocalTrip } from "@/lib/storage";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useSettings } from "@/lib/settings";
import { TrendingUp } from "lucide-react";

interface Props {
  trips: LocalTrip[];
}

export function TripTimelineChart({ trips }: Props) {
  const { temperatureUnit, distanceUnit } = useSettings();

  const data = useMemo(() => {
    return [...trips]
      .filter((t) => t.temperature_c != null || t.altitude_m != null)
      .sort((a, b) => a.trip_date.localeCompare(b.trip_date))
      .map((t) => {
        const tempC = t.temperature_c;
        const altM = t.altitude_m;
        const temp =
          tempC == null
            ? null
            : temperatureUnit === "fahrenheit"
              ? Math.round((tempC * 9) / 5 + 32)
              : Math.round(tempC);
        const alt =
          altM == null
            ? null
            : distanceUnit === "imperial"
              ? Math.round(altM * 3.28084)
              : Math.round(altM);
        return {
          date: t.trip_date,
          label: `${t.city}, ${t.country}`,
          temp,
          alt,
        };
      });
  }, [trips, temperatureUnit, distanceUnit]);

  const tempUnit = temperatureUnit === "fahrenheit" ? "°F" : "°C";
  const altUnit = distanceUnit === "imperial" ? "ft" : "m";

  if (data.length === 0) {
    return (
      <section className="glass-card p-6">
        <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Andamento temporale
        </h2>
        <p className="text-sm text-muted-foreground">
          Aggiungi temperature o altitudini ai tuoi viaggi per vedere il grafico.
        </p>
      </section>
    );
  }

  return (
    <section className="glass-card p-6 animate-fade-up">
      <div className="mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Andamento temporale
        </h2>
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">
          temperatura e altitudine nel tempo
        </p>
      </div>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickFormatter={(v: string) => v.slice(0, 7)}
            />
            <YAxis
              yAxisId="temp"
              stroke="hsl(var(--primary))"
              fontSize={11}
              tickFormatter={(v) => `${v}${tempUnit}`}
              width={55}
            />
            <YAxis
              yAxisId="alt"
              orientation="right"
              stroke="hsl(var(--accent))"
              fontSize={11}
              tickFormatter={(v) => `${v}${altUnit}`}
              width={60}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(label, payload) => {
                const p = payload?.[0]?.payload as { label?: string } | undefined;
                return p?.label ? `${label} — ${p.label}` : label;
              }}
              formatter={(value: number, name: string) => {
                if (value == null) return ["—", name];
                if (name === "Temperatura") return [`${value}${tempUnit}`, name];
                if (name === "Altitudine") return [`${value}${altUnit}`, name];
                return [value, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temp"
              name="Temperatura"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
            <Line
              yAxisId="alt"
              type="monotone"
              dataKey="alt"
              name="Altitudine"
              stroke="hsl(var(--accent))"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
