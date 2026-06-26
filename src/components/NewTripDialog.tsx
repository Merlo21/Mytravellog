import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { searchPlaces, fetchElevation, fetchTemperature, distanceKm, countryFlag, GeoResult } from "@/lib/geo";
import { addTrip } from "@/lib/storage";
import { useSettings } from "@/lib/settings";
import { toast } from "sonner";
import { Plus, Search, Loader2, MapPin, X, Plane, Train, Car, Ship, Footprints } from "lucide-react";

interface Props {
  onCreated: () => void;
  defaultHome?: { lat: number; lon: number; label: string } | null;
  prefilledCity?: { name: string; country: string; country_code: string; latitude: number; longitude: number } | null;
  triggerLabel?: string;
}

type TransportMode = "plane" | "train" | "car" | "ship" | "walk";
type Waypoint = { city: string; country: string; country_code: string; lat: number; lon: number; transport_mode: TransportMode };

const TRANSPORT: { value: TransportMode; label: string; color: string; bg: string }[] = [
  { value: "plane", label: "Aereo",   color: "#378ADD", bg: "rgba(55,138,221,0.15)"  },
  { value: "train", label: "Treno",   color: "#BA7517", bg: "rgba(186,117,23,0.15)"  },
  { value: "car",   label: "Auto",    color: "#639922", bg: "rgba(99,153,34,0.15)"   },
  { value: "ship",  label: "Nave",    color: "#0F6E56", bg: "rgba(15,110,86,0.15)"   },
  { value: "walk",  label: "A piedi", color: "#D85A30", bg: "rgba(216,90,48,0.15)"   },
];

const RATING_LABELS: Record<number, string> = {
  1: "Non memorabile", 2: "Nella media", 3: "Bello", 4: "Fantastico", 5: "Indimenticabile"
};

function daysBetween(a: string, b: string) {
  if (!a || !b) return null;
  const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
  return d > 0 ? d : null;
}

