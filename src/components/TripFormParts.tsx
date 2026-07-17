// [FROZEN] — Non modificare senza esplicita richiesta
//
// Tutto ciò che NuovoViaggio.tsx e ModificaViaggio.tsx condividono: prima era
// duplicato quasi riga per riga nei due file (~600 righe a testa), e i bug si
// correggevano in uno dimenticando l'altro — è successo davvero: la regione
// veniva salvata in inglese da un form e in italiano dall'altro, e le icone
// dei mezzi erano Lucide in Nuovo e SVG disegnati a mano in Modifica. Ora la
// versione è una sola (icone Lucide, le stesse delle Statistiche).
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { GeoResult } from "@/lib/geo";
import { parseLocalDate } from "@/lib/storage";
import { TripPhotos } from "@/components/TripPhotos";
import { homePhotoKey, waypointPhotoKey, destinationPhotoKey } from "@/lib/photoStorage";
import { Loader2, MapPin, Plane, Train, Car, Ship, Footprints, Bike, Route, Search, AlertCircle, X } from "lucide-react";
import { Motorcycle } from "@/components/icons/Motorcycle";

export type TransportMode = "plane" | "train" | "car" | "ship" | "walk" | "bici" | "moto";
export type Waypoint = { id: string; city: string; country: string; country_code: string; lat: number; lon: number; transport_mode: TransportMode };

const TRANSPORT: { value: TransportMode; label: string; color: string; bg: string }[] = [
  { value: "plane", label: "Aereo",   color: "#378ADD", bg: "rgba(55,138,221,0.15)"  },
  { value: "train", label: "Treno",   color: "#BA7517", bg: "rgba(186,117,23,0.15)"  },
  { value: "car",   label: "Auto",    color: "#A855F7", bg: "rgba(168,85,247,0.15)"  },
  { value: "ship",  label: "Nave",    color: "#0F6E56", bg: "rgba(15,110,86,0.15)"   },
  { value: "walk",  label: "A piedi", color: "#D85A30", bg: "rgba(216,90,48,0.15)"   },
  { value: "bici",  label: "Bici",    color: "#22C55E", bg: "rgba(34,197,94,0.15)"   },
  { value: "moto",  label: "Moto",    color: "#EAB308", bg: "rgba(234,179,8,0.15)"   },
];

const RATING_LABELS: Record<number, string> = {
  1: "Non memorabile", 2: "Nella media", 3: "Bello", 4: "Fantastico", 5: "Indimenticabile"
};

// Inclusivo (1-5 giugno = 5 giorni): stessa convenzione della heatmap in
// Statistiche, che con il vecchio calcolo per differenza di date contava un
// giorno in più per lo stesso identico viaggio (v. TripCardTicket.tsx).
function daysBetween(a: string, b: string) {
  if (!a || !b) return null;
  const d = Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / 86400000) + 1;
  return d > 0 ? d : null;
}

/** Ritorno prima della partenza: usato per l'errore inline e per bloccare il salvataggio. */
export function isReturnBeforeDeparture(dateStart: string, dateEnd: string): boolean {
  return !!dateEnd && dateEnd < dateStart;
}

// Lucide transport icons — same as statistics section
const TRANSPORT_SVG: Record<string, (color: string, size?: number) => React.ReactElement> = {
  plane: (c, s=24) => <Plane width={s} height={s} stroke={c} strokeWidth={1.5}/>,
  train: (c, s=24) => <Train width={s} height={s} stroke={c} strokeWidth={1.5}/>,
  car:   (c, s=24) => <Car   width={s} height={s} stroke={c} strokeWidth={1.5}/>,
  ship:  (c, s=24) => <Ship  width={s} height={s} stroke={c} strokeWidth={1.5}/>,
  walk:  (c, s=24) => <Footprints width={s} height={s} stroke={c} strokeWidth={1.5}/>,
  bici:  (c, s=24) => <Bike  width={s} height={s} stroke={c} strokeWidth={1.5}/>,
  moto:  (c, s=24) => <Motorcycle width={s} height={s} stroke={c} strokeWidth={1.5}/>,
};

