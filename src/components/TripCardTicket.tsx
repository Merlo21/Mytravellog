// [FROZEN] — Non modificare senza esplicita richiesta
import { useState } from "react";
import { Trip, deleteTrip, formatTripDate, parseLocalDate } from "@/lib/storage";
import { fmtDistance, fmtTemp, useSettings } from "@/lib/settings";
import { Plane, Train, Car, Ship, Footprints, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TRANSPORT_STYLE: Record<string, { color: string; bg: string; label: string; Icon: React.ElementType }> = {
  plane: { color: "#378ADD", bg: "rgba(55,138,221,0.12)", label: "Aereo",   Icon: Plane      },
  train: { color: "#BA7517", bg: "rgba(186,117,23,0.12)", label: "Treno",   Icon: Train      },
  car:   { color: "#A855F7", bg: "rgba(168,85,247,0.12)", label: "Auto",    Icon: Car        },
  ship:  { color: "#0F6E56", bg: "rgba(15,110,86,0.12)",  label: "Nave",    Icon: Ship       },
  walk:  { color: "#D85A30", bg: "rgba(216,90,48,0.12)",  label: "A piedi", Icon: Footprints },
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
  onDeleted?: () => void;
}

export function TripCardTicket({ trip, onDeleted }: Props) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { distanceUnit, temperatureUnit } = useSettings();
  const ts = TRANSPORT_STYLE[trip.transport_mode ?? ""] ?? DEFAULT_TRANSPORT;

  const days = trip.date_end && trip.date_end !== trip.trip_date
    ? Math.round((new Date(trip.date_end).getTime() - new Date(trip.trip_date).getTime()) / 86400000)
    : null;

  const displayTitle = trip.title && trip.title !== trip.city ? trip.title : trip.city;
  const hasWaypoints = trip.waypoints && trip.waypoints.length > 0;

  const stops = hasWaypoints
    ? [trip.home_label?.split(",")[0] ?? "Casa", ...trip.waypoints!.map((w: any) => w.city), trip.city]
    : null;

  const handleDelete = () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    deleteTrip(trip.id);
    onDeleted?.();
  };

  return (
    <div style={{background:"#0a1628",border:"0.5px solid #1a2d4a",borderRadius:16,overflow:"hidden"}}>

      {/* Top */}
      <div style={{padding:"16px 20px 12px"}}>
        {/* Header row */}
        <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
          <div style={{width:28,height:28,borderRadius:"50%",overflow:"hidden",border:"1px solid rgba(255,255,255,0.1)",flexShrink:0}}>
            {trip.country_code
              ? <img src={"https://flagcdn.com/w80/"+trip.country_code.toLowerCase()+".png"} width="28" height="28" style={{objectFit:"cover"}}/>
              : <div style={{width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🌍</div>
            }
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:700,color:"#f0f4ff"}}>{displayTitle}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{trip.city}, {trip.country}</div>
          </div>
          <div style={{display:"flex",gap:1,flexShrink:0}}>
            {[1,2,3,4,5].map(i => (
              <span key={i} style={{fontSize:10,color:i <= (trip.rating ?? 0) ? "#fbbf24" : "rgba(255,255,255,0.15)"}}>★</span>
            ))}
          </div>
          <div style={{display:"flex",gap:4,flexShrink:0}}>
            <button onClick={() => navigate("/modifica-viaggio/"+trip.id)}
              style={{width:26,height:26,background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.35)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Pencil style={{width:13,height:13}}/>
            </button>
            <button onClick={handleDelete}
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
              <div style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>{trip.home_label ? abbr(trip.home_label.split(",")[0]) : "MXP"}</div>
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
    </div>
  );
}
