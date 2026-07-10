// [FROZEN] — Non modificare senza esplicita richiesta
import { useState, useEffect, useRef } from "react";
import { AppHeader } from "@/components/AppHeader";
import { TripCardTicket } from "@/components/TripCardTicket";
import { loadTrips, Trip } from "@/lib/storage";
import { Search, X } from "lucide-react";

const DELETE_ANIM_MS = 200;

export default function MieiViaggi() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [search, setSearch] = useState("");
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { setTrips(loadTrips()); }, []);
  useEffect(() => () => clearTimeout(deleteTimeoutRef.current), []);
  const refresh = () => setTrips(loadTrips());

  // Mostra prima la card che sta uscendo (opacity+scale via CSS), poi la
  // rimuove davvero dalla lista — senza questo la card scomparirebbe di
  // scatto non appena TripCardTicket chiama onDeleted.
  const handleDeleted = (id: string) => {
    setLeavingId(id);
    deleteTimeoutRef.current = setTimeout(() => {
      refresh();
      setLeavingId(null);
    }, DELETE_ANIM_MS);
  };

  const filtered = trips.filter(t =>
    !search || [t.title, t.city, t.country].some(s =>
      s?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const byYear = filtered.reduce((acc, t) => {
    const year = t.trip_date ? new Date(t.trip_date).getFullYear().toString() : "—";
    if (!acc[year]) acc[year] = [];
    acc[year].push(t);
    return acc;
  }, {} as Record<string, Trip[]>);

  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));

  return (
    <main className="min-h-screen flex flex-col" style={{backgroundColor:"#060e1e"}}>
      <AppHeader />
      <div className="container mx-auto px-6 py-8 flex-1">

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold">I miei viaggi</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {trips.length} {trips.length === 1 ? "viaggio" : "viaggi"}
          </p>
        </div>

        {/* Search — sticky sotto l'AppHeader (sticky top:0, alto 65px) mentre si
            scorre l'elenco, con sfondo pieno per non far intravedere il
            contenuto che scorre sotto. top:65 è accoppiato all'altezza reale
            di AppHeader.tsx (FROZEN): se quella cambia, va rimisurato. */}
        <div className="mb-6" style={{position:"sticky",top:65,zIndex:10,background:"#060e1e",paddingTop:8,paddingBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.05)",borderRadius:10,padding:"8px 14px",maxWidth:400}}>
            <Search className="w-4 h-4" style={{color:"rgba(255,255,255,0.3)",flexShrink:0}}/>
            <input
              style={{background:"transparent",border:"none",outline:"none",color:"#f0f4ff",fontSize:13,flex:1}}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca città, paese, titolo…"
            />
            {search && (
              <button onClick={() => setSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.3)"}}>
                <X className="w-3.5 h-3.5"/>
              </button>
            )}
          </div>
        </div>

        {/* Trips */}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">
            {search ? "Nessun risultato." : "Nessun viaggio ancora. Aggiungine uno!"}
          </p>
        ) : (
          <div className="space-y-8">
            {years.map(year => (
              <div key={year}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <span style={{fontSize:11,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(255,255,255,0.3)"}}>{year}</span>
                  <div style={{flex:1,height:"0.5px",background:"#1a2d4a"}}/>
                  <span style={{fontSize:11,color:"rgba(255,255,255,0.25)"}}>{byYear[year].length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {byYear[year].map(t => (
                    <div key={t.id} style={{
                      transition: `opacity ${DELETE_ANIM_MS}ms ease, transform ${DELETE_ANIM_MS}ms ease`,
                      opacity: leavingId === t.id ? 0 : 1,
                      transform: leavingId === t.id ? "scale(0.95)" : "scale(1)",
                    }}>
                      <TripCardTicket trip={t} onDeleted={() => handleDeleted(t.id)}/>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