function ContinuousFlyer({ stops, cx, cy, W }: {
  stops: { label: string; isHome: boolean; transport: string | null }[];
  cx: (i: number) => number;
  cy: number;
  W: number;
}) {
  const [progress, setProgress] = React.useState(0);
  const animRef = React.useRef<number>();
  const startRef = React.useRef<number>();
  const DURATION = 5000; // ms per full journey

  React.useEffect(() => {
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = (ts - startRef.current) % DURATION;
      setProgress(elapsed / DURATION);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  const arcs = stops.map((stop, i) => {
    if (i === 0) return null;
    const x1 = cx(i-1), x2 = cx(i), mx = (x1+x2)/2;
    const arcH = Math.min(65, Math.max(25, (x2-x1)*0.38));
    return { x1, x2, mx, arcH, transport: stop.transport };
  }).filter(Boolean) as { x1:number; x2:number; mx:number; arcH:number; transport:string|null }[];

  if (arcs.length === 0) return null;

  // Total arcs, distribute progress evenly
  const n = arcs.length;
  const arcIdx = Math.min(Math.floor(progress * n), n - 1);
  const arcProgress = (progress * n) - arcIdx;
  const arc = arcs[arcIdx];
  const t = arc.transport ?? "plane";

  // Bezier point: B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
  const bt = arcProgress;
  const x = Math.pow(1-bt,2)*arc.x1 + 2*(1-bt)*bt*arc.mx + Math.pow(bt,2)*arc.x2;
  const y = Math.pow(1-bt,2)*cy     + 2*(1-bt)*bt*(cy-arc.arcH) + Math.pow(bt,2)*cy;

  // Tangent angle for rotation
  const dx = 2*(1-bt)*(arc.mx-arc.x1) + 2*bt*(arc.x2-arc.mx);
  const dy = 2*(1-bt)*((cy-arc.arcH)-cy) + 2*bt*(cy-(cy-arc.arcH));
  const angle = Math.atan2(dy, dx) * (180/Math.PI);

  const color = TRANSPORT.find(x => x.value === t)?.color ?? "#378ADD";

  const pct = ((x / (W + 40)) * 100);

  return (
    <div style={{
      position: "absolute",
      top: 0, left: 0,
      width: "100%",
      height: "100%",
      pointerEvents: "none",
    }}>
      <div style={{
        position: "absolute",
        left: `${pct}%`,
        top: y,
        transform: `translate(-50%, -50%) rotate(${angle}deg)`,
        filter: `drop-shadow(0 0 5px ${color}) drop-shadow(0 0 12px ${color}) drop-shadow(0 0 24px ${color}80)`,
        lineHeight: 1,
        transition: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        {(TRANSPORT_SVG[t] ?? TRANSPORT_SVG.plane)(color, 28)}
      </div>
    </div>
  );
}

export interface RouteHeroProps {
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
  destinationError?: boolean;
}

function RouteHero({
  waypoints, home, onEditHome, editingHome,
  homeQuery, setHomeQuery, homeResults, onSelectHome, onRemoveWaypoint,
  wpTransport, setWpTransport, wpOpen, setWpOpen, wpQuery, setWpQuery,
  wpResults, wpLoading, onAddWaypoint, destinationError
}: RouteHeroProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = React.useState(600);
  const [activeArc, setActiveArc] = React.useState<number | null>(null);

  React.useEffect(() => {
    const obs = new ResizeObserver(entries => setContainerW(entries[0].contentRect.width));
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const homeLabel = home?.label?.split(",")[0] ?? "Casa";
  const stops = [
    { label: homeLabel, countryCode: null as string | null, isHome: true, transport: null as TransportMode | null },
    ...waypoints.map(w => ({ label: w.city, countryCode: w.country_code as string | null, isHome: false, transport: w.transport_mode as TransportMode | null })),
  ];

  const n = stops.length;
  const W = containerW - 40;
  const H = 160;
  const nodeR = Math.min(34, Math.max(22, W / (n * 3.5)));
  const pad = nodeR + 24;
  const step = n > 1 ? (W - pad * 2) / (n - 1) : 0;
  const cx = (i: number) => pad + 20 + i * step;
  const cy = 95;
  const showArcs = waypoints.length > 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div ref={containerRef} style={{ flex:1, padding:"20px 0 0", position:"relative" }}>
        {showArcs ? (
          <div style={{ position:"relative", width:"100%" }}>
            <svg width="100%" height={H} viewBox={`0 0 ${W + 40} ${H}`}
              style={{ display:"block", overflow:"visible" }}>
              <defs>
                {TRANSPORT.map(t => (
                  <marker key={t.value} id={`tf-arr-${t.value}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill={t.color} opacity="0.8"/>
                  </marker>
                ))}
              </defs>

              {/* Arcs */}
              {stops.map((stop, i) => {
                if (i === 0) return null;
                const t = TRANSPORT.find(t => t.value === stop.transport) ?? TRANSPORT[0];
                const x1 = cx(i-1), x2 = cx(i), mx = (x1+x2)/2;
                const arcH = Math.min(65, Math.max(25, (x2-x1)*0.38));
                return (
                  <g key={i}>
                    {/* Glow */}
                    <path d={`M ${x1} ${cy} Q ${mx} ${cy-arcH} ${x2} ${cy}`}
                      stroke={t.color} strokeWidth="8" fill="none" opacity="0.06"/>
                    {/* Arc */}
                    <path d={`M ${x1} ${cy} Q ${mx} ${cy-arcH} ${x2} ${cy}`}
                      stroke={t.color} strokeWidth="2" strokeDasharray="5 3"
                      fill="none" opacity="0.6" markerEnd={`url(#tf-arr-${t.value})`}/>
                    {/* Clickable arc for transport change */}
                    <path d={`M ${x1} ${cy} Q ${mx} ${cy-arcH} ${x2} ${cy}`}
                      stroke="transparent" strokeWidth="20" fill="none"
                      style={{cursor:"pointer"}}
                      onClick={() => setActiveArc(activeArc === i ? null : i)}/>
                    {/* Transport picker popup */}
                    {activeArc === i && (
                      <g onClick={e => e.stopPropagation()}>
                        <rect x={mx-119} y={cy-arcH-84} width="238" height="60" rx="10"
                          fill="#0d1f3c" stroke="#1a2d4a" strokeWidth="0.5"/>
                        <text x={mx} y={cy-arcH-64} fontSize="9" textAnchor="middle" fill="rgba(255,255,255,0.4)">Cambia mezzo</text>
                        {TRANSPORT.map((opt, j) => {
                          const bx = mx - 96 + j * 32;
                          const by = cy - arcH - 44;
                          return (
                            <g key={opt.value} style={{cursor:"pointer"}}
                              onClick={() => { waypoints[i-1].transport_mode = opt.value; onRemoveWaypoint(-99); setActiveArc(null); }}>
                              {/* Area di tap invisibile: affiancate a passo 32 (il
                                  passo stesso tra le icone), senza sovrapporsi alle vicine. */}
                              <rect x={bx-16} y={by-18} width="32" height="36" fill="transparent"/>
                              <rect x={bx-14} y={by-14} width="28" height="28" rx="8"
                                fill={stop.transport === opt.value ? opt.bg : "rgba(255,255,255,0.05)"}
                                stroke={stop.transport === opt.value ? opt.color : "#1a2d4a"} strokeWidth="1"/>
                              <foreignObject x={bx-11} y={by-11} width="22" height="22">
                                <div style={{display:"flex",alignItems:"center",justifyContent:"center",width:"100%",height:"100%"}}>
                                  {TRANSPORT_SVG[opt.value]?.(opt.color, 19)}
                                </div>
                              </foreignObject>
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
                const r = isLast ? nodeR + 5 : nodeR;
                return (
                  <g key={i}>
                    <circle cx={x} cy={cy} r={r} fill={bgFill} stroke={borderColor}
                      strokeWidth={isLast ? 2.5 : 1.5} strokeDasharray={stop.isHome ? "3 2" : "none"}/>
                    {stop.isHome && (
                      <g style={{cursor:"pointer"}} onClick={onEditHome}>
                        {/* Area di tap invisibile, più ampia del pallino visibile
                            (che resta a r=10 ≈ 20px): un target reale da ~40px
                            senza appesantire il disegno. */}
                        <circle cx={x+r-4} cy={cy-r+4} r="20" fill="transparent"/>
                        <circle cx={x+r-4} cy={cy-r+4} r="10" fill="#0d1f3c" stroke="#fbbf24" strokeWidth="1.5"/>
                        <text x={x+r-4} y={cy-r+8} fontSize="11" textAnchor="middle" fill="#fbbf24">✎</text>
                      </g>
                    )}
                    {!stop.isHome && (
                      <g style={{cursor:"pointer"}} onClick={() => onRemoveWaypoint(i-1)}>
                        <circle cx={x+r-3} cy={cy-r+3} r="20" fill="transparent"/>
                        <circle cx={x+r-3} cy={cy-r+3} r="9" fill="#060e1e"
                          stroke={isLast ? borderColor : "#1a2d4a"} strokeWidth="1.5"/>
                        <text x={x+r-3} y={cy-r+7} fontSize="10" textAnchor="middle"
                          fill={isLast ? borderColor : "rgba(255,255,255,0.4)"}>×</text>
                      </g>
                    )}
                    <text x={x} y={cy+r+14} fontSize="9.5" textAnchor="middle"
                      fill={isLast ? borderColor : "rgba(255,255,255,0.4)"}
                      fontWeight={isLast ? "600" : "normal"}>
                      {stop.label.length > 9 ? stop.label.slice(0,8)+"…" : stop.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* HTML overlays: home emoji + flag CDN images */}
            <div style={{ position:"absolute", top:0, left:0, width:"100%", pointerEvents:"none" }}>
              {stops.map((stop, i) => {
                const x = cx(i);
                const isLast = i === stops.length-1 && stops.length > 1;
                const r = isLast ? nodeR + 5 : nodeR;
                const size = r * 1.3;
                return (
                  <div key={i} style={{
                    position:"absolute",
                    left: (x / (W+40)) * 100 + "%",
                    top: cy - r * 0.6,
                    transform: "translateX(-50%)",
                    width: size, height: size,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    overflow: "hidden",
                    borderRadius: "50%",
                  }}>
                    {stop.isHome
                      ? <span style={{ fontSize: r * 0.75, lineHeight:1 }}>🏠</span>
                      : stop.countryCode
                        ? <img
                            src={`https://flagcdn.com/w80/${stop.countryCode.toLowerCase()}.png`}
                            style={{ width:"100%", height:"100%", objectFit:"cover" }}
                            onError={e => { (e.target as HTMLImageElement).style.display="none"; }}
                          />
                        : <span style={{ fontSize: r * 0.65, lineHeight:1 }}>🌍</span>
                    }
                  </div>
                );
              })}
            </div>

            {/* Single continuous animation across all arcs */}
            <ContinuousFlyer stops={stops} cx={cx} cy={cy} W={W}/>
          </div>
        ) : (
          /* Empty state */
          <div style={{ position:"relative", width:"100%", height:H }}>
            <svg width="100%" height={H} viewBox={`0 0 ${W+40} ${H}`}
              style={{ display:"block", overflow:"visible" }}>
              <path d={`M 60 80 Q ${(W+40)*0.35} 20 ${(W+40)*0.5} 80`}
                stroke="#1a2d4a" strokeWidth="1.5" strokeDasharray="6 4" fill="none"/>
              <path d={`M ${(W+40)*0.5} 80 Q ${(W+40)*0.72} 20 ${W-20} 80`}
                stroke="#1a2d4a" strokeWidth="1.5" strokeDasharray="6 4" fill="none"/>
              <circle cx="60" cy="80" r="26" fill="rgba(251,191,36,0.1)" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="3 2"/>
              <circle cx="74" cy="60" r="9" fill="#0d1f3c" stroke="#fbbf24" strokeWidth="1"/>
              <text x="74" y="64" fontSize="11" textAnchor="middle" fill="#fbbf24">✎</text>
              <text x="60" y="113" fontSize="9" textAnchor="middle" fill="rgba(255,255,255,0.4)">{homeLabel.slice(0,9)}</text>
              <circle cx={(W+40)*0.5} cy="80" r="24" fill="rgba(255,255,255,0.02)" stroke="#1a2d4a" strokeWidth="1.5" strokeDasharray="3 2"/>
              <text x={(W+40)*0.5} y="85" fontSize="20" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.1)">+</text>
              <text x={(W+40)*0.5} y="112" fontSize="9" textAnchor="middle" fill="rgba(255,255,255,0.12)">tappa</text>
              <circle cx={W-20} cy="80" r="28" fill="rgba(255,255,255,0.02)" stroke="#1a2d4a" strokeWidth="1.5" strokeDasharray="3 2"/>
              <text x={W-20} y="85" fontSize="22" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.1)">+</text>
              <text x={W-20} y="116" fontSize="9" textAnchor="middle" fill="rgba(255,255,255,0.12)">destinazione</text>
            </svg>
            <div style={{ position:"absolute", top:54, left:36, width:48, height:48,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:22, cursor:"pointer" }} onClick={onEditHome}>🏠</div>
          </div>
        )}

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
      </div>

      {/* Aggiungi tappa */}
      <div style={{ padding:"8px 20px 20px" }}>
        {wpOpen ? (
          <div style={{ background:"#0a1e38", border:"0.5px solid #1a2d4a", borderRadius:10, overflow:"hidden" }}>
            <div style={{ padding:"10px 14px 8px", borderBottom:"0.5px solid #1a2d4a",
              display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
              <span style={{ fontSize:9, color:"rgba(255,255,255,0.35)", letterSpacing:"1px",
                textTransform:"uppercase", marginRight:4 }}>Mezzo</span>
              {TRANSPORT.map(t => (
                <button key={t.value} type="button" onClick={() => setWpTransport(t.value)}
                  style={{ fontSize:10, padding:"7px 10px", minHeight:30, borderRadius:99, cursor:"pointer",
                    background: wpTransport === t.value ? t.bg : "transparent",
                    color: wpTransport === t.value ? t.color : "rgba(255,255,255,0.25)",
                    border: `0.5px solid ${wpTransport === t.value ? t.color : "#1a2d4a"}` }}>
                  <span style={{display:"flex",alignItems:"center",gap:4}}>
                    {TRANSPORT_SVG[t.value]?.(wpTransport === t.value ? t.color : "rgba(255,255,255,0.3)", 14)}
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ padding:"10px 14px", display:"flex", alignItems:"center", gap:8 }}>
              {wpLoading
                ? <Loader2 className="w-4 h-4 animate-spin" style={{ color:"rgba(255,255,255,0.3)", flexShrink:0 }}/>
                : <Search className="w-4 h-4" style={{ color:"rgba(255,255,255,0.3)", flexShrink:0 }}/>
              }
              <input autoFocus style={{ background:"transparent", border:"none", outline:"none",
                color:"#f0f4ff", fontSize:13, flex:1 }}
                value={wpQuery} onChange={e => setWpQuery(e.target.value)} placeholder="Cerca città…"/>
              <button type="button" onClick={() => { setWpQuery(""); setWpOpen(false); }}
                aria-label="Chiudi ricerca tappa"
                style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.3)", display:"flex", alignItems:"center", flexShrink:0 }}>
                <X className="w-4 h-4"/>
              </button>
            </div>
            {wpResults.map((r,i) => (
              <button key={i} type="button" onClick={() => onAddWaypoint(r)}
                style={{ width:"100%", textAlign:"left", padding:"10px 14px", fontSize:13,
                  color:"#f0f4ff", background:"none", border:"none", cursor:"pointer",
                  display:"flex", alignItems:"center", gap:10, borderTop:"0.5px solid #1a2d4a" }}>
                <img src={`https://flagcdn.com/w20/${(r.country_code || "").toLowerCase()}.png`}
                  width="20" style={{ borderRadius:2, flexShrink:0 }}
                  onError={e => { (e.target as HTMLImageElement).style.display="none"; }}/>
                <span>{r.name}, {r.country}</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
            <button type="button" onClick={() => setWpOpen(true)}
              style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12,
                color: destinationError ? "#f87171" : "rgba(255,255,255,0.4)",
                border: `1.5px dashed ${destinationError ? "#f87171" : "#1a2d4a"}`,
                borderRadius:99, padding:"6px 20px", cursor:"pointer", background:"transparent" }}>
              + Aggiungi tappa
            </button>
            {destinationError && (
              <span style={{ fontSize:11, color:"#f87171" }}>Seleziona una destinazione</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** La card "Itinerario" completa (intestazione + editor visuale): la colonna sinistra dei due form. */
export function ItineraryPanel(props: RouteHeroProps) {
  return (
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
        <RouteHero {...props}/>
      </div>
    </div>
  );
}

/** Nome, Periodo (con durata ed errore date invertite), Note e Valutazione: la parte alta della colonna destra. */
export function TripFormFields({
  title, setTitle, dateStart, setDateStart, dateEnd, setDateEnd,
  notes, setNotes, rating, setRating,
}: {
  title: string; setTitle: (v: string) => void;
  dateStart: string; setDateStart: (v: string) => void;
  dateEnd: string; setDateEnd: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
  rating: number; setRating: (v: number) => void;
}) {
  const [hoverRating, setHoverRating] = useState(0);
  const days = daysBetween(dateStart, dateEnd);
  const dateOrderError = isReturnBeforeDeparture(dateStart, dateEnd);

  return (
    <>
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

      {/* Periodo */}
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
        {/* Prima si salvava senza errori anche con il ritorno prima della
            partenza: la durata spariva silenziosamente (daysBetween
            tornava null), senza dire perché. */}
        {dateOrderError && (
          <p style={{ fontSize:11, color:"#f87171", marginTop:8, display:"flex", alignItems:"center", gap:4 }}>
            <AlertCircle className="w-3 h-3"/> Il ritorno non può essere prima della partenza
          </p>
        )}
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
    </>
  );
}

/** Una sezione foto per tappa (casa, ogni tappa intermedia, destinazione). tripId è
 * l'id del viaggio in Modifica, l'id di bozza (draftId) in Nuovo. */
export function TripPhotosPerStop({ tripId, home, waypoints }: {
  tripId: string;
  home: { label: string } | null;
  waypoints: Waypoint[];
}) {
  return (
    <>
      {home && <TripPhotos photoKey={homePhotoKey(tripId)} label={home.label || "Casa"}/>}
      {waypoints.slice(0, -1).map(w => (
        <TripPhotos key={w.id} photoKey={waypointPhotoKey(tripId, w.id)} label={w.city}/>
      ))}
      {waypoints.length > 0 && (
        <TripPhotos photoKey={destinationPhotoKey(tripId)} label={waypoints[waypoints.length - 1].city}/>
      )}
    </>
  );
}

/** Annulla + Salva viaggio, con lo stato di salvataggio esplicito. */
export function TripFormActions({ saving, confirmDiscard, onSave }: {
  saving: boolean;
  confirmDiscard: (e: React.MouseEvent) => void;
  onSave: () => void;
}) {
  return (
    <>
      <div style={{ display:"flex", gap:8, paddingTop:4 }}>
        <Link to="/" onClick={saving ? (e) => e.preventDefault() : confirmDiscard}
          aria-disabled={saving}
          style={{ flex:1, textAlign:"center", padding:"10px", borderRadius:10,
          fontSize:13, color:"rgba(255,255,255,0.4)", border:"0.5px solid #1a2d4a",
          textDecoration:"none", background:"transparent",
          opacity: saving ? 0.4 : 1, pointerEvents: saving ? "none" : "auto" }}>
          Annulla
        </Link>
        <button onClick={onSave} disabled={saving}
          style={{ flex:2, padding:"10px", borderRadius:10, fontSize:13, fontWeight:700,
            color:"#060e1e", background:"#60a5fa", border:"none", cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
          {saving && <Loader2 className="w-4 h-4 animate-spin"/>}
          {saving ? "Salvataggio…" : "Salva viaggio"}
        </button>
      </div>
      {/* Un viaggio con più tappe può richiedere qualche secondo: senza
          questa riga il form sembra bloccato invece che al lavoro. */}
      {saving && (
        <p style={{ fontSize:11, color:"rgba(255,255,255,0.35)", textAlign:"center", margin:0 }}>
          Recupero regione, meteo e altitudine delle tappe…
        </p>
      )}
    </>
  );
}

/**
 * Traccia se qualcosa è stato modificato dopo il primo render e protegge
 * l'uscita: beforeunload sul browser, window.confirm su "Annulla". Il ref
 * salta il giro iniziale (i valori di default/caricati non contano come
 * "modifica").
 */
export function useUnsavedChangesGuard(deps: readonly unknown[]) {
  const [dirty, setDirty] = useState(false);
  const skipDirtyRef = useRef(true);
  useEffect(() => {
    if (skipDirtyRef.current) { skipDirtyRef.current = false; return; }
    setDirty(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const confirmDiscard = (e: React.MouseEvent) => {
    if (dirty && !window.confirm("Hai modifiche non salvate. Uscire senza salvare?")) {
      e.preventDefault();
    }
  };

  return { dirty, confirmDiscard };
}
