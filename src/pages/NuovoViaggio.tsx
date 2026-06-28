import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { searchPlaces, fetchElevation, fetchTemperature, distanceKm, countryFlag, GeoResult } from "@/lib/geo";
import { addTrip } from "@/lib/storage";
import { useSettings } from "@/lib/settings";
import { toast } from "sonner";
import { Loader2, MapPin, Plane, Train, Car, Ship, Footprints, Route, Search, PieChart, Settings, Plus } from "lucide-react";

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

function RouteHero({
  waypoints, home, onEditHome, editingHome,
  homeQuery, setHomeQuery, homeResults, onSelectHome, onRemoveWaypoint,
  wpTransport, setWpTransport, wpOpen, setWpOpen, wpQuery, setWpQuery,
  wpResults, wpLoading, onAddWaypoint
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
  wpTransport: TransportMode;
  setWpTransport: (v: TransportMode) => void;
  wpOpen: boolean;
  setWpOpen: (v: boolean) => void;
  wpQuery: string;
  setWpQuery: (v: string) => void;
  wpResults: GeoResult[];
  wpLoading: boolean;
  onAddWaypoint: (r: GeoResult) => void;
}) {
  const homeLabel = home?.label?.split(",")[0] ?? "Casa";
  const stops = [
    { label: homeLabel, flag: "🏠", isHome: true, transport: null as TransportMode | null },
    ...waypoints.map(w => ({ label: w.city, flag: countryFlag(w.country_code), isHome: false, transport: w.transport_mode })),
  ];

  const W = 520;
  const n = stops.length;
  const pad = 50;
  const step = n > 1 ? (W - pad * 2) / (n - 1) : 0;
  const cx = (i: number) => pad + i * step;
  const cy = 90;

  const showArcs = waypoints.length > 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>

      {/* SVG itinerario */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", overflowX:"auto", padding:"0 8px" }}>
        {showArcs ? (
          <div style={{ position:"relative" }}>
            <svg width={W} height={130} viewBox={`0 0 ${W} 130`}
              style={{ display:"block", overflow:"visible", minWidth:W }}>
              <defs>
                {TRANSPORT.map(t => (
                  <marker key={t.value} id={`hero-arr-${t.value}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill={t.color} opacity="0.8"/>
                  </marker>
                ))}
              </defs>
              {stops.map((stop, i) => {
                if (i === 0) return null;
                const t = TRANSPORT.find(t => t.value === stop.transport) ?? TRANSPORT[0];
                const x1 = cx(i-1), x2 = cx(i), mx = (x1+x2)/2;
                const arcH = Math.min(68, Math.max(28, (x2-x1)*0.4));
                return (
                  <g key={i}>
                    <path d={`M ${x1} ${cy} Q ${mx} ${cy-arcH} ${x2} ${cy}`}
                      stroke={t.color} strokeWidth="2" strokeDasharray="5 3"
                      fill="none" opacity="0.7" markerEnd={`url(#hero-arr-${t.value})`}/>
                    <rect x={mx-33} y={cy-arcH-15} width="66" height="19" rx="9"
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
                        <text x={x+r-4} y={cy-r+8} fontSize="11" textAnchor="middle" fill="#fbbf24">✎</text>
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
                    position:"absolute", left:x-14, top:cy-14,
                    width:28, height:28, display:"flex", alignItems:"center",
                    justifyContent:"center", fontSize:isLast ? 20 : 17,
                    lineHeight:1, userSelect:"none"
                  }}>{stop.flag}</div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Empty state */
          <div style={{ position:"relative", width:520 }}>
            <svg width="520" height="110" viewBox="0 0 520 110"
              style={{ display:"block", overflow:"visible" }}>
              <path d="M 55 78 Q 175 20 290 78" stroke="#1a2d4a" strokeWidth="1.5" strokeDasharray="6 4" fill="none"/>
              <path d="M 290 78 Q 400 20 470 78" stroke="#1a2d4a" strokeWidth="1.5" strokeDasharray="6 4" fill="none"/>
              <circle cx="55" cy="78" r="22" fill="rgba(251,191,36,0.1)" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="3 2"/>
              <circle cx="67" cy="59" r="9" fill="#0d1f3c" stroke="#fbbf24" strokeWidth="1"/>
              <text x="67" y="63" fontSize="11" textAnchor="middle" fill="#fbbf24">✎</text>
              <text x="55" y="106" fontSize="9" textAnchor="middle" fill="rgba(255,255,255,0.4)">{homeLabel.slice(0,9)}</text>
              <circle cx="290" cy="78" r="22" fill="rgba(255,255,255,0.02)" stroke="#1a2d4a" strokeWidth="1.5" strokeDasharray="3 2"/>
              <text x="290" y="83" fontSize="18" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.12)">+</text>
              <text x="290" y="106" fontSize="9" textAnchor="middle" fill="rgba(255,255,255,0.15)">tappa</text>
              <circle cx="470" cy="78" r="25" fill="rgba(255,255,255,0.02)" stroke="#1a2d4a" strokeWidth="1.5" strokeDasharray="3 2"/>
              <text x="470" y="83" fontSize="20" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.12)">+</text>
              <text x="470" y="108" fontSize="9" textAnchor="middle" fill="rgba(255,255,255,0.15)">destinazione</text>
            </svg>
            <div style={{ position:"absolute", top:56, left:33, width:44, height:44,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:20, cursor:"pointer" }} onClick={onEditHome}>🏠</div>
          </div>
        )}
      </div>

      {/* Home edit field */}
      {editingHome && (
        <div style={{ margin:"0 16px 8px", background:"#0d1f3c", border:"0.5px solid #fbbf24",
          borderRadius:8, padding:"8px 12px", display:"flex", alignItems:"center", gap:8, position:"relative" }}>
          <span style={{ fontSize:14, color:"#fbbf24" }}>🏠</span>
          <input autoFocus style={{ background:"transparent", border:"none", outline:"none", color:"#f0f4ff", fontSize:13, flex:1 }}
            value={homeQuery} onChange={e => setHomeQuery(e.target.value)} placeholder="La tua città…"/>
          <Search className="w-4 h-4" style={{ color:"rgba(255,255,255,0.3)", flexShrink:0 }}/>
          {homeResults.length > 0 && (
            <div style={{ position:"absolute", bottom:"100%", left:0, right:0, background:"#0d1f3c",
              border:"0.5px solid #1a2d4a", borderRadius:8, zIndex:10, overflow:"hidden", marginBottom:4 }}>
              {homeResults.map((r,i) => (
                <button key={i} type="button" onClick={() => onSelectHome(r)}
                  style={{ width:"100%", textAlign:"left", padding:"9px 14px", fontSize:13,
                    color:"#f0f4ff", background:"none", border:"none", cursor:"pointer",
                    display:"flex", alignItems:"center", gap:8, borderBottom:"0.5px solid #1a2d4a" }}>
                  <MapPin className="w-3.5 h-3.5" style={{ color:"rgba(255,255,255,0.3)" }}/>{r.name}, {r.country}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mezzo selector */}
      <div style={{ padding:"0 16px 8px", display:"flex", gap:6, flexWrap:"wrap" }}>
        {TRANSPORT.map(t => (
          <button key={t.value} type="button" onClick={() => setWpTransport(t.value)}
            style={{ fontSize:11, padding:"4px 10px", borderRadius:99, cursor:"pointer",
              background: wpTransport === t.value ? t.bg : "transparent",
              color: wpTransport === t.value ? t.color : "rgba(255,255,255,0.25)",
              border: `0.5px solid ${wpTransport === t.value ? t.color : "#1a2d4a"}` }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Add tappa pill */}
      <div style={{ padding:"0 16px 16px", position:"relative", display:"flex", justifyContent:"center" }}>
        {wpOpen && (
          <div style={{ position:"absolute", bottom:"calc(100% + 4px)", left:16, right:16,
            background:"#0d1f3c", border:"0.5px solid #1a2d4a",
            borderRadius:10, overflow:"hidden", zIndex:20, boxShadow:"0 -8px 24px rgba(0,0,0,0.3)" }}>
            <div style={{ padding:"10px 14px", borderBottom:"0.5px solid #1a2d4a" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8,
                background:"rgba(0,0,0,0.2)", borderRadius:8, padding:"8px 12px" }}>
                {wpLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" style={{ color:"rgba(255,255,255,0.3)", flexShrink:0 }}/>
                  : <Search className="w-4 h-4" style={{ color:"rgba(255,255,255,0.3)", flexShrink:0 }}/>
                }
                <input autoFocus style={{ background:"transparent", border:"none", outline:"none", color:"#f0f4ff", fontSize:13, flex:1 }}
                  value={wpQuery} onChange={e => setWpQuery(e.target.value)} placeholder="Cerca città…"/>
                <button type="button" onClick={() => { setWpQuery(""); setWpOpen(false); }}
                  style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.3)", fontSize:18 }}>×</button>
              </div>
            </div>
            {wpResults.map((r,i) => (
              <button key={i} type="button" onClick={() => onAddWaypoint(r)}
                style={{ width:"100%", textAlign:"left", padding:"10px 14px", fontSize:13,
                  color:"#f0f4ff", background:"none", border:"none", cursor:"pointer",
                  display:"flex", alignItems:"center", gap:10, borderBottom:"0.5px solid #1a2d4a" }}>
                <span style={{fontSize:16}}>{countryFlag(r.country_code ?? "")}</span>
                <span>{r.name}, {r.country}</span>
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={() => setWpOpen(true)}
          style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12,
            color:"rgba(255,255,255,0.4)", border:"1.5px dashed #1a2d4a",
            borderRadius:99, padding:"6px 20px", cursor:"pointer", background:"transparent" }}>
          + Aggiungi tappa
        </button>
      </div>
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
    <div style={{ minHeight:"100vh", background:"#060e1e", display:"flex", flexDirection:"column" }}>
      {/* Header */}
      <header style={{ borderBottom:"0.5px solid #1a2d4a", background:"rgba(6,14,30,0.8)",
        backdropFilter:"blur(20px)", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 24px", height:56,
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:"#60a5fa",
              display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <svg width="22" height="22" viewBox="0 0 30 30" fill="none">
                <circle cx="15" cy="15" r="11" stroke="#020d1a" strokeWidth="1.6"/>
                <ellipse cx="15" cy="15" rx="11" ry="4.8" stroke="#020d1a" strokeWidth="1.2"/>
                <ellipse cx="15" cy="15" rx="6.5" ry="11" stroke="#020d1a" strokeWidth="1.2"/>
                <polygon points="15,5.5 13.5,13 15,11.5 16.5,13" fill="#ffffff"/>
                <polygon points="15,24.5 13.5,17 15,18.5 16.5,17" fill="#ffffff" opacity="0.35"/>
                <polygon points="24.5,15 17,13.5 18.5,15 17,16.5" fill="#fbbf24"/>
                <polygon points="5.5,15 13,13.5 11.5,15 13,16.5" fill="#fbbf24" opacity="0.35"/>
              </svg>
            </div>
            <span style={{ fontSize:18, fontWeight:800, letterSpacing:"0.2em" }}>
              <span style={{color:"#60a5fa"}}>NAV</span><span style={{color:"#fbbf24"}}>·</span><span style={{color:"#fff"}}>TA</span>
            </span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <Link to="/" style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px",
              borderRadius:8, fontSize:13, color:"rgba(255,255,255,0.5)",
              textDecoration:"none" }}>
              <Plane className="w-4 h-4" style={{color:"#60a5fa"}}/> I tuoi viaggi
            </Link>
            <Link to="/statistiche" style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px",
              borderRadius:8, fontSize:13, color:"rgba(255,255,255,0.5)", textDecoration:"none" }}>
              <PieChart className="w-4 h-4" style={{color:"#60a5fa"}}/> Statistiche
            </Link>
            <div style={{ width:"1px", height:20, background:"#1a2d4a", margin:"0 4px" }}/>
            <Link to="/impostazioni" style={{ padding:"6px 8px", borderRadius:8, color:"rgba(255,255,255,0.4)", textDecoration:"none" }}>
              <Settings className="w-4 h-4"/>
            </Link>
            <Link to="/nuovo-viaggio"
              style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px",
                borderRadius:10, fontSize:13, fontWeight:600, color:"#60a5fa",
                border:"1.5px solid #60a5fa", textDecoration:"none" }}>
              <Plus className="w-4 h-4"/> Nuovo viaggio
            </Link>
          </div>
        </div>
      </header>

      {/* Main layout: itinerario hero sinistra, form destra */}
      <div style={{ flex:1, maxWidth:1200, margin:"0 auto", width:"100%",
        padding:"32px 24px", display:"flex", gap:24, alignItems:"flex-start" }}>

        {/* LEFT — Itinerario hero */}
        <div style={{ flex:1.6, background:"#0a1628", border:"0.5px solid #1a2d4a",
          borderRadius:14, overflow:"hidden", minHeight:480, display:"flex", flexDirection:"column" }}>

          <div style={{ padding:"18px 20px", borderBottom:"0.5px solid #1a2d4a",
            display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:9, background:"rgba(96,165,250,0.12)",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Route className="w-4 h-4" style={{color:"#60a5fa"}}/>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:"#f0f4ff" }}>Itinerario</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:1 }}>
                Clicca 🏠 per cambiare città di partenza
              </div>
            </div>
          </div>

          <RouteHero
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
            wpTransport={wpTransport} setWpTransport={setWpTransport}
            wpOpen={wpOpen} setWpOpen={setWpOpen}
            wpQuery={wpQuery} setWpQuery={setWpQuery}
            wpResults={wpResults} wpLoading={wpLoading}
            onAddWaypoint={addWaypoint}
          />
        </div>

        {/* RIGHT — Form compatto */}
        <div style={{ width:280, flexShrink:0, display:"flex", flexDirection:"column", gap:12 }}>

          {/* Nome */}
          <div style={{ background:"#0a1628", border:"0.5px solid #1a2d4a", borderRadius:12, padding:"14px 16px" }}>
            <label style={{ fontSize:9, color:"rgba(255,255,255,0.35)", letterSpacing:"1.5px",
              textTransform:"uppercase", display:"block", marginBottom:6 }}>Nome del viaggio</label>
            <input style={{ background:"#060e1e", border:"0.5px solid #1a2d4a", borderRadius:8,
              padding:"9px 12px", fontSize:13, color:"#f0f4ff", width:"100%",
              outline:"none", boxSizing:"border-box" }}
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Es. Viaggio di nozze…"
              onFocus={e => (e.target.style.borderColor="#60a5fa")}
              onBlur={e => (e.target.style.borderColor="#1a2d4a")}/>
          </div>

          {/* Periodo */}
          <div style={{ background:"#0a1628", border:"0.5px solid #1a2d4a", borderRadius:12, padding:"14px 16px" }}>
            <label style={{ fontSize:9, color:"rgba(255,255,255,0.35)", letterSpacing:"1.5px",
              textTransform:"uppercase", display:"block", marginBottom:6 }}>Periodo</label>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"#060e1e",
                border:"0.5px solid #1a2d4a", borderRadius:8, padding:"8px 12px" }}>
                <Plane className="w-3.5 h-3.5" style={{ color:"#60a5fa", flexShrink:0, transform:"rotate(-45deg)" }}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:8, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:1 }}>Partenza</div>
                  <input type="date" style={{ background:"transparent", border:"none", outline:"none",
                    color:"#f0f4ff", fontSize:12, fontWeight:500, width:"100%" }}
                    value={dateStart} onChange={e => setDateStart(e.target.value)}/>
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"#060e1e",
                border:"0.5px solid #1a2d4a", borderRadius:8, padding:"8px 12px" }}>
                <Plane className="w-3.5 h-3.5" style={{ color:"#60a5fa", flexShrink:0, transform:"rotate(45deg) scaleX(-1)" }}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:8, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:1 }}>
                    Ritorno {days ? `· ${days}g` : ""}
                  </div>
                  <input type="date" style={{ background:"transparent", border:"none", outline:"none",
                    color: dateEnd ? "#f0f4ff" : "rgba(255,255,255,0.3)", fontSize:12, fontWeight:500, width:"100%" }}
                    value={dateEnd} onChange={e => setDateEnd(e.target.value)}/>
                </div>
              </div>
            </div>
          </div>

          {/* Note */}
          <div style={{ background:"#0a1628", border:"0.5px solid #1a2d4a", borderRadius:12, padding:"14px 16px" }}>
            <label style={{ fontSize:9, color:"rgba(255,255,255,0.35)", letterSpacing:"1.5px",
              textTransform:"uppercase", display:"block", marginBottom:6 }}>
              Note <span style={{ opacity:0.4, fontSize:9, textTransform:"none" }}>(opzionale)</span>
            </label>
            <textarea style={{ background:"#060e1e", border:"0.5px solid #1a2d4a", borderRadius:8,
              padding:"9px 12px", fontSize:13, color:"rgba(255,255,255,0.4)", width:"100%",
              outline:"none", resize:"none", boxSizing:"border-box", height:80, fontFamily:"inherit" }}
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Aggiungi una nota…"
              onFocus={e => (e.target.style.borderColor="#60a5fa")}
              onBlur={e => (e.target.style.borderColor="#1a2d4a")}/>
          </div>

          {/* Valutazione */}
          <div style={{ background:"#0a1628", border:"0.5px solid #1a2d4a", borderRadius:12, padding:"14px 16px" }}>
            <label style={{ fontSize:9, color:"rgba(255,255,255,0.35)", letterSpacing:"1.5px",
              textTransform:"uppercase", display:"block", marginBottom:8 }}>
              Valutazione <span style={{ opacity:0.4, fontSize:9, textTransform:"none" }}>(opzionale)</span>
            </label>
            <div style={{ display:"flex", gap:4 }}>
              {[1,2,3,4,5].map(i => (
                <button key={i} type="button"
                  onMouseEnter={() => setHoverRating(i)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(rating === i ? 0 : i)}
                  style={{ fontSize:26, background:"none", border:"none", cursor:"pointer", padding:0,
                    color: i <= (hoverRating||rating) ? "#fbbf24" : "rgba(255,255,255,0.15)",
                    transform: i <= (hoverRating||rating) ? "scale(1.15)" : "scale(1)",
                    transition:"color 0.1s, transform 0.1s" }}>★</button>
              ))}
            </div>
            {(hoverRating||rating) > 0 && (
              <div style={{ fontSize:11, color:"#fbbf24", marginTop:6 }}>{RATING_LABELS[hoverRating||rating]}</div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display:"flex", gap:8, paddingTop:4 }}>
            <Link to="/" style={{ flex:1, textAlign:"center", padding:"10px", borderRadius:10,
              fontSize:13, color:"rgba(255,255,255,0.4)", border:"0.5px solid #1a2d4a",
              textDecoration:"none", background:"transparent" }}>
              Annulla
            </Link>
            <button onClick={handleSave} disabled={saving}
              style={{ flex:2, padding:"10px", borderRadius:10, fontSize:13, fontWeight:700,
                color:"#060e1e", background:"#60a5fa", border:"none", cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              {saving && <Loader2 className="w-4 h-4 animate-spin"/>}
              Salva viaggio
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default NuovoViaggio;
