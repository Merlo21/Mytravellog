import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { searchPlaces, fetchElevation, fetchTemperature, distanceKm, countryFlag, GeoResult } from "@/lib/geo";
import { addTrip } from "@/lib/storage";
import { fmtDistance, useSettings } from "@/lib/settings";
import { toast } from "sonner";
import { Plus, Search, Loader2, MapPin, X, Plane, Train, Car, Ship, Footprints } from "lucide-react";

interface Props {
  onCreated: () => void;
  defaultHome?: { lat: number; lon: number; label: string } | null;
  prefilledCity?: { name: string; country: string; country_code: string; latitude: number; longitude: number } | null;
  triggerLabel?: string;
}

type Waypoint = { city: string; country: string; country_code: string; lat: number; lon: number; transport_mode: TransportMode };
type TransportMode = "plane" | "train" | "car" | "ship" | "walk";

const TRANSPORT: { value: TransportMode; label: string; color: string; bg: string; icon: React.ReactNode }[] = [
  { value: "plane", label: "Aereo",   color: "#378ADD", bg: "rgba(55,138,221,0.15)",  icon: <Plane className="w-3.5 h-3.5"/> },
  { value: "train", label: "Treno",   color: "#BA7517", bg: "rgba(186,117,23,0.15)",  icon: <Train className="w-3.5 h-3.5"/> },
  { value: "car",   label: "Auto",    color: "#639922", bg: "rgba(99,153,34,0.15)",   icon: <Car className="w-3.5 h-3.5"/> },
  { value: "ship",  label: "Nave",    color: "#0F6E56", bg: "rgba(15,110,86,0.15)",   icon: <Ship className="w-3.5 h-3.5"/> },
  { value: "walk",  label: "A piedi", color: "#D85A30", bg: "rgba(216,90,48,0.15)",   icon: <Footprints className="w-3.5 h-3.5"/> },
];

const RATING_LABELS: Record<number, string> = { 1: "Non memorabile", 2: "Nella media", 3: "Bello", 4: "Fantastico", 5: "Indimenticabile" };

function daysBetween(a: string, b: string) {
  if (!a || !b) return null;
  const diff = new Date(b).getTime() - new Date(a).getTime();
  const d = Math.round(diff / 86400000);
  return d > 0 ? d : null;
}

