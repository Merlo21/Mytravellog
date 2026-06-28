import React, { useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Link, useNavigate, useParams } from "react-router-dom";
import { searchPlaces, fetchElevation, fetchTemperature, distanceKm, countryFlag, GeoResult } from "@/lib/geo";
import { addTrip, updateTrip, loadTrips } from "@/lib/storage";
import { useSettings } from "@/lib/settings";
import { toast } from "sonner";
import { Loader2, MapPin, Plane, Train, Car, Ship, Footprints, Route, Search } from "lucide-react";

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
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = React.useState(600);
  const [activeArc, setActiveArc] = React.useState<number | null>(null);

  React.useEffect(() => {
    const obs = new ResizeObserver(entries => {
      setContainerW(entries[0].contentRect.width);
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const homeLabel = home?.label?.split(",")[0] ?? "Casa";
  const stops = [
    { label: homeLabel, flag: "🏠", isHome: true, transport: null as TransportMode | null },
    ...waypoints.map(w => ({ label: w.city, flag: countryFlag(w.country_code), isHome: false, transport: w.transport_mode })),
  ];

  const n = stops.length;
  const W = containerW - 40;
  const H = 160;
  const nodeR = Math.min(32, Math.max(20, W / (n * 3.5)));
  const pad = nodeR + 20;
  const step = n > 1 ? (W - pad * 2) / (n - 1) : 0;
  const cx = (i: number) => pad + 20 + i * step;
  const cy = 90;

  const showArcs = waypoints.length > 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>

      {/* SVG — full width */}
      <div ref={containerRef} style={{ flex:1, padding:"20px 0 0", position:"relative" }}>
        {showArcs ? (
          <div style={{ position:"relative", width:"100%" }}>
            <svg width="100%" height={H} viewBox={`0 0 ${W + 40} ${H}`}
              style={{ display:"block", overflow:"visible" }}>
              <defs>
                {TRANSPORT.map(t => (
                  <marker key={t.value} id={`h2-arr-${t.value}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill={t.color} opacity="0.8"/>
                  </marker>
                ))}
              </defs>

              {/* Arcs */}
              {stops.map((stop, i) => {
                if (i === 0) return null;
                const t = TRANSPORT.find(t => t.value === stop.transport) ?? TRANSPORT[0];
                const x1 = cx(i-1), x2 = cx(i), mx = (x1+x2)/2;
                const arcH = Math.min(65, Math.max(28, (x2-x1)*0.38));
                return (
                  <g key={i}>
                    <path d={`M ${x1} ${cy} Q ${mx} ${cy-arcH} ${x2} ${cy}`}
                      stroke={t.color} strokeWidth="2" strokeDasharray="5 3"
                      fill="none" opacity="0.7" markerEnd={`url(#h2-arr-${t.value})`}/>
                    {/* Transport pill on arc — clickable */}
                    <g style={{cursor:"pointer"}} onClick={() => setActiveArc(activeArc === i ? null : i)}>
                      <rect x={mx-32} y={cy-arcH-14} width="64" height="20" rx="10"
                        fill={t.bg} stroke={t.color} strokeWidth="1" strokeOpacity="0.8"/>
                      <text x={mx} y={cy-arcH-1} fontSize="10.5" textAnchor="middle" fill={t.color}>{t.label}</text>
                    </g>
                    {/* Transport picker — small popup on arc */}
                    {activeArc === i && (
                      <g onClick={e => e.stopPropagation()}>
                        <rect x={mx-80} y={cy-arcH-68} width="160" height="46" rx="8"
                          fill="#0d1f3c" stroke="#1a2d4a" strokeWidth="0.5"/>
                        <text x={mx} y={cy-arcH-52} fontSize="8" textAnchor="middle" fill="rgba(255,255,255,0.35)">
                          Cambia mezzo
                        </text>
                        {TRANSPORT.map((opt, j) => {
                          const bx = mx - 60 + j * 30;
                          const by = cy - arcH - 38;
                          return (
                            <g key={opt.value} style={{cursor:"pointer"}}
                              onClick={() => {
                                waypoints[i-1].transport_mode = opt.value;
                                onRemoveWaypoint(-99);
                                setActiveArc(null);
                              }}>
                              <rect x={bx-12} y={by-12} width="24" height="24" rx="6"
                                fill={stop.transport === opt.value ? opt.bg : "rgba(255,255,255,0.03)"}
                                stroke={stop.transport === opt.value ? opt.color : "#1a2d4a"}
                                strokeWidth="0.5"/>
                              <text x={bx} y={by+5} fontSize="12" textAnchor="middle">
                                {opt.value === "plane" ? "✈" : opt.value === "train" ? "🚂" : opt.value === "car" ? "🚗" : opt.value === "ship" ? "⛵" : "🚶"}
                              </text>
                            </g>
                          );
                        })}
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Nodes */}
              {stops.map((stop, i) => {
                const x = cx(i);
                const isLast = i === stops.length-1 && stops.length > 1;
                const lastT = isLast ? TRANSPORT.find(t => t.value === stop.transport) ?? TRANSPORT[0] : null;
                const borderColor = stop.isHome ? "#fbbf24" : lastT ? lastT.color : "#60a5fa";
                const bgFill = stop.isHome ? "rgba(251,191,36,0.1)" : lastT ? lastT.bg : "rgba(96,165,250,0.08)";
                const r = isLast ? nodeR + 4 : nodeR;
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
                    <text x={x} y={cy+r+13} fontSize="9.5" textAnchor="middle"
                      fill={isLast ? borderColor : "rgba(255,255,255,0.4)"}
                      fontWeight={isLast ? "600" : "normal"}>
                      {stop.label.length > 9 ? stop.label.slice(0,8)+"…" : stop.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* HTML emoji overlays */}
            <div style={{ position:"absolute", top:20, left:0, width:"100%", pointerEvents:"none" }}>
              {stops.map((stop, i) => {
                const x = cx(i);
                const isLast = i === stops.length-1 && stops.length > 1;
                const r = isLast ? nodeR + 4 : nodeR;
                return (
                  <div key={i} style={{
                    position:"absolute",
                    left: x / (W + 40) * 100 + "%",
                    top: cy - r * 0.55,
                    width: r * 1.1, height: r * 1.1,
                    transform: "translateX(-50%)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize: r * 0.72, lineHeight:1, userSelect:"none"
                  }}>{stop.flag}</div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Empty state — full width */
          <div style={{ position:"relative", width:"100%", height:H }}>
            <svg width="100%" height={H} viewBox={`0 0 ${W+40} ${H}`}
              style={{ display:"block", overflow:"visible" }}>
              {/* Ghost arcs */}
              <path d={`M 60 80 Q ${(W+40)*0.35} 20 ${(W+40)*0.5} 80`}
                stroke="#1a2d4a" strokeWidth="1.5" strokeDasharray="6 4" fill="none"/>
              <path d={`M ${(W+40)*0.5} 80 Q ${(W+40)*0.72} 20 ${W-20} 80`}
                stroke="#1a2d4a" strokeWidth="1.5" strokeDasharray="6 4" fill="none"/>
              {/* Casa */}
              <circle cx="60" cy="80" r="26" fill="rgba(251,191,36,0.1)" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="3 2"/>
              <circle cx="74" cy="60" r="9" fill="#0d1f3c" stroke="#fbbf24" strokeWidth="1"/>
              <text x="74" y="64" fontSize="11" textAnchor="middle" fill="#fbbf24">✎</text>
              <text x="60" y="113" fontSize="9" textAnchor="middle" fill="rgba(255,255,255,0.4)">{homeLabel.slice(0,9)}</text>
              {/* Ghost 1 */}
              <circle cx={(W+40)*0.5} cy="80" r="24" fill="rgba(255,255,255,0.02)" stroke="#1a2d4a" strokeWidth="1.5" strokeDasharray="3 2"/>
              <text x={(W+40)*0.5} y="85" fontSize="20" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.1)">+</text>
              <text x={(W+40)*0.5} y="112" fontSize="9" textAnchor="middle" fill="rgba(255,255,255,0.12)">tappa</text>
              {/* Ghost 2 */}
              <circle cx={W-20} cy="80" r="28" fill="rgba(255,255,255,0.02)" stroke="#1a2d4a" strokeWidth="1.5" strokeDasharray="3 2"/>
              <text x={W-20} y="85" fontSize="22" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.1)">+</text>
              <text x={W-20} y="116" fontSize="9" textAnchor="middle" fill="rgba(255,255,255,0.12)">destinazione</text>
            </svg>
            {/* Casa emoji */}
            <div style={{ position:"absolute", top:54, left:36,
              width:48, height:48, display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:22, cursor:"pointer" }} onClick={onEditHome}>🏠</div>
          </div>
        )}
      </div>

      {/* Home edit field */}
      {editingHome && (
        <div style={{ margin:"0 20px 8px", background:"#0d1f3c", border:"0.5px solid #fbbf24",
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

      {/* Aggiungi tappa — inline search, no overlay */}
      <div style={{ padding:"8px 20px 20px" }}>
        {wpOpen ? (
          <div style={{ background:"#0a1e38", border:"0.5px solid #1a2d4a", borderRadius:10, overflow:"hidden" }}>
            {/* Mezzo */}
            <div style={{ padding:"10px 14px 8px", borderBottom:"0.5px solid #1a2d4a",
              display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
              <span style={{ fontSize:9, color:"rgba(255,255,255,0.35)", letterSpacing:"1px",
                textTransform:"uppercase", marginRight:4 }}>Mezzo</span>
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
            {/* Search */}
            <div style={{ padding:"10px 14px", display:"flex", alignItems:"center", gap:8 }}>
              {wpLoading
                ? <Loader2 className="w-4 h-4 animate-spin" style={{ color:"rgba(255,255,255,0.3)", flexShrink:0 }}/>
                : <Search className="w-4 h-4" style={{ color:"rgba(255,255,255,0.3)", flexShrink:0 }}/>
              }
              <input autoFocus style={{ background:"transparent", border:"none", outline:"none",
                color:"#f0f4ff", fontSize:13, flex:1 }}
                value={wpQuery} onChange={e => setWpQuery(e.target.value)} placeholder="Cerca città…"/>
              <button type="button" onClick={() => { setWpQuery(""); setWpOpen(false); }}
                style={{ background:"none", border:"none", cursor:"pointer",
                  color:"rgba(255,255,255,0.3)", fontSize:18 }}>×</button>
            </div>
            {/* Results */}
            {wpResults.map((r,i) => (
              <button key={i} type="button" onClick={() => onAddWaypoint(r)}
                style={{ width:"100%", textAlign:"left", padding:"10px 14px", fontSize:13,
                  color:"#f0f4ff", background:"none", border:"none", cursor:"pointer",
                  display:"flex", alignItems:"center", gap:10, borderTop:"0.5px solid #1a2d4a" }}>
                <span style={{fontSize:16}}>{countryFlag(r.country_code ?? "")}</span>
                <span>{r.name}, {r.country}</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display:"flex", justifyContent:"center" }}>
            <button type="button" onClick={() => setWpOpen(true)}
              style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12,
                color:"rgba(255,255,255,0.4)", border:"1.5px dashed #1a2d4a",
                borderRadius:99, padding:"6px 20px", cursor:"pointer", background:"transparent" }}>
              + Aggiungi tappa
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


const ModificaViaggio = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { distanceUnit } = useSettings();

  const trip = loadTrips().find(t => t.id === id);
  if (!trip) { navigate("/"); return null; }

  const [title, setTitle] = useState(trip?.title ?? "");
  const [dateStart, setDateStart] = useState(trip?.trip_date ?? new Date().toISOString().slice(0, 10));
  const [dateEnd, setDateEnd] = useState(trip?.date_end ?? "");
  const [notes, setNotes] = useState(trip?.notes ?? "");
  const [rating, setRating] = useState(trip?.rating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [waypoints, setWaypoints] = useState<Waypoint[]>(
    trip ? [
      ...(trip.waypoints ?? []).map(w => ({
        city: w.city, country: w.country,
        country_code: "", lat: 0, lon: 0,
        transport_mode: w.transport_mode as TransportMode,
      })),
      {
        city: trip.city, country: trip.country,
        country_code: trip.country_code,
        lat: trip.latitude, lon: trip.longitude,
        transport_mode: (trip.transport_mode ?? "plane") as TransportMode,
      }
    ] : []
  );
  const [wpQuery, setWpQuery] = useState("");
  const [wpResults, setWpResults] = useState<GeoResult[]>([]);
  const [wpLoading, setWpLoading] = useState(false);
  const [wpOpen, setWpOpen] = useState(false);
  const [wpTransport, setWpTransport] = useState<TransportMode>("plane");
  const [home, setHome] = useState<{ lat: number; lon: number; label: string } | null>(
    trip?.home_latitude ? { lat: trip.home_latitude, lon: trip.home_longitude, label: trip.home_label ?? "" } : null
  );
  const [editingHome, setEditingHome] = useState(false);
  const [homeQuery, setHomeQuery] = useState(trip?.home_label ?? "");
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
      lat: r.latitude, lon: r.longitude, transport_mode: wpTransport,
    }]);
    setWpQuery(""); setWpResults([]); setWpOpen(false);
  };

  const removeWaypoint = (i: number) => setWaypoints(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!id || waypoints.length === 0) { toast.error("Aggiungi almeno una città all'itinerario"); return; }
    setSaving(true);
    const dest = waypoints[waypoints.length - 1];
    const dist = home ? distanceKm(home.lat, home.lon, dest.lat, dest.lon) : null;
    const [alt, temp] = await Promise.all([
      dest.lat ? fetchElevation(dest.lat, dest.lon) : Promise.resolve(trip?.altitude_m ?? null),
      dest.lat ? fetchTemperature(dest.lat, dest.lon) : Promise.resolve(trip?.temperature_c ?? null),
    ]);
    updateTrip(id, {
      title: title.trim() || dest.city,
      country: dest.country, city: dest.city,
      trip_date: dateStart, date_end: dateEnd || null,
      notes: notes.trim() || null,
      transport_mode: dest.transport_mode,
      waypoints: waypoints.slice(0, -1).map(w => ({ city: w.city, country: w.country, transport_mode: w.transport_mode })),
      latitude: dest.lat || trip?.latitude || 0,
      longitude: dest.lon || trip?.longitude || 0,
      home_latitude: home?.lat ?? null, home_longitude: home?.lon ?? null,
      home_label: home?.label ?? null,
      distance_from_home_km: dist, altitude_m: alt, temperature_c: temp,
      country_code: dest.country_code || trip?.country_code || "",
      rating: rating || null,
    });
    toast.success("Viaggio aggiornato!");
    setSaving(false);
    navigate("/");
  };

  const days = daysBetween(dateStart, dateEnd);

  return (
    <div style={{ minHeight:"100vh", background:"#060e1e", display:"flex", flexDirection:"column" }}>
      {/* Header */}
      <AppHeader/>

      {/* Main layout: itinerario hero sinistra, form destra */}
      <div style={{ maxWidth:1200, margin:"0 auto", width:"100%",
        padding:"32px 24px", display:"grid", gridTemplateColumns:"1fr 280px", gap:24, alignItems:"stretch" }}>

        {/* LEFT — Itinerario hero */}
        <div style={{ background:"#0a1628", border:"0.5px solid #1a2d4a",
          borderRadius:14, overflow:"hidden", display:"flex", flexDirection:"column", height:"100%" }}>

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

          <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
          <RouteHero
            waypoints={waypoints} home={home}
            onEditHome={() => { setEditingHome(v => !v); setHomeQuery(home?.label ?? ""); }}
            editingHome={editingHome}
            homeQuery={homeQuery} setHomeQuery={setHomeQuery}
            homeResults={homeResults}
            onSelectHome={r => {
              setHome({ lat:r.latitude, lon:r.longitude, label:`${r.name}, ${r.country}` });
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
        </div>

        {/* RIGHT — Form compatto */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

          {/* Nome */}
          <div style={{ background:"#0a1628", border:"0.5px solid #1a2d4a", borderRadius:8, padding:"14px 16px" }}>
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

          {/* Periodo — Corretto, senza la durata interna */}
          <div style={{ background:"#0a1628", border:"0.5px solid #1a2d4a", borderRadius:8, padding:"14px 16px" }}>
            
            {/* Riga superiore: Titolo a sinistra, Durata a destra */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <label style={{ fontSize:9, color:"rgba(255,255,255,0.35)", letterSpacing:"1.5px", textTransform:"uppercase", display:"block", margin: 0 }}>
                Periodo
              </label>
              
              {days && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1 }}>Durata</span>
                  <div style={{ 
                    background: "rgba(96, 165, 250, 0.15)", color: "#60a5fa", 
                    fontWeight: 700, fontSize: 11, padding: "2px 8px", 
                    borderRadius: 6, border: "1px solid rgba(96, 165, 250, 0.25)" 
                  }}>
                    {days}g
                  </div>
                </div>
              )}
            </div>
            
            {/* Box degli Input Rettangolare */}
            <div 
              style={{ 
                display:"flex", alignItems:"center", background:"#060e1e", 
                border:"1px solid transparent", borderColor:"#1a2d4a", borderRadius:8, 
                padding:"8px 10px", transition:"border-color 0.2s ease" 
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor="rgba(96, 165, 250, 0.4)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor="#1a2d4a")}
            >
              
              {/* ICONA AEREO */}
              <div style={{ display:"flex", alignItems:"center", paddingLeft:2, paddingRight:2, flexShrink:0 }}>
                <Plane className="w-4 h-4" style={{ color:"#60a5fa", transform:"rotate(-45deg)" }}/>
              </div>

              {/* PARTENZA */}
              <div style={{ display:"flex", flexDirection:"column", flex:1, minWidth:0, marginLeft:4 }}>
                <span style={{ fontSize:9, color:"rgba(255,255,255,0.4)", textTransform:"uppercase", letterSpacing:1 }}>Partenza</span>
                <input type="date"
                  style={{ background:"transparent", border:"none", outline:"none",
                    color:"#f0f4ff", fontSize:12, fontWeight:600, width:"100%",
                    colorScheme:"dark", padding:0, marginTop:1 }}
                  value={dateStart} onChange={e => setDateStart(e.target.value)}/>
              </div>
              
              {/* CONNETTORE TRATTEGGIATO */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"0 6px", flexShrink:0 }}>
                <div style={{ 
                  height:2, width:16, position:"relative",
                  backgroundImage: "linear-gradient(to right, rgba(255, 255, 255, 0.15) 20%, rgba(255,255,255,0) 0%)",
                  backgroundPosition: "bottom", backgroundSize: "6px 2px", backgroundRepeat: "repeat-x"
                }}>
                  <div style={{ 
                    position:"absolute", right:-4, top:-3, width:0, height:0, 
                    borderTop:"4px solid transparent", borderBottom:"4px solid transparent", 
                    borderLeft:"6px solid rgba(255, 255, 255, 0.15)" 
                  }}/>
                </div>
              </div>
              
              {/* RITORNO */}
              <div style={{ display:"flex", flexDirection:"column", flex:1, minWidth:0, marginLeft:2 }}>
                <span style={{ fontSize:9, color:"rgba(255,255,255,0.4)", textTransform:"uppercase", letterSpacing:1 }}>Ritorno</span>
                <input type="date"
                  style={{ background:"transparent", border:"none", outline:"none",
                    color: dateEnd ? "#f0f4ff" : "rgba(255,255,255,0.35)", fontSize:12, fontWeight:600, width:"100%",
                    colorScheme:"dark", padding:0, marginTop:1 }}
                  value={dateEnd} onChange={e => setDateEnd(e.target.value)}/>
              </div>

            </div>
          </div>

          {/* Note */}
          <div style={{ background:"#0a1628", border:"0.5px solid #1a2d4a", borderRadius:8, padding:"14px 16px" }}>
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
          <div style={{ background:"#0a1628", border:"0.5px solid #1a2d4a", borderRadius:8, padding:"14px 16px" }}>
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

export default ModificaViaggio;
