// [FROZEN] — Non modificare senza esplicita richiesta
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trip, formatTripDate, parseLocalDate } from "@/lib/storage";
import { fmtDistance, fmtTemp, useSettings } from "@/lib/settings";
import { Plane, Train, Car, Ship, Footprints, Bike, Pencil, Trash2, Video, X } from "lucide-react";
import { Motorcycle } from "@/components/icons/Motorcycle";
import { useNavigate } from "react-router-dom";
import { TripFlyover } from "@/components/TripFlyover";
import { getReliefImage } from "@/lib/photoStorage";

const TRANSPORT_STYLE: Record<string, { color: string; bg: string; label: string; Icon: React.ElementType }> = {
  plane: { color: "#378ADD", bg: "rgba(55,138,221,0.12)", label: "Aereo",   Icon: Plane      },
  train: { color: "#BA7517", bg: "rgba(186,117,23,0.12)", label: "Treno",   Icon: Train      },
  car:   { color: "#A855F7", bg: "rgba(168,85,247,0.12)", label: "Auto",    Icon: Car        },
  ship:  { color: "#0F6E56", bg: "rgba(15,110,86,0.12)",  label: "Nave",    Icon: Ship       },
  walk:  { color: "#D85A30", bg: "rgba(216,90,48,0.12)",  label: "A piedi", Icon: Footprints },
  bici:  { color: "#22C55E", bg: "rgba(34,197,94,0.12)",  label: "Bici",    Icon: Bike       },
  moto:  { color: "#EAB308", bg: "rgba(234,179,8,0.12)",  label: "Moto",    Icon: Motorcycle },
};
const DEFAULT_TRANSPORT = { color: "#60a5fa", bg: "rgba(96,165,250,0.12)", label: "Viaggio", Icon: Plane };

// Colore stagionale della data (emisfero nord): inverno freddo, estate caldo,
// mezze stagioni nei toni intermedi. Indice = mese (0=gennaio … 11=dicembre).
const SEASON_COLOR_BY_MONTH = [
  "#60a5fa", "#60a5fa", "#4ade80", "#4ade80", "#4ade80", "#fb923c",
  "#fb923c", "#fb923c", "#c2410c", "#c2410c", "#c2410c", "#60a5fa",
];
export function seasonColor(tripDateISO: string): string {
  return SEASON_COLOR_BY_MONTH[parseLocalDate(tripDateISO).getMonth()];
}

function abbr(city: string) {
  return city.slice(0, 3).toUpperCase();
}

interface Props {
  trip: Trip;
  /** Chiamato alla conferma (secondo tap): il viaggio NON è ancora stato
   * eliminato — chi lo gestisce (MieiViaggi) decide quando eliminarlo
   * davvero, per poter offrire un "Annulla". */
  onDeleteRequested?: (trip: Trip) => void;
}

// Oltre questa lunghezza le note vengono mostrate troncate (2 righe) con
// espansione al tap: sotto, stanno comunque in 2 righe e il toggle sarebbe inutile.
const NOTES_CLAMP_THRESHOLD = 120;

