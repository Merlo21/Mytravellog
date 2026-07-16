// [FROZEN] — Non modificare senza esplicita richiesta
import { useMemo, useState } from "react";
import { Trip as LocalTrip } from "@/lib/storage";
import { CountryMapModal } from "@/components/CountryMapModal";
const earthImg = "https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?w=600&q=80";
const forestImg = "https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&q=80";

// Total recognized sovereign countries (UN members + observers, commonly used as 195)
const TOTAL_COUNTRIES = 195;

interface Props {
  trips: LocalTrip[];
}

export function StatsSection({ trips }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Ogni viaggio "visita" non solo la destinazione finale ma anche ogni tappa
  // intermedia (waypoint): ha una data, un mezzo di trasporto e coordinate
  // proprie, quindi conta come paese visitato.
  const countriesTouchedByTrip = useMemo(() => {
    return trips.map((t) => {
      const seen = new Map<string, { key: string; name: string; code?: string }>();
      const add = (name: string, code?: string) => {
        const key = code || name;
        if (!seen.has(key)) seen.set(key, { key, name, code });
      };
      add(t.country, t.country_code);
      for (const w of t.waypoints ?? []) add(w.country, w.country_code);
      return { trip: t, countries: Array.from(seen.values()) };
    });
  }, [trips]);

  const tripsByCountry = useMemo(() => {
    const map = new Map<string, LocalTrip[]>();
    for (const { trip: t, countries: cs } of countriesTouchedByTrip) {
      for (const c of cs) {
        const arr = map.get(c.key) ?? [];
        arr.push(t);
        map.set(c.key, arr);
      }
    }
    return map;
  }, [countriesTouchedByTrip]);


  const countries = useMemo(() => {
    const map = new Map<string, { key: string; name: string; code?: string; visits: number }>();
    for (const { countries: cs } of countriesTouchedByTrip) {
      for (const c of cs) {
        const existing = map.get(c.key);
        if (existing) existing.visits += 1;
        else map.set(c.key, { ...c, visits: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name, "it"));
  }, [countriesTouchedByTrip]);

  const selectedCountry = selectedKey ? countries.find((c) => c.key === selectedKey) ?? null : null;
  const selectedTrips = selectedKey ? (tripsByCountry.get(selectedKey) ?? []).slice().sort((a, b) => b.trip_date.localeCompare(a.trip_date)) : [];

  const count = countries.length;
  const percent = Math.min(100, (count / TOTAL_COUNTRIES) * 100);
  const percentLabel = percent < 1 && percent > 0 ? percent.toFixed(1) : Math.round(percent).toString();

  const visible = showAll ? countries : countries.slice(0, 8);

  return (
    <section className="mb-8 animate-fade-up">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
        <StatHero
          image={earthImg}
          alt="Pianeta Terra dallo spazio"
          value={count.toString()}
          label="paesi visitati"
          overlayColor="linear-gradient(135deg, rgba(14,55,100,0.6) 0%, rgba(0,20,60,0.35) 100%)"
        />
        <StatHero
          image={forestImg}
          alt="Strada nella foresta"
          value={`${percentLabel}%`}
          label="del mondo visto"
          overlayColor="linear-gradient(135deg, rgba(10,60,20,0.6) 0%, rgba(5,30,10,0.35) 100%)"
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
                <img
                  src={`https://flagcdn.com/w20/${(c.code || "").toLowerCase()}.png`}
                  width="20" height="14"
                  alt={c.name}
                  style={{ borderRadius:2, objectFit:"cover", flexShrink:0 }}
                  onError={e => { (e.target as HTMLImageElement).style.display="none"; }}
                />
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

      {selectedCountry && (
        <CountryMapModal
          countryCode={selectedCountry.code ?? ""}
          countryName={selectedCountry.name}
          trips={selectedTrips}
          onClose={() => setSelectedKey(null)}
        />
      )}
    </section>
  );
}

function StatHero({
  image, alt, value, label, overlayColor,
}: { image: string; alt: string; value: string; label: string; overlayColor: string }) {
  return (
    <div className="relative rounded-2xl overflow-hidden aspect-[4/3] sm:aspect-[16/10] group">
      <img
        src={image}
        alt={alt}
        loading="lazy"
        width={1024}
        height={1024}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
      {/* Themed overlay — semi-transparent to keep texture visible */}
      <div className="absolute inset-0" style={{background: overlayColor}} />
      {/* Bottom fade for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      <div className="relative h-full flex flex-col items-center justify-center text-center px-2 sm:px-4">
        <div className="text-3xl sm:text-6xl font-extrabold text-white tracking-tight"
          style={{textShadow:"0 2px 20px rgba(0,0,0,0.4)"}}>
          {value}
        </div>
        <div className="text-xs sm:text-base text-white/90 font-medium mt-1"
          style={{textShadow:"0 1px 8px rgba(0,0,0,0.5)"}}>
          {label}
        </div>
      </div>
    </div>
  );
}
