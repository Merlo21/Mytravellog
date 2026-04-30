import { useMemo, useState } from "react";
import { LocalTrip } from "@/lib/storage";
import { countryFlag } from "@/lib/geo";
import earthImg from "@/assets/stat-earth.jpg";
import forestImg from "@/assets/stat-forest.jpg";

// Total recognized sovereign countries (UN members + observers, commonly used as 195)
const TOTAL_COUNTRIES = 195;

interface Props {
  trips: LocalTrip[];
}

export function StatsSection({ trips }: Props) {
  const [showAll, setShowAll] = useState(false);

  const countries = useMemo(() => {
    const map = new Map<string, { name: string; code?: string }>();
    for (const t of trips) {
      const key = t.country_code || t.country;
      if (!map.has(key)) map.set(key, { name: t.country, code: t.country_code });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "it"));
  }, [trips]);

  const count = countries.length;
  const percent = Math.min(100, (count / TOTAL_COUNTRIES) * 100);
  const percentLabel = percent < 1 && percent > 0 ? percent.toFixed(1) : Math.round(percent).toString();

  const visible = showAll ? countries : countries.slice(0, 8);

  if (count === 0) return null;

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
        <div className="flex flex-wrap gap-2">
          {visible.map((c) => (
            <div
              key={c.name}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/40 border border-border hover:border-primary/40 transition-colors"
            >
              <span className="text-base leading-none">{countryFlag(c.code)}</span>
              <span className="text-sm font-medium">{c.name}</span>
            </div>
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
      </div>
    </section>
  );
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