function RouteArcs({
  waypoints, home, onEditHome, editingHome, homeQuery, setHomeQuery, homeResults, onSelectHome
}: {
  waypoints: Waypoint[];
  home: { lat: number; lon: number; label: string } | null;
  onEditHome: () => void;
  editingHome: boolean;
  homeQuery: string;
  setHomeQuery: (v: string) => void;
  homeResults: GeoResult[];
  onSelectHome: (r: GeoResult) => void;
}) {
  const W = 420, H = 115;
  const stops = [
    { label: home?.label?.split(",")[0] ?? "Casa", flag: "🏠", isHome: true, transport: null as TransportMode | null },
    ...waypoints.map(w => ({ label: w.city, flag: countryFlag(w.country_code), isHome: false, transport: w.transport_mode })),
  ];

  const n = stops.length;
  const pad = 55;
  const step = n > 1 ? (W - pad * 2) / (n - 1) : 0;
  const cx = (i: number) => pad + i * step;
  const cy = 82;

  // Only show SVG when there are cities added
  if (waypoints.length === 0) return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"20px 0",
        color:"rgba(255,255,255,0.25)", fontSize:12 }}>
        Aggiungi almeno una città all'itinerario
      </div>
    </div>
  );

  return (
    <div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible", minWidth: W }}>
        <defs>
          {TRANSPORT.map(t => (
            <marker key={t.value} id={`arr-ntd-${t.value}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={t.color} opacity="0.8"/>
            </marker>
          ))}
        </defs>

        {stops.map((stop, i) => {
          if (i === 0) return null;
          const t = TRANSPORT.find(t => t.value === stop.transport) ?? TRANSPORT[0];
          const x1 = cx(i - 1), x2 = cx(i);
          const mx = (x1 + x2) / 2;
          const arcH = Math.min(62, Math.max(22, (x2 - x1) * 0.38));
          return (
            <g key={i}>
              <path d={`M ${x1} ${cy} Q ${mx} ${cy - arcH} ${x2} ${cy}`}
                stroke={t.color} strokeWidth="1.8" strokeDasharray="5 3"
                fill="none" opacity="0.6"
                markerEnd={`url(#arr-ntd-${t.value})`}/>
              <rect x={mx - 29} y={cy - arcH - 13} width="58" height="17" rx="8"
                fill={t.bg} stroke={t.color} strokeWidth="0.5" strokeOpacity="0.7"/>
              <text x={mx} y={cy - arcH - 2} fontSize="9.5" textAnchor="middle" fill={t.color}>
                {t.label === "Aereo" ? "✈" : t.label === "Treno" ? "🚂" : t.label === "Auto" ? "🚗" : t.label === "Nave" ? "⛵" : "🚶"} {t.label}
              </text>
            </g>
          );
        })}

        {stops.map((stop, i) => {
          const x = cx(i);
          const isLast = i === stops.length - 1 && stops.length > 1;
          const lastT = isLast ? TRANSPORT.find(t => t.value === stop.transport) ?? TRANSPORT[0] : null;
          const borderColor = stop.isHome ? "#fbbf24" : lastT ? lastT.color : "#60a5fa";
          const bgFill = stop.isHome ? "rgba(251,191,36,0.1)" : lastT ? lastT.bg : "rgba(96,165,250,0.08)";
          const nodeR = isLast ? 21 : 18;
          return (
            <g key={i} style={{ cursor: stop.isHome ? "pointer" : "default" }}
              onClick={stop.isHome ? onEditHome : undefined}>
              <circle cx={x} cy={cy} r={nodeR}
                fill={bgFill}
                stroke={borderColor} strokeWidth={isLast ? 2 : 1.5}
                strokeDasharray={stop.isHome ? "3 2" : "none"}/>
              <text x={x} y={cy + 5} fontSize={isLast ? 17 : 15}
                textAnchor="middle" dominantBaseline="middle">{stop.flag}</text>
              <text x={x} y={cy + nodeR + 10} fontSize="8.5" textAnchor="middle"
                fill={isLast ? borderColor : "rgba(255,255,255,0.4)"}
                fontWeight={isLast ? "600" : "normal"}>
                {stop.label.length > 8 ? stop.label.slice(0, 7) + "…" : stop.label}
              </text>
              {/* Edit pencil on home */}
              {stop.isHome && (
                <g>
                  <circle cx={x + nodeR - 4} cy={cy - nodeR + 4} r="8" fill="#0d1f3c" stroke="#fbbf24" strokeWidth="1"/>
                  <text x={x + nodeR - 4} y={cy - nodeR + 8} fontSize="9" textAnchor="middle" fill="#fbbf24">✎</text>
                </g>
              )}
              {/* Remove button on waypoints (not home, not last) */}
              {!stop.isHome && !isLast && (
                <g>
                  <circle cx={x + nodeR - 2} cy={cy - nodeR + 2} r="7" fill="#060e1e" stroke="#1a2d4a" strokeWidth="1"/>
                  <text x={x + nodeR - 2} y={cy - nodeR + 6} fontSize="9" textAnchor="middle" fill="rgba(255,255,255,0.3)">×</text>
                </g>
              )}
              {/* Remove on last city too */}
              {!stop.isHome && isLast && (
                <g>
                  <circle cx={x + nodeR - 2} cy={cy - nodeR + 2} r="7" fill="#060e1e" stroke={borderColor} strokeWidth="1"/>
                  <text x={x + nodeR - 2} y={cy - nodeR + 6} fontSize="9" textAnchor="middle" fill={borderColor}>×</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Home edit field */}
      {editingHome && (
        <div style={{
          background: "#0d1f3c", border: "0.5px solid #fbbf24",
          borderRadius: 8, padding: "7px 12px", marginTop: 4,
          display: "flex", alignItems: "center", gap: 8, position: "relative"
        }}>
          <span style={{ fontSize: 13, color: "#fbbf24" }}>🏠</span>
          <input
            autoFocus
            style={{ background: "transparent", border: "none", outline: "none", color: "#f0f4ff", fontSize: 12, flex: 1 }}
            value={homeQuery}
            onChange={e => setHomeQuery(e.target.value)}
            placeholder="La tua città…"/>
          <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0"/>
          {homeResults.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0,
              background: "#0d1f3c", border: "0.5px solid #1a2d4a",
              borderRadius: 8, zIndex: 10, overflow: "hidden", marginTop: 4
            }}>
              {homeResults.map((r, i) => (
                <button key={i} type="button" onClick={() => onSelectHome(r)}
                  style={{ width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 12,
                    color: "#f0f4ff", background: "none", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8 }}>
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0"/>
                  {r.name}, {r.country}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function NewTripDialog({ onCreated, defaultHome, prefilledCity, triggerLabel }: Props) {
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [dateStart, setDateStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateEnd, setDateEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [wpQuery, setWpQuery] = useState("");
  const [wpResults, setWpResults] = useState<GeoResult[]>([]);
  const [wpLoading, setWpLoading] = useState(false);
  const [wpTransport, setWpTransport] = useState<TransportMode>("plane");

  const [home, setHome] = useState<{ lat: number; lon: number; label: string } | null>(defaultHome ?? null);
  const [editingHome, setEditingHome] = useState(false);
  const [homeQuery, setHomeQuery] = useState(defaultHome?.label ?? "");
  const [homeResults, setHomeResults] = useState<GeoResult[]>([]);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (defaultHome) { setHome(defaultHome); setHomeQuery(defaultHome.label); }
  }, [defaultHome]);

  useEffect(() => {
    if (prefilledCity && open) {
      setWaypoints([{
        city: prefilledCity.name, country: prefilledCity.country,
        country_code: prefilledCity.country_code,
        lat: prefilledCity.latitude, lon: prefilledCity.longitude,
        transport_mode: "plane",
      }]);
    }
  }, [prefilledCity, open]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (homeQuery.length < 2) { setHomeResults([]); return; }
      setHomeResults(await searchPlaces(homeQuery));
    }, 300);
    return () => clearTimeout(t);
  }, [homeQuery]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (wpQuery.length < 2) { setWpResults([]); setWpLoading(false); return; }
      setWpLoading(true);
      setWpResults((await searchPlaces(wpQuery)).slice(0, 5));
      setWpLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [wpQuery]);

  const addWaypoint = (r: GeoResult) => {
    setWaypoints(prev => [...prev, {
      city: r.name, country: r.country, country_code: r.country_code ?? "",
      lat: r.lat, lon: r.lon, transport_mode: wpTransport,
    }]);
    setWpQuery(""); setWpResults([]);
  };

  const removeWaypoint = (i: number) => setWaypoints(prev => prev.filter((_, idx) => idx !== i));

  const reset = () => {
    setTitle(""); setDateStart(new Date().toISOString().slice(0, 10));
    setDateEnd(""); setNotes(""); setRating(0); setHoverRating(0);
    setWaypoints([]); setWpQuery(""); setWpResults([]);
    setEditingHome(false);
  };

  const handleSave = async () => {
    if (waypoints.length === 0) { toast.error("Aggiungi almeno una città all'itinerario"); return; }
    setSaving(true);
    const dest = waypoints[waypoints.length - 1];
    const dist = home ? distanceKm(home.lat, home.lon, dest.lat, dest.lon) : null;
    const [alt, temp] = await Promise.all([fetchElevation(dest.lat, dest.lon), fetchTemperature(dest.lat, dest.lon)]);
    addTrip({
      title: title.trim() || dest.city,
      country: dest.country, city: dest.city,
      trip_date: dateStart, date_end: dateEnd || null,
      notes: notes.trim() || null,
      transport_mode: dest.transport_mode,
      waypoints: waypoints.slice(0, -1).map(w => ({ city: w.city, country: w.country, transport_mode: w.transport_mode })),
      latitude: dest.lat, longitude: dest.lon,
      home_latitude: home?.lat ?? null, home_longitude: home?.lon ?? null,
      distance_from_home_km: dist, altitude_m: alt, temperature_c: temp,
      country_code: dest.country_code, rating: rating || null,
    });
    toast.success("Viaggio salvato!");
    setSaving(false); setOpen(false); reset(); onCreated();
  };

  const days = daysBetween(dateStart, dateEnd);

  const modal = (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:9999,
      display:"flex", alignItems:"center", justifyContent:"center",
      background:"rgba(6,14,30,0.55)", backdropFilter:"blur(16px)" }}
      onClick={e => { if (e.target === e.currentTarget) { setOpen(false); reset(); } }}>

      <div className="w-full max-w-lg mx-4"
        style={{ maxHeight:"90vh", display:"flex", flexDirection:"column", overflow:"hidden", background:"#0a1628", border:"0.5px solid #1a2d4a", borderRadius:14, boxShadow:"0 32px 80px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ padding:"14px 20px", borderBottom:"0.5px solid #1a2d4a", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:8, background:"rgba(96,165,250,0.12)",
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <MapPin className="w-4 h-4" style={{ color:"#60a5fa" }}/>
          </div>
          <span style={{ fontSize:15, fontWeight:700, color:"#f0f4ff", flex:1 }}>Nuovo viaggio</span>
          <button onClick={() => { setOpen(false); reset(); }}
            style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.3)", fontSize:20 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:"auto", padding:"14px 20px", display:"flex", flexDirection:"column", gap:12 }}>

          {/* Nome */}
          <div>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Nome del viaggio</div>
            <input className="input-field w-full text-sm" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Es. Viaggio di nozze, Tokyo 2024…"/>
          </div>

          {/* Periodo */}
          <div>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Periodo</div>
            <div style={{ display:"flex", alignItems:"stretch", background:"#060e1e",
              border:"0.5px solid #1a2d4a", borderRadius:8, overflow:"hidden" }}>
              <div style={{ flex:1, padding:"8px 12px", display:"flex", alignItems:"center", gap:7 }}>
                <Plane className="w-3.5 h-3.5 text-primary flex-shrink-0" style={{ transform:"rotate(-45deg)" }}/>
                <div>
                  <div style={{ fontSize:8, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:1 }}>Partenza</div>
                  <input type="date" style={{ background:"transparent", border:"none", outline:"none", color:"#f0f4ff", fontSize:12, fontWeight:500 }}
                    value={dateStart} onChange={e => setDateStart(e.target.value)}/>
                </div>
              </div>
              <div style={{ width:"0.5px", background:"#1a2d4a" }}/>
              <div style={{ flex:1, padding:"8px 12px", display:"flex", alignItems:"center", gap:7 }}>
                <Plane className="w-3.5 h-3.5 text-primary flex-shrink-0" style={{ transform:"rotate(45deg) scaleX(-1)" }}/>
                <div>
                  <div style={{ fontSize:8, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:1 }}>Ritorno</div>
                  <input type="date" style={{ background:"transparent", border:"none", outline:"none", color:"#f0f4ff", fontSize:12, fontWeight:500 }}
                    value={dateEnd} onChange={e => setDateEnd(e.target.value)}/>
                </div>
              </div>
              {days && <>
                <div style={{ width:"0.5px", background:"#1a2d4a" }}/>
                <div style={{ padding:"8px 12px", display:"flex", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:8, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:1 }}>Durata</div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginTop:1 }}>{days}g</div>
                  </div>
                </div>
              </>}
            </div>
          </div>

          {/* Itinerario */}
          <div>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
              Itinerario <span style={{ opacity:0.4, fontSize:8, textTransform:"none" }}>· clicca 🏠 per cambiare città di partenza</span>
            </div>
            <div style={{ background:"#060e1e", border:"0.5px solid #1a2d4a", borderRadius:8, padding:"16px 14px 10px", overflowX:"auto" }}>
              <RouteArcs
                waypoints={waypoints} home={home}
                onEditHome={() => { setEditingHome(v => !v); setHomeQuery(home?.label ?? ""); }}
                editingHome={editingHome}
                homeQuery={homeQuery}
                setHomeQuery={setHomeQuery}
                homeResults={homeResults}
                onSelectHome={r => { setHome({ lat:r.lat, lon:r.lon, label:`${r.name}, ${r.country}` }); setHomeQuery(`${r.name}, ${r.country}`); setHomeResults([]); setEditingHome(false); }}
              />

              {/* Transport selector + add city */}
              <div style={{ marginTop:8 }}>
                {/* Transport pills */}
                <div style={{ display:"flex", gap:4, marginBottom:6, flexWrap:"wrap" }}>
                  {TRANSPORT.map(t => (
                    <button key={t.value} type="button" onClick={() => setWpTransport(t.value)}
                      style={{ fontSize:10, padding:"3px 8px", borderRadius:99, cursor:"pointer",
                        background: wpTransport === t.value ? t.bg : "transparent",
                        color: wpTransport === t.value ? t.color : "rgba(255,255,255,0.25)",
                        border: `0.5px solid ${wpTransport === t.value ? t.color : "#1a2d4a"}` }}>
                      {t.label}
                    </button>
                  ))}
                </div>
                {/* Add city search */}
                <div style={{ position:"relative" }}>
                  <input className="input-field w-full text-sm pl-8" value={wpQuery}
                    onChange={e => setWpQuery(e.target.value)}
                    placeholder="Aggiungi una città…"/>
                  {wpLoading
                    ? <Loader2 className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 animate-spin"/>
                    : <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2"/>}
                  {wpResults.length > 0 && (
                    <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#0d1f3c",
                      border:"0.5px solid #1a2d4a", borderRadius:8, zIndex:10, overflow:"hidden", marginTop:4 }}>
                      {wpResults.map((r, i) => (
                        <button key={i} type="button" onClick={() => addWaypoint(r)}
                          style={{ width:"100%", textAlign:"left", padding:"8px 12px", fontSize:12,
                            color:"#f0f4ff", background:"none", border:"none", cursor:"pointer",
                            display:"flex", alignItems:"center", gap:8 }}>
                          <span>{countryFlag(r.country_code ?? "")}</span>
                          <span>{r.name}, {r.country}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Waypoints list */}
                {waypoints.map((wp, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginTop:4, fontSize:12 }}>
                    <span>{countryFlag(wp.country_code)}</span>
                    <span style={{ flex:1, color:"#f0f4ff" }}>{wp.city}</span>
                    <button type="button" onClick={() => removeWaypoint(i)}
                      style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.3)" }}>
                      <X className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Note + Stelle */}
          <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
            <div style={{ flex:1 }}>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
                Note <span style={{ opacity:0.4, fontSize:8 }}>(opzionale)</span>
              </div>
              <textarea className="input-field w-full text-sm resize-none" rows={2}
                value={notes} onChange={e => setNotes(e.target.value)} placeholder="Aggiungi una nota…"/>
            </div>
            <div style={{ flexShrink:0 }}>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
                Valutazione <span style={{ opacity:0.4, fontSize:8 }}>(opzionale)</span>
              </div>
              <div className="input-field" style={{ display:"flex", alignItems:"center", gap:2, padding:"8px 10px" }}>
                {[1,2,3,4,5].map(i => (
                  <button key={i} type="button"
                    onMouseEnter={() => setHoverRating(i)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(rating === i ? 0 : i)}
                    style={{ fontSize:20, background:"none", border:"none", cursor:"pointer", padding:0,
                      color: i <= (hoverRating || rating) ? "#fbbf24" : "rgba(255,255,255,0.15)",
                      transform: i <= (hoverRating || rating) ? "scale(1.15)" : "scale(1)",
                      transition:"color 0.1s, transform 0.1s" }}>★</button>
                ))}
              </div>
              {(hoverRating || rating) > 0 && (
                <div style={{ fontSize:9, color:"#fbbf24", textAlign:"center", marginTop:3 }}>
                  {RATING_LABELS[hoverRating || rating]}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding:"12px 20px", borderTop:"0.5px solid #1a2d4a", background:"rgba(0,0,0,0.2)",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:10, color:"rgba(255,255,255,0.2)" }}>* Solo itinerario obbligatorio</span>
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={() => { setOpen(false); reset(); }}
              className="btn-ghost text-sm px-3 py-1.5 rounded-lg">Annulla</button>
            <button onClick={handleSave} disabled={saving}
              className="btn-primary flex items-center gap-2 text-sm px-4 py-1.5 rounded-lg">
              {saving && <Loader2 className="w-4 h-4 animate-spin"/>}
              Salva viaggio
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors hover:bg-primary/10"
        style={{ color:"#60a5fa", border:"1.5px solid #60a5fa" }}>
        <Plus className="w-4 h-4"/> {triggerLabel || "Nuovo viaggio"}
      </button>
      {open && createPortal(modal, document.body)}
    </>
  );
}