export function TripCardTicket({ trip, onDeleteRequested }: Props) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showFlyover, setShowFlyover] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  // Miniatura del "rilievo 3D" salvato a fine flyover (snapshot in IndexedDB):
  // appare come linguetta sul bordo destro della card; click → si ingrandisce.
  const [reliefUrl, setReliefUrl] = useState<string | null>(null);
  const [reliefOpen, setReliefOpen] = useState(false);
  const reliefUrlRef = useRef<string | null>(null);

  const refreshRelief = async () => {
    let blob: Blob | null = null;
    try {
      blob = await getReliefImage(trip.id);
    } catch {
      // IndexedDB non disponibile (es. modalità privata o ambiente di test):
      // nessuna miniatura, la card resta comunque pienamente funzionante.
      return;
    }
    if (reliefUrlRef.current) { URL.revokeObjectURL(reliefUrlRef.current); reliefUrlRef.current = null; }
    if (blob) { const u = URL.createObjectURL(blob); reliefUrlRef.current = u; setReliefUrl(u); }
    else setReliefUrl(null);
  };
  useEffect(() => {
    refreshRelief();
    return () => { if (reliefUrlRef.current) URL.revokeObjectURL(reliefUrlRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id]);

  // Esc chiude l'anteprima ingrandita del rilievo.
  useEffect(() => {
    if (!reliefOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setReliefOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reliefOpen]);
  const { distanceUnit, temperatureUnit } = useSettings();
  const ts = TRANSPORT_STYLE[trip.transport_mode ?? ""] ?? DEFAULT_TRANSPORT;

  const notes = trip.notes?.trim() || null;
  // Lunghe per caratteri O per numero di righe: una lista di 8 righe corte
  // (whiteSpace:pre-wrap le rispetta) occuperebbe comunque troppa card.
  const notesAreLong = !!notes && (notes.length > NOTES_CLAMP_THRESHOLD || notes.split("\n").length > 2);

  // Inclusivo (1-5 giugno = 5 giorni), non per differenza di date: stessa
  // convenzione della heatmap in Statistiche, che prima contava 5 per questo
  // stesso viaggio mentre qui si leggeva "4g" — numeri diversi per lo stesso dato.
  const days = trip.date_end
    ? Math.round((parseLocalDate(trip.date_end).getTime() - parseLocalDate(trip.trip_date).getTime()) / 86400000) + 1
    : null;

  const displayTitle = trip.title && trip.title !== trip.city ? trip.title : trip.city;
  const hasWaypoints = trip.waypoints && trip.waypoints.length > 0;

  const stops = hasWaypoints
    ? [trip.home_label?.split(",")[0] ?? "Casa", ...trip.waypoints!.map((w: any) => w.city), trip.city]
    : null;

  // Il primo tap "arma" il cestino (diventa rosso); senza un timeout resta
  // armato per sempre se l'utente cambia idea senza toccare altro sulla card.
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(confirmTimeoutRef.current), []);

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      confirmTimeoutRef.current = setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    clearTimeout(confirmTimeoutRef.current);
    onDeleteRequested?.(trip);
  };

  return (
    <>
    <div style={{position:"relative"}}>
    <div style={{background:"#0a1628",border:"0.5px solid #1a2d4a",borderRadius:16,overflow:"hidden"}}>

      {/* Top */}
      <div style={{padding:"16px 20px 12px"}}>
        {/* Header row */}
        <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
          <div style={{width:28,height:28,borderRadius:"50%",overflow:"hidden",border:"1px solid rgba(255,255,255,0.1)",flexShrink:0}}>
            {trip.country_code
              ? <img src={"https://flagcdn.com/w80/"+trip.country_code.toLowerCase()+".png"} width="28" height="28" alt="" loading="lazy"
                  style={{objectFit:"cover"}}
                  onError={e => { (e.target as HTMLImageElement).style.display="none"; }}/>
              : <div style={{width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🌍</div>
            }
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div className="font-display" style={{fontSize:14,fontWeight:700,color:"#f0f4ff"}}>{displayTitle}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{trip.city}, {trip.country}</div>
          </div>
          {/* Le 5 stelle si distinguono solo per colore: senza aria-label uno
              screen reader leggerebbe cinque stelle identiche. role=img +
              label riassuntiva comunicano il voto (o la sua assenza). */}
          <div style={{display:"flex",gap:1,flexShrink:0}}
            role="img"
            aria-label={trip.rating ? `Valutazione: ${trip.rating} su 5` : "Nessuna valutazione"}>
            {[1,2,3,4,5].map(i => (
              <span key={i} aria-hidden="true" style={{fontSize:10,color:i <= (trip.rating ?? 0) ? "#fbbf24" : "rgba(255,255,255,0.15)"}}>★</span>
            ))}
          </div>
          <div style={{display:"flex",gap:4,flexShrink:0}}>
            <button onClick={() => setShowFlyover(true)} aria-label="Vedi il flyover 3D"
              style={{width:26,height:26,background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.35)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Video style={{width:13,height:13}}/>
            </button>
            <button onClick={() => navigate("/modifica-viaggio/"+trip.id)} aria-label="Modifica viaggio"
              style={{width:26,height:26,background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.35)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Pencil style={{width:13,height:13}}/>
            </button>
            <button onClick={handleDelete}
              aria-label={confirmDelete ? "Confermi l'eliminazione del viaggio?" : "Elimina viaggio"}
              style={{width:26,height:26,background:confirmDelete?"rgba(239,68,68,0.15)":"none",border:"none",cursor:"pointer",color:confirmDelete?"#f87171":"rgba(255,255,255,0.35)",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:6}}>
              <Trash2 style={{width:13,height:13}}/>
            </button>
          </div>
        </div>

        {/* Route line */}
        {hasWaypoints && stops ? (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
              {stops.map((stop, i) => (
                <div key={i} style={{display:"flex",alignItems:"center",gap:4,flex:i < stops.length-1 ? 1 : 0}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <div style={{width:i===0?8:i===stops.length-1?8:6,height:i===0?8:i===stops.length-1?8:6,borderRadius:"50%",background:i===0?"#fbbf24":i===stops.length-1?ts.color:"#60a5fa"}}/>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>{abbr(stop)}</div>
                  </div>
                  {i < stops.length-1 && (
                    <div style={{flex:1,borderTop:"1.5px dashed rgba(96,165,250,0.3)",marginBottom:12}}/>
                  )}
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {stops.map((stop, i) => (
                <span key={i} style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>
                  {stop}{i < stops.length-1 && <span style={{color:"rgba(255,255,255,0.2)",margin:"0 2px"}}>→</span>}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:"#fbbf24"}}/>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>{abbr(trip.home_label?.split(",")[0] || "Casa")}</div>
            </div>
            <div style={{flex:1,display:"flex",alignItems:"center",gap:4}}>
              <div style={{flex:1,borderTop:"1.5px dashed "+ts.color+"60"}}/>
              <ts.Icon style={{width:14,height:14,color:ts.color}}/>
              <div style={{flex:1,borderTop:"1.5px dashed "+ts.color+"60"}}/>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:"#f472b6"}}/>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>{abbr(trip.city)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Ticket divider */}
      <div style={{display:"flex",alignItems:"center",margin:"0 0",position:"relative"}}>
        <div style={{position:"absolute",top:"50%",left:0,right:0,height:"0.5px",background:"#1a2d4a"}}/>
        <div style={{width:16,height:16,borderRadius:"50%",background:"#060e1e",border:"0.5px solid #1a2d4a",flexShrink:0,marginLeft:-8,zIndex:1}}/>
        <div style={{flex:1,borderTop:"1.5px dashed #1a2d4a",margin:"0 4px"}}/>
        <div style={{width:16,height:16,borderRadius:"50%",background:"#060e1e",border:"0.5px solid #1a2d4a",flexShrink:0,marginRight:-8,zIndex:1}}/>
      </div>

      {/* Bottom */}
      <div style={{padding:"10px 20px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"baseline",gap:4}}>
          <span style={{fontSize:13,fontWeight:600,color:seasonColor(trip.trip_date)}}>
            {formatTripDate(trip.trip_date)}
          </span>
          {trip.date_end && trip.date_end !== trip.trip_date && (
            <span style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}> → {formatTripDate(trip.date_end)}</span>
          )}
          {days && days > 0 && (
            <span style={{fontSize:11,color:ts.color,fontWeight:600}}> · {days}g</span>
          )}
        </div>
        {trip.transport_mode && (
          <>
            <div style={{width:1,height:10,background:"#1a2d4a"}}/>
            <span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,padding:"2px 8px",borderRadius:99,background:ts.bg,color:ts.color,fontWeight:500}}>
              <ts.Icon style={{width:10,height:10}}/> {ts.label}
            </span>
          </>
        )}
        {trip.distance_from_home_km != null && (
          <>
            <div style={{width:1,height:10,background:"#1a2d4a"}}/>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{fmtDistance(trip.distance_from_home_km, distanceUnit)}</span>
          </>
        )}
        {trip.temperature_c != null && (
          <>
            <div style={{width:1,height:10,background:"#1a2d4a"}}/>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{fmtTemp(trip.temperature_c, temperatureUnit)}</span>
          </>
        )}
      </div>

      {/* Note del viaggio: prima erano visibili solo riaprendo il form di
          modifica. Troncate a 2 righe se lunghe, tap per espandere. */}
      {notes && (
        <div style={{padding:"0 20px 14px"}}>
          <div
            onClick={notesAreLong ? () => setNotesExpanded(e => !e) : undefined}
            onKeyDown={notesAreLong ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setNotesExpanded(v => !v); } } : undefined}
            tabIndex={notesAreLong ? 0 : undefined}
            role={notesAreLong ? "button" : undefined}
            aria-expanded={notesAreLong ? notesExpanded : undefined}
            aria-label={notesAreLong ? (notesExpanded ? "Comprimi le note" : "Espandi le note") : undefined}
            style={{
              borderLeft:"2px solid #1a2d4a", paddingLeft:10,
              cursor: notesAreLong ? "pointer" : "default",
            }}>
            <div style={{
              fontSize:11, lineHeight:1.5, color:"rgba(255,255,255,0.6)", fontStyle:"italic",
              whiteSpace:"pre-wrap", wordBreak:"break-word",
              ...(notesAreLong && !notesExpanded ? {
                display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" as const, overflow:"hidden",
              } : {}),
            }}>
              {notes}
            </div>
            {notesAreLong && (
              <div style={{fontSize:10,color:"#60a5fa",fontWeight:600,marginTop:3}}>
                {notesExpanded ? "Mostra meno" : "Mostra tutto"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>

      {/* Linguetta del rilievo 3D sul bordo destro: appare solo se lo snapshot
          esiste (flyover già visto almeno una volta). Fuori dall'overflow:hidden
          della card, così può sporgere; click → anteprima ingrandita. */}
      {reliefUrl && (
        <button type="button" onClick={() => setReliefOpen(true)}
          aria-label="Vedi il rilievo 3D del viaggio" title="Rilievo 3D del viaggio"
          style={{
            position:"absolute", right:-10, top:"50%", transform:"translateY(-50%)",
            width:52, height:52, padding:3, borderRadius:10, border:"0.5px solid #1a2d4a",
            background:"#0a1628", boxShadow:"0 4px 14px rgba(0,0,0,0.5)", cursor:"pointer", overflow:"hidden",
          }}>
          <img src={reliefUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:8,display:"block"}}/>
        </button>
      )}
    </div>

    {/* onClose ricarica il rilievo: se il flyover l'ha appena generato, la
        linguetta compare senza ricaricare la pagina. */}
    {showFlyover && <TripFlyover trips={[trip]} onClose={() => { setShowFlyover(false); refreshRelief(); }} />}

    {reliefOpen && reliefUrl && createPortal(
      <div onClick={() => setReliefOpen(false)}
        style={{
          position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.85)", backdropFilter:"blur(4px)",
          display:"flex", alignItems:"center", justifyContent:"center", padding:24,
        }}>
        <img src={reliefUrl} alt={`Rilievo 3D di ${displayTitle}`} onClick={e => e.stopPropagation()}
          style={{maxWidth:"92vw",maxHeight:"88vh",objectFit:"contain",borderRadius:12,boxShadow:"0 20px 60px rgba(0,0,0,0.6)"}}/>
        <button onClick={() => setReliefOpen(false)} aria-label="Chiudi anteprima rilievo"
          style={{
            position:"absolute", top:16, right:16, width:34, height:34, borderRadius:10,
            background:"rgba(10,22,40,0.8)", border:"0.5px solid #1a2d4a", cursor:"pointer",
            color:"rgba(255,255,255,0.7)", display:"flex", alignItems:"center", justifyContent:"center",
          }}>
          <X style={{width:16,height:16}}/>
        </button>
      </div>,
      document.body
    )}
    </>
  );
}
