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
      dest.lat ? fetchTemperature(dest.lat, dest.lon, dateStart) : Promise.resolve(trip?.temperature_c ?? null),
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