function RouteArcs({ waypoints, home }: { waypoints: Waypoint[]; home: { label: string } | null }) {
  const allStops = [
    { label: home?.label ?? "Casa", flag: "🏠", isHome: true, transport: null as TransportMode | null },
    ...waypoints.map(w => ({ label: w.city, flag: countryFlag(w.country_code), isHome: false, transport: w.transport_mode })),
  ];

  if (allStops.length < 2) return (
    <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
      Aggiungi almeno una città
    </div>
  );

  const W = 420, H = 130;
  const n = allStops.length;
  const pad = 50;
  const step = n > 1 ? (W - pad * 2) / (n - 1) : 0;
  const cx = (i: number) => pad + i * step;
  const cy = 90;
  const r = 20;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible", minWidth: W }}>
      <defs>
        {TRANSPORT.map(t => (
          <marker key={t.value} id={`arr-${t.value}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={t.color} opacity="0.8"/>
          </marker>
        ))}
      </defs>

      {allStops.map((stop, i) => {
        if (i === 0) return null;
        const prev = allStops[i - 1];
        const t = TRANSPORT.find(t => t.value === stop.transport) ?? TRANSPORT[0];
        const x1 = cx(i - 1), x2 = cx(i);
        const mx = (x1 + x2) / 2;
        const arcH = Math.min(60, Math.max(25, (x2 - x1) * 0.35));
        return (
          <g key={i}>
            <path
              d={`M ${x1} ${cy} Q ${mx} ${cy - arcH} ${x2} ${cy}`}
              stroke={t.color} strokeWidth="1.8" strokeDasharray="5 3"
              fill="none" opacity="0.6"
              markerEnd={`url(#arr-${t.value})`}
            />
            <rect x={mx - 28} y={cy - arcH - 14} width="56" height="18" rx="9"
              fill={t.bg} stroke={t.color} strokeWidth="0.5" strokeOpacity="0.6"/>
            <text x={mx} y={cy - arcH - 2} fontSize="9.5" textAnchor="middle" fill={t.color}>
              {t.label}
            </text>
          </g>
        );
      })}

      {allStops.map((stop, i) => {
        const x = cx(i);
        const isLast = i === allStops.length - 1;
        const lastT = isLast && allStops.length > 1
          ? TRANSPORT.find(t => t.value === allStops[i].transport) ?? TRANSPORT[0]
          : null;
        const borderColor = stop.isHome ? "#fbbf24" : lastT ? lastT.color : "#60a5fa";
        const bgColor = stop.isHome ? "rgba(251,191,36,0.1)" : lastT ? lastT.bg : "rgba(96,165,250,0.08)";
        const nodeR = isLast ? r + 3 : r;
        return (
          <g key={i}>
            <circle cx={x} cy={cy} r={nodeR} fill={bgColor} stroke={borderColor} strokeWidth={isLast ? 2 : 1.5}/>
            <text x={x} y={cy + 5} fontSize={isLast ? 17 : 16} textAnchor="middle" dominantBaseline="middle">
              {stop.flag}
            </text>
            <text x={x} y={cy + nodeR + 10} fontSize="9" textAnchor="middle"
              fill={isLast ? borderColor : "rgba(255,255,255,0.45)"}
              fontWeight={isLast ? "600" : "normal"}>
              {stop.label.length > 8 ? stop.label.slice(0, 7) + "…" : stop.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function NewTripDialog({ onCreated, defaultHome, prefilledCity, triggerLabel }: Props) {
  const [open, setOpen] = useState(false);
  const { distanceUnit } = useSettings();

  // Form state
  const [title, setTitle] = useState("");
  const [dateStart, setDateStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateEnd, setDateEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);

  // Waypoints (the route)
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [wpQuery, setWpQuery] = useState("");
  const [wpResults, setWpResults] = useState<GeoResult[]>([]);
  const [wpTransport, setWpTransport] = useState<TransportMode>("plane");
  const [wpLoading, setWpLoading] = useState(false);

  // Home
  const [home, setHome] = useState<{ lat: number; lon: number; label: string } | null>(defaultHome ?? null);
  const [homeQuery, setHomeQuery] = useState(defaultHome?.label ?? "");
  const [homeResults, setHomeResults] = useState<GeoResult[]>([]);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (prefilledCity && open) {
      setWaypoints([{
        city: prefilledCity.name,
        country: prefilledCity.country,
        country_code: prefilledCity.country_code,
        lat: prefilledCity.latitude,
        lon: prefilledCity.longitude,
        transport_mode: "plane",
      }]);
    }
  }, [prefilledCity, open]);

  useEffect(() => {
    if (defaultHome) { setHome(defaultHome); setHomeQuery(defaultHome.label); }
  }, [defaultHome]);

  const searchWp = async (q: string) => {
    setWpQuery(q);
    if (q.length < 2) { setWpResults([]); return; }
    setWpLoading(true);
    const r = await searchPlaces(q);
    setWpResults(r.slice(0, 5));
    setWpLoading(false);
  };

  const addWaypoint = (r: GeoResult) => {
    setWaypoints(prev => [...prev, {
      city: r.name, country: r.country, country_code: r.country_code ?? "",
      lat: r.lat, lon: r.lon, transport_mode: wpTransport,
    }]);
    setWpQuery(""); setWpResults([]);
  };

  const removeWaypoint = (i: number) => setWaypoints(prev => prev.filter((_, idx) => idx !== i));

  const updateWpTransport = (i: number, mode: TransportMode) =>
    setWaypoints(prev => prev.map((w, idx) => idx === i ? { ...w, transport_mode: mode } : w));

  const reset = () => {
    setTitle(""); setDateStart(new Date().toISOString().slice(0, 10));
    setDateEnd(""); setNotes(""); setRating(0); setWaypoints([]);
    setWpQuery(""); setWpResults([]);
  };

  const handleSave = async () => {
    if (waypoints.length === 0) { toast.error("Aggiungi almeno una città all'itinerario"); return; }
    setSaving(true);
    const dest = waypoints[waypoints.length - 1];
    const dist = home ? distanceKm(home.lat, home.lon, dest.lat, dest.lon) : null;
    const [alt, temp] = await Promise.all([
      fetchElevation(dest.lat, dest.lon),
      fetchTemperature(dest.lat, dest.lon),
    ]);
    addTrip({
      title: title.trim() || dest.city,
      country: dest.country,
      city: dest.city,
      trip_date: dateStart,
      date_end: dateEnd || null,
      notes: notes.trim() || null,
      transport_mode: dest.transport_mode,
      waypoints: waypoints.slice(0, -1).map(w => ({ city: w.city, country: w.country, transport_mode: w.transport_mode })),
      latitude: dest.lat,
      longitude: dest.lon,
      home_latitude: home?.lat ?? null,
      home_longitude: home?.lon ?? null,
      distance_from_home_km: dist,
      altitude_m: alt,
      temperature_c: temp,
      country_code: dest.country_code,
      rating: rating || null,
    });
    toast.success("Viaggio salvato!");
    setSaving(false);
    setOpen(false);
    reset();
    onCreated();
  };

  const days = daysBetween(dateStart, dateEnd);

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors hover:bg-primary/10"
        style={{ color: "#60a5fa", border: "1.5px solid #60a5fa" }}>
        <Plus className="w-4 h-4"/> {triggerLabel || "Nuovo viaggio"}
      </button>

      {open && createPortal(
        <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.75)",backdropFilter:"blur(6px)"}}
          onClick={e => { if (e.target === e.currentTarget) { setOpen(false); reset(); } }}>
          <div className="glass-card w-full max-w-lg mx-4 overflow-hidden"
            style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(96,165,250,0.12)" }}>
                <MapPin className="w-4 h-4" style={{ color: "#60a5fa" }}/>
              </div>
              <h2 className="text-base font-bold flex-1">Nuovo viaggio</h2>
              <button onClick={() => { setOpen(false); reset(); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary/60">
                <X className="w-4 h-4 text-muted-foreground"/>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

              {/* Nome */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">Nome del viaggio</label>
                <input className="input-field w-full" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="Es. Viaggio di nozze, Tokyo 2024…"/>
              </div>

              {/* Periodo */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">Periodo</label>
                <div className="flex items-stretch rounded-xl overflow-hidden border border-border">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-secondary/20">
                    <Plane className="w-3.5 h-3.5 text-primary flex-shrink-0" style={{transform:"rotate(-45deg)"}}/>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Partenza</div>
                      <input type="date" className="bg-transparent text-sm font-medium outline-none w-full"
                        value={dateStart} onChange={e => setDateStart(e.target.value)}/>
                    </div>
                  </div>
                  <div className="w-px bg-border"/>
                  <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-secondary/20">
                    <Plane className="w-3.5 h-3.5 text-primary flex-shrink-0" style={{transform:"rotate(45deg) scaleX(-1)"}}/>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Ritorno</div>
                      <input type="date" className="bg-transparent text-sm font-medium outline-none w-full"
                        value={dateEnd} onChange={e => setDateEnd(e.target.value)}/>
                    </div>
                  </div>
                  {days && (
                    <>
                      <div className="w-px bg-border"/>
                      <div className="px-3 py-2.5 flex items-center bg-secondary/20">
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Durata</div>
                          <div className="text-sm text-muted-foreground">{days}g</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Casa */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">Punto di partenza</label>
                <div className="relative">
                  <input className="input-field w-full pl-8" value={homeQuery}
                    onChange={async e => {
                      setHomeQuery(e.target.value);
                      if (e.target.value.length > 1) setHomeResults(await searchPlaces(e.target.value));
                      else setHomeResults([]);
                    }}
                    placeholder="La tua città…"/>
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2"/>
                  {homeResults.length > 0 && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                      {homeResults.map((r, i) => (
                        <button key={i} type="button" onClick={() => { setHome({ lat: r.lat, lon: r.lon, label: r.name + ", " + r.country }); setHomeQuery(r.name + ", " + r.country); setHomeResults([]); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0"/>
                          {r.name}, {r.country}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Itinerario */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">Itinerario</label>
                <div className="rounded-xl border border-border bg-secondary/10 p-4">
                  {/* Arc visualization */}
                  <div className="overflow-x-auto mb-3">
                    <RouteArcs waypoints={waypoints} home={home}/>
                  </div>

                  {/* Waypoints list with transport selector */}
                  {waypoints.map((wp, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2 text-sm">
                      <span>{countryFlag(wp.country_code)}</span>
                      <span className="flex-1 font-medium">{wp.city}</span>
                      <div className="flex gap-1">
                        {TRANSPORT.map(t => (
                          <button key={t.value} type="button"
                            onClick={() => updateWpTransport(i, t.value)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
                            style={{
                              background: wp.transport_mode === t.value ? t.bg : "transparent",
                              color: wp.transport_mode === t.value ? t.color : "rgba(255,255,255,0.2)",
                              border: `0.5px solid ${wp.transport_mode === t.value ? t.color : "transparent"}`,
                            }}>
                            {t.icon}
                          </button>
                        ))}
                      </div>
                      <button type="button" onClick={() => removeWaypoint(i)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-secondary/60">
                        <X className="w-3 h-3 text-muted-foreground"/>
                      </button>
                    </div>
                  ))}

                  {/* Add city */}
                  <div className="relative mt-1">
                    <input className="input-field w-full pl-8 text-sm" value={wpQuery}
                      onChange={e => searchWp(e.target.value)}
                      placeholder="Aggiungi una città…"/>
                    {wpLoading
                      ? <Loader2 className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 animate-spin"/>
                      : <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2"/>
                    }
                    {wpResults.length > 0 && (
                      <div className="absolute top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                        {wpResults.map((r, i) => (
                          <button key={i} type="button" onClick={() => addWaypoint(r)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 flex items-center gap-2">
                            <span>{countryFlag(r.country_code ?? "")}</span>
                            <span>{r.name}, {r.country}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Note + Stelle */}
              <div className="flex gap-3 items-start">
                <div className="flex-1">
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">
                    Note <span className="opacity-40 normal-case text-[9px]">(opzionale)</span>
                  </label>
                  <textarea className="input-field w-full resize-none text-sm" rows={3}
                    value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Aggiungi una nota…"/>
                </div>
                <div className="flex-shrink-0">
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">
                    Valutazione <span className="opacity-40 normal-case text-[9px]">(opzionale)</span>
                  </label>
                  <div className="input-field flex items-center gap-1 px-3">
                    {[1,2,3,4,5].map(i => (
                      <button key={i} type="button"
                        onMouseEnter={() => setHoverRating(i)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(rating === i ? 0 : i)}
                        style={{
                          fontSize: "20px",
                          color: i <= (hoverRating || rating) ? "#fbbf24" : "rgba(255,255,255,0.15)",
                          transition: "color 0.1s, transform 0.1s",
                          transform: i <= (hoverRating || rating) ? "scale(1.1)" : "scale(1)",
                          background: "none", border: "none", cursor: "pointer",
                        }}>★</button>
                    ))}
                  </div>
                  {(hoverRating || rating) > 0 && (
                    <div className="text-[10px] text-center mt-1" style={{ color: "#fbbf24" }}>
                      {RATING_LABELS[hoverRating || rating]}
                    </div>
                  )}
                </div>
              </div>



            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-secondary/10">
              <span className="text-[11px] text-muted-foreground">* Solo itinerario obbligatorio</span>
              <div className="flex gap-2">
                <button onClick={() => { setOpen(false); reset(); }}
                  className="btn-ghost px-4 py-2 text-sm rounded-xl">Annulla</button>
                <button onClick={handleSave} disabled={saving}
                  className="btn-primary flex items-center gap-2 px-5 py-2 text-sm rounded-xl">
                  {saving && <Loader2 className="w-4 h-4 animate-spin"/>}
                  Salva viaggio
                </button>
              </div>
            </div>

          </div>
        </div>
      , document.body)}
    </>
  );
}
