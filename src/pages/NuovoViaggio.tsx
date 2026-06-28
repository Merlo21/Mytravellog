import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { searchPlaces, fetchElevation, fetchTemperature, distanceKm, countryFlag, GeoResult } from "@/lib/geo";
import { addTrip } from "@/lib/storage";
import { useSettings } from "@/lib/settings";
import { toast } from "sonner";
import { Loader2, MapPin, X, Plane, Train, Car, Ship, Footprints, Route, Search, PieChart, Settings } from "lucide-react";

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
  waypoints, home, onEditHome, editingHome,
  homeQuery, setHomeQuery, homeResults, onSelectHome, onRemoveWaypoint
}: {
  waypoints: Waypoint[];
  home: { lat: number; lon: number; label: string } | null;
  onEditHome: () => void;
  editingHome: boolean;
  homeQuery: string;
  setHomeQuery: (v: string) => void;
  homeResults: GeoResult[];
  onSelectHome: (r: GeoResult) => void;
  onRemoveWaypoint: (i: number) => void;
}) {
  const homeLabel = home?.label?.split(",")[0] ?? "Casa";

  if (waypoints.length === 0) {
    return (
      <div>
        <div style={{ position:"relative", paddingBottom:8 }}>
          <svg width="420" height="100" viewBox="0 0 420 100"
            style={{ display:"block", overflow:"visible", minWidth:420 }}>
            <path d="M 55 70 Q 140 20 220 70" stroke="#1a2d4a" strokeWidth="1.5" strokeDasharray="5 3" fill="none"/>
            <path d="M 220 70 Q 305 20 370 70" stroke="#1a2d4a" strokeWidth="1.5" strokeDasharray="5 3" fill="none"/>
            <circle cx="55" cy="70" r="20" fill="rgba(251,191,36,0.1)" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="3 2"/>
            <circle cx="70" cy="54" r="8" fill="#0d1f3c" stroke="#fbbf24" strokeWidth="1"/>
            <text x="70" y="58" fontSize="10" textAnchor="middle" fill="#fbbf24">✎</text>
            <text x="55" y="96" fontSize="8.5" textAnchor="middle" fill="rgba(255,255,255,0.4)">{homeLabel.slice(0,8)}</text>
            <circle cx="220" cy="70" r="20" fill="rgba(255,255,255,0.03)" stroke="#1a2d4a" strokeWidth="1.5" strokeDasharray="3 2"/>
            <text x="220" y="75" fontSize="16" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.15)">+</text>
            <text x="220" y="96" fontSize="8.5" textAnchor="middle" fill="rgba(255,255,255,0.2)">città</text>
            <circle cx="370" cy="70" r="22" fill="rgba(255,255,255,0.03)" stroke="#1a2d4a" strokeWidth="1.5" strokeDasharray="3 2"/>
            <text x="370" y="75" fontSize="16" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.15)">+</text>
            <text x="370" y="98" fontSize="8.5" textAnchor="middle" fill="rgba(255,255,255,0.2)">destinazione</text>
          </svg>
          <div style={{ position:"absolute", top:50, left:35, width:40, height:40,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:18, cursor:"pointer" }} onClick={onEditHome}>🏠</div>
        </div>
        {editingHome && (
          <div style={{ background:"#0d1f3c", border:"0.5px solid #fbbf24", borderRadius:8,
            padding:"7px 12px", marginTop:4, display:"flex", alignItems:"center", gap:8, position:"relative" }}>
            <span style={{ fontSize:13, color:"#fbbf24" }}>🏠</span>
            <input autoFocus style={{ background:"transparent", border:"none", outline:"none", color:"#f0f4ff", fontSize:12, flex:1 }}
              value={homeQuery} onChange={e => setHomeQuery(e.target.value)} placeholder="La tua città…"/>
            <Search className="w-3.5 h-3.5" style={{ color:"rgba(255,255,255,0.3)", flexShrink:0 }}/>
            {homeResults.length > 0 && (
              <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#0d1f3c",
                border:"0.5px solid #1a2d4a", borderRadius:8, zIndex:10, overflow:"hidden", marginTop:4 }}>
                {homeResults.map((r,i) => (
                  <button key={i} type="button" onClick={() => onSelectHome(r)}
                    style={{ width:"100%", textAlign:"left", padding:"8px 12px", fontSize:12,
                      color:"#f0f4ff", background:"none", border:"none", cursor:"pointer",
                      display:"flex", alignItems:"center", gap:8 }}>
                    <MapPin className="w-3.5 h-3.5" style={{ color:"rgba(255,255,255,0.3)" }}/>{r.name}, {r.country}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const stops = [
    { label: homeLabel, flag: "🏠", isHome: true, transport: null as TransportMode | null },
    ...waypoints.map(w => ({ label: w.city, flag: countryFlag(w.country_code), isHome: false, transport: w.transport_mode })),
  ];
  const n = stops.length;
  const W = 580, cy = 90, pad = 60;
  const step = n > 1 ? (W - pad * 2) / (n - 1) : 0;
  const cx = (i: number) => pad + i * step;

  return (
    <div style={{ position:"relative" }}>
      <svg width={W} height={130} viewBox={`0 0 ${W} 130`}
        style={{ display:"block", overflow:"visible", minWidth:W }}>
        <defs>
          {TRANSPORT.map(t => (
            <marker key={t.value} id={`pg-arr-${t.value}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={t.color} opacity="0.8"/>
            </marker>
          ))}
        </defs>
        {stops.map((stop, i) => {
          if (i === 0) return null;
          const t = TRANSPORT.find(t => t.value === stop.transport) ?? TRANSPORT[0];
          const x1 = cx(i-1), x2 = cx(i), mx = (x1+x2)/2;
          const arcH = Math.min(70, Math.max(25, (x2-x1)*0.4));
          return (
            <g key={i}>
              <path d={`M ${x1} ${cy} Q ${mx} ${cy-arcH} ${x2} ${cy}`}
                stroke={t.color} strokeWidth="2" strokeDasharray="5 3"
                fill="none" opacity="0.6" markerEnd={`url(#pg-arr-${t.value})`}/>
              <rect x={mx-32} y={cy-arcH-15} width="64" height="19" rx="9"
                fill={t.bg} stroke={t.color} strokeWidth="0.5" strokeOpacity="0.7"/>
              <text x={mx} y={cy-arcH-3} fontSize="10.5" textAnchor="middle" fill={t.color}>{t.label}</text>
            </g>
          );
        })}
        {stops.map((stop, i) => {
          const x = cx(i);
          const isLast = i === stops.length-1 && stops.length > 1;
          const lastT = isLast ? TRANSPORT.find(t => t.value === stop.transport) ?? TRANSPORT[0] : null;
          const borderColor = stop.isHome ? "#fbbf24" : lastT ? lastT.color : "#60a5fa";
          const bgFill = stop.isHome ? "rgba(251,191,36,0.1)" : lastT ? lastT.bg : "rgba(96,165,250,0.08)";
          const r = isLast ? 26 : 22;
          return (
            <g key={i}>
              <circle cx={x} cy={cy} r={r} fill={bgFill} stroke={borderColor}
                strokeWidth={isLast ? 2.5 : 1.5} strokeDasharray={stop.isHome ? "3 2" : "none"}/>
              {stop.isHome && (
                <g style={{cursor:"pointer"}} onClick={onEditHome}>
                  <circle cx={x+r-4} cy={cy-r+4} r="9" fill="#0d1f3c" stroke="#fbbf24" strokeWidth="1"/>
                  <text x={x+r-4} y={cy-r+8} fontSize="10" textAnchor="middle" fill="#fbbf24">✎</text>
                </g>
              )}
              {!stop.isHome && (
                <g style={{cursor:"pointer"}} onClick={() => onRemoveWaypoint(i-1)}>
                  <circle cx={x+r-2} cy={cy-r+2} r="8" fill="#060e1e"
                    stroke={isLast ? borderColor : "#1a2d4a"} strokeWidth="1"/>
                  <text x={x+r-2} y={cy-r+6} fontSize="10" textAnchor="middle"
                    fill={isLast ? borderColor : "rgba(255,255,255,0.3)"}>×</text>
                </g>
              )}
              <text x={x} y={cy+r+13} fontSize="9" textAnchor="middle"
                fill={isLast ? borderColor : "rgba(255,255,255,0.4)"}
                fontWeight={isLast ? "600" : "normal"}>
                {stop.label.length > 9 ? stop.label.slice(0,8)+"…" : stop.label}
              </text>
            </g>
          );
        })}
      </svg>
      {/* HTML emoji overlays */}
      <div style={{ position:"absolute", top:0, left:0, width:"100%", pointerEvents:"none" }}>
        {stops.map((stop, i) => {
          const x = cx(i);
          const isLast = i === stops.length-1 && stops.length > 1;
          return (
            <div key={i} style={{
              position:"absolute", left:x-13, top:cy-13,
              width:26, height:26, display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:isLast ? 19 : 16,
              lineHeight:1, userSelect:"none"
            }}>{stop.flag}</div>
          );
        })}
      </div>
      {editingHome && (
        <div style={{ background:"#0d1f3c", border:"0.5px solid #fbbf24", borderRadius:8,
          padding:"7px 12px", marginTop:4, display:"flex", alignItems:"center", gap:8, position:"relative" }}>
          <span style={{ fontSize:13, color:"#fbbf24" }}>🏠</span>
          <input autoFocus style={{ background:"transparent", border:"none", outline:"none", color:"#f0f4ff", fontSize:12, flex:1 }}
            value={homeQuery} onChange={e => setHomeQuery(e.target.value)} placeholder="La tua città…"/>
          <Search className="w-3.5 h-3.5" style={{ color:"rgba(255,255,255,0.3)", flexShrink:0 }}/>
          {homeResults.length > 0 && (
            <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#0d1f3c",
              border:"0.5px solid #1a2d4a", borderRadius:8, zIndex:10, overflow:"hidden", marginTop:4 }}>
              {homeResults.map((r,i) => (
                <button key={i} type="button" onClick={() => onSelectHome(r)}
                  style={{ width:"100%", textAlign:"left", padding:"8px 12px", fontSize:12,
                    color:"#f0f4ff", background:"none", border:"none", cursor:"pointer",
                    display:"flex", alignItems:"center", gap:8 }}>
                  <MapPin className="w-3.5 h-3.5" style={{ color:"rgba(255,255,255,0.3)" }}/>{r.name}, {r.country}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const NuovoViaggio = () => {
  const navigate = useNavigate();
  const { distanceUnit } = useSettings();

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
  const [wpOpen, setWpOpen] = useState(false);
  const [wpTransport, setWpTransport] = useState<TransportMode>("plane");
  const [home, setHome] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [editingHome, setEditingHome] = useState(false);
  const [homeQuery, setHomeQuery] = useState("");
  const [homeResults, setHomeResults] = useState<GeoResult[]>([]);
  const [saving, setSaving] = useState(false);

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
    setWpQuery(""); setWpResults([]); setWpOpen(false);
  };

  const removeWaypoint = (i: number) => setWaypoints(prev => prev.filter((_, idx) => idx !== i));

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
    setSaving(false);
    navigate("/");
  };

  const days = daysBetween(dateStart, dateEnd);

  return (
    <main className="min-h-screen">
      {/* Header — same as Stats/Settings */}
      <header className="border-b border-border bg-background/60 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:"#60a5fa"}}>
              <svg width="26" height="26" viewBox="0 0 30 30" fill="none" aria-hidden="true">
                <circle cx="15" cy="15" r="11" stroke="#020d1a" strokeWidth="1.6"/>
                <ellipse cx="15" cy="15" rx="11" ry="4.8" stroke="#020d1a" strokeWidth="1.2"/>
                <ellipse cx="15" cy="15" rx="6.5" ry="11" stroke="#020d1a" strokeWidth="1.2"/>
                <polygon points="15,5.5 13.5,13 15,11.5 16.5,13" fill="#ffffff"/>
                <polygon points="15,24.5 13.5,17 15,18.5 16.5,17" fill="#ffffff" opacity="0.35"/>
                <polygon points="24.5,15 17,13.5 18.5,15 17,16.5" fill="#fbbf24"/>
                <polygon points="5.5,15 13,13.5 11.5,15 13,16.5" fill="#fbbf24" opacity="0.35"/>
              </svg>
            </div>
            <h1 className="text-[20px] font-extrabold leading-none tracking-[0.2em]">
              <span style={{color:"#60a5fa"}}>NAV</span><span style={{color:"#fbbf24"}}>·</span><span>TA</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="btn-ghost text-sm flex items-center gap-2 py-1.5 px-3">
              <Plane className="w-4 h-4 text-primary"/> I tuoi viaggi
            </Link>
            <Link to="/statistiche" className="btn-ghost text-sm flex items-center gap-2 py-1.5 px-3">
              <PieChart className="w-4 h-4 text-primary"/> Statistiche
            </Link>
            <div className="w-px h-5 bg-border mx-1"/>
            <Link to="/impostazioni" className="btn-ghost p-2" aria-label="Impostazioni">
              <Settings className="w-4 h-4 text-muted-foreground"/>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-6 py-8 max-w-2xl">

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:"rgba(96,165,250,0.12)"}}>
            <Route className="w-5 h-5" style={{color:"#60a5fa"}}/>
          </div>
          <div>
            <h2 className="text-xl font-bold">Nuovo viaggio</h2>
            <p className="text-sm text-muted-foreground">Racconta il tuo prossimo o ultimo viaggio</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">

          {/* Nome */}
          <div className="glass-card p-5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Nome del viaggio</label>
            <input className="input-field w-full" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Es. Viaggio di nozze, Tokyo 2024…"/>
          </div>

          {/* Periodo */}
          <div className="glass-card p-5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Periodo</label>
            <div style={{ display:"flex", alignItems:"stretch", background:"#060e1e",
              border:"0.5px solid #1a2d4a", borderRadius:8, overflow:"hidden" }}>
              <div style={{ flex:1, padding:"10px 14px", display:"flex", alignItems:"center", gap:8 }}>
                <Plane className="w-4 h-4 text-primary flex-shrink-0" style={{transform:"rotate(-45deg)"}}/>
                <div>
                  <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:1 }}>Partenza</div>
                  <input type="date" style={{ background:"transparent", border:"none", outline:"none", color:"#f0f4ff", fontSize:13, fontWeight:500 }}
                    value={dateStart} onChange={e => setDateStart(e.target.value)}/>
                </div>
              </div>
              <div style={{ width:"0.5px", background:"#1a2d4a" }}/>
              <div style={{ flex:1, padding:"10px 14px", display:"flex", alignItems:"center", gap:8 }}>
                <Plane className="w-4 h-4 text-primary flex-shrink-0" style={{transform:"rotate(45deg) scaleX(-1)"}}/>
                <div>
                  <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:1 }}>Ritorno</div>
                  <input type="date" style={{ background:"transparent", border:"none", outline:"none",
                    color: dateEnd ? "#f0f4ff" : "rgba(255,255,255,0.25)", fontSize:13, fontWeight:500 }}
                    value={dateEnd} onChange={e => setDateEnd(e.target.value)}/>
                </div>
              </div>
              {days && (
                <>
                  <div style={{ width:"0.5px", background:"#1a2d4a" }}/>
                  <div style={{ padding:"10px 14px", display:"flex", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:1 }}>Durata</div>
                      <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", marginTop:1 }}>{days}g</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Itinerario */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Itinerario</label>
              <span className="text-[10px] text-muted-foreground opacity-50">· clicca 🏠 per cambiare città di partenza</span>
            </div>
            <div style={{ overflowX:"auto" }}>
              <RouteArcs
                waypoints={waypoints} home={home}
                onEditHome={() => { setEditingHome(v => !v); setHomeQuery(home?.label ?? ""); }}
                editingHome={editingHome}
                homeQuery={homeQuery} setHomeQuery={setHomeQuery}
                homeResults={homeResults}
                onSelectHome={r => {
                  setHome({ lat:r.lat, lon:r.lon, label:`${r.name}, ${r.country}` });
                  setHomeQuery(`${r.name}, ${r.country}`);
                  setHomeResults([]); setEditingHome(false);
                }}
                onRemoveWaypoint={removeWaypoint}
              />
            </div>

            {/* Mezzo */}
            <div className="flex gap-2 mt-4 mb-3 flex-wrap">
              {TRANSPORT.map(t => (
                <button key={t.value} type="button" onClick={() => setWpTransport(t.value)}
                  className="text-[11px] px-3 py-1 rounded-full transition-colors"
                  style={{
                    background: wpTransport === t.value ? t.bg : "transparent",
                    color: wpTransport === t.value ? t.color : "rgba(255,255,255,0.3)",
                    border: `0.5px solid ${wpTransport === t.value ? t.color : "#1a2d4a"}`
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Add city */}
            <div style={{ position:"relative", display:"flex", justifyContent:"center" }}>
              {wpOpen && (
                <div style={{ position:"absolute", bottom:"calc(100% + 6px)", left:0, right:0,
                  background:"#0d1f3c", border:"0.5px solid #1a2d4a",
                  borderRadius:10, overflow:"hidden", zIndex:20,
                  boxShadow:"0 -8px 24px rgba(0,0,0,0.3)" }}>
                  <div style={{ padding:"10px 12px", borderBottom:"0.5px solid #1a2d4a" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8,
                      background:"rgba(0,0,0,0.2)", borderRadius:8, padding:"7px 12px" }}>
                      {wpLoading
                        ? <Loader2 className="w-4 h-4 animate-spin" style={{ color:"rgba(255,255,255,0.3)", flexShrink:0 }}/>
                        : <Search className="w-4 h-4" style={{ color:"rgba(255,255,255,0.3)", flexShrink:0 }}/>
                      }
                      <input autoFocus
                        style={{ background:"transparent", border:"none", outline:"none",
                          color:"#f0f4ff", fontSize:13, flex:1 }}
                        value={wpQuery} onChange={e => setWpQuery(e.target.value)}
                        placeholder="Cerca città…"/>
                      <button type="button" onClick={() => { setWpQuery(""); setWpResults([]); setWpOpen(false); }}
                        style={{ background:"none", border:"none", cursor:"pointer",
                          color:"rgba(255,255,255,0.3)", fontSize:16 }}>×</button>
                    </div>
                  </div>
                  {wpResults.map((r,i) => (
                    <button key={i} type="button" onClick={() => addWaypoint(r)}
                      style={{ width:"100%", textAlign:"left", padding:"10px 14px", fontSize:13,
                        color:"#f0f4ff", background:"none", border:"none", cursor:"pointer",
                        display:"flex", alignItems:"center", gap:10,
                        borderBottom:"0.5px solid #1a2d4a" }}>
                      <span style={{fontSize:16}}>{countryFlag(r.country_code ?? "")}</span>
                      <span>{r.name}, {r.country}</span>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setWpOpen(true)}
                style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12,
                  color:"rgba(255,255,255,0.4)", border:"1.5px dashed #1a2d4a",
                  borderRadius:99, padding:"6px 20px", cursor:"pointer",
                  background:"transparent", whiteSpace:"nowrap" }}>
                + Aggiungi tappa
              </button>
            </div>
          </div>

          {/* Note + Stelle */}
          <div className="glass-card p-5">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">
                  Note <span className="opacity-40 normal-case text-[10px]">(opzionale)</span>
                </label>
                <textarea className="input-field w-full resize-none text-sm" rows={3}
                  value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Aggiungi una nota…"/>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">
                  Valutazione <span className="opacity-40 normal-case text-[10px]">(opzionale)</span>
                </label>
                <div className="input-field flex items-center gap-1 py-3">
                  {[1,2,3,4,5].map(i => (
                    <button key={i} type="button"
                      onMouseEnter={() => setHoverRating(i)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(rating === i ? 0 : i)}
                      style={{ fontSize:24, background:"none", border:"none", cursor:"pointer", padding:0,
                        color: i <= (hoverRating||rating) ? "#fbbf24" : "rgba(255,255,255,0.15)",
                        transform: i <= (hoverRating||rating) ? "scale(1.15)" : "scale(1)",
                        transition:"color 0.1s, transform 0.1s" }}>★</button>
                  ))}
                </div>
                {(hoverRating||rating) > 0 && (
                  <div className="text-[11px] mt-2" style={{color:"#fbbf24"}}>{RATING_LABELS[hoverRating||rating]}</div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pb-8">
            <Link to="/" className="btn-ghost px-5 py-2.5 rounded-xl text-sm">Annulla</Link>
            <button onClick={handleSave} disabled={saving}
              className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold">
              {saving && <Loader2 className="w-4 h-4 animate-spin"/>}
              Salva viaggio
            </button>
          </div>

        </div>
      </div>
    </main>
  );
};

export default NuovoViaggio;
