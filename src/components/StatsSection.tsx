import { useMemo, useState } from "react";
import { Trip as LocalTrip } from "@/lib/storage";
import { countryFlag } from "@/lib/geo";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarDays, Route, Mountain, MapPin } from "lucide-react";
const earthImg = "https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?w=600&q=80";
const forestImg = "https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&q=80";
import { useSettings, formatDistanceKm, formatAltitudeM } from "@/lib/settings";

// Total recognized sovereign countries (UN members + observers, commonly used as 195)
const TOTAL_COUNTRIES = 195;

interface Props {
  trips: LocalTrip[];
}

export function StatsSection({ trips }: Props) {
  const { distanceUnit } = useSettings();
  const [showAll, setShowAll] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const tripsByCountry = useMemo(() => {
    const map = new Map<string, LocalTrip[]>();
    for (const t of trips) {
      const key = t.country_code || t.country;
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [trips]);


  const countries = useMemo(() => {
    const map = new Map<string, { key: string; name: string; code?: string; visits: number }>();
    for (const t of trips) {
      const key = t.country_code || t.country;
      const existing = map.get(key);
      if (existing) existing.visits += 1;
      else map.set(key, { key, name: t.country, code: t.country_code, visits: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name, "it"));
  }, [trips]);

  const selectedCountry = selectedKey ? countries.find((c) => c.key === selectedKey) ?? null : null;
  const selectedTrips = selectedKey ? (tripsByCountry.get(selectedKey) ?? []).slice().sort((a, b) => b.trip_date.localeCompare(a.trip_date)) : [];

  const count = countries.length;
  const percent = Math.min(100, (count / TOTAL_COUNTRIES) * 100);
  const percentLabel = percent < 1 && percent > 0 ? percent.toFixed(1) : Math.round(percent).toString();

  const visible = showAll ? countries : countries.slice(0, 8);

  return (
    <section className="mb-8 animate-fade-up">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatHero
          image={earthImg}
          alt="Pianeta Terra dallo spazio"
          value={count.toString()}
          label="paesi"
        />
        <StatHero
          image={forestImg}
          alt="Strada nella foresta"
          value={`${percentLabel}%`}
          label="del mondo visto"
        />
      </div>

      <div>
        <h2 className="text-lg font-bold mb-3">Elenco dei paesi</h2>
        {countries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessun paese ancora. Aggiungi il tuo primo viaggio per popolare le statistiche.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {visible.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setSelectedKey(c.key)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/40 border border-border hover:border-primary/40 hover:bg-muted/60 transition-colors cursor-pointer"
              >
                <span className="text-base leading-none">{countryFlag(c.code)}</span>
                <span className="text-sm font-medium">{c.name}</span>
                <span className="text-xs font-semibold text-primary bg-primary/10 rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                  {c.visits}
                </span>
              </button>
            ))}
            {countries.length > 8 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="inline-flex items-center px-3 py-1.5 rounded-full bg-muted/40 border border-border text-sm font-semibold text-primary hover:bg-muted/60 transition-colors"
              >
                {showAll ? "Mostra meno" : `Mostra tutto (${countries.length})`}
              </button>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!selectedCountry} onOpenChange={(o) => !o && setSelectedKey(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <span className="text-2xl leading-none">{countryFlag(selectedCountry?.code)}</span>
              <span>{selectedCountry?.name}</span>
              <span className="text-xs font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">
                {selectedTrips.length} {selectedTrips.length === 1 ? "viaggio" : "viaggi"}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 max-h-[60vh] overflow-y-auto space-y-3 pr-1">
            {selectedTrips.map((t) => (
              <div key={t.id} className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold">{t.title}</div>
                  <div className="inline-flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {formatDateIt(t.trip_date)}
                  </div>
                </div>
                <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" /> {t.city}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Route className="w-4 h-4 text-primary" />
                    <span className="font-semibold">
                      {formatDistanceKm(t.distance_from_home_km, distanceUnit)}
                    </span>
                    <span className="text-xs text-muted-foreground">da casa</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mountain className="w-4 h-4 text-emerald-500" />
                    <span className="font-semibold">
                      {formatAltitudeM(t.altitude_m, distanceUnit)}
                    </span>
                    <span className="text-xs text-muted-foreground">altitudine</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function formatDateIt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function StatHero({
  image, alt, value, label,
}: { image: string; alt: string; value: string; label: string }) {
  return (
    <div className="relative rounded-2xl overflow-hidden aspect-[16/10] group">
      <img
        src={image}
        alt={alt}
        loading="lazy"
        width={1024}
        height={1024}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
      <div className="relative h-full flex flex-col items-center justify-center text-center px-4">
        <div className="text-5xl sm:text-6xl font-extrabold text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)] tracking-tight">
          {value}
        </div>
        <div className="text-sm sm:text-base text-white/90 font-medium mt-1 drop-shadow-md">
          {label}
        </div>
      </div>
    </div>
  );
}
