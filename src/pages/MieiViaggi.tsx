// [FROZEN] — Non modificare senza esplicita richiesta
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { TripCardTicket } from "@/components/TripCardTicket";
import { TripFlyover } from "@/components/TripFlyover";
import { loadTrips, deleteTrip, Trip } from "@/lib/storage";
import { deletePhotosForTrip } from "@/lib/photoStorage";
import { Search, X, Video } from "lucide-react";

const DELETE_ANIM_MS = 200;
// Finestra di tempo in cui "Annulla" nel toast può ancora recuperare il
// viaggio: l'eliminazione vera e propria (storage + foto) resta sospesa
// fino ad allora, così una cancellazione per errore non è mai definitiva.
const UNDO_GRACE_MS = 5000;

export default function MieiViaggi() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [flyoverYear, setFlyoverYear] = useState<string | null>(null);
  const pendingDeletesRef = useRef<Map<string, {
    animTimer: ReturnType<typeof setTimeout>;
    commitTimer: ReturnType<typeof setTimeout>;
    toastId: string | number;
    trip: Trip;
  }>>(new Map());

  useEffect(() => { setTrips(loadTrips()); }, []);
  useEffect(() => () => {
    // Alla chiusura della pagina, le cancellazioni ancora "in sospeso" (in
    // attesa che scada la finestra per l'Annulla) vengono eseguite subito
    // invece di restare bloccate a metà — e il loro toast viene chiuso,
    // perché il Toaster è globale e un "Annulla" rimasto visibile sarebbe
    // ormai un no-op ingannevole.
    pendingDeletesRef.current.forEach(({ animTimer, commitTimer, toastId, trip }) => {
      clearTimeout(animTimer);
      clearTimeout(commitTimer);
      toast.dismiss(toastId);
      deleteTrip(trip.id);
      deletePhotosForTrip(trip);
    });
    pendingDeletesRef.current.clear();
  }, []);

  const commitDelete = (trip: Trip) => {
    deleteTrip(trip.id);
    deletePhotosForTrip(trip);
    pendingDeletesRef.current.delete(trip.id);
  };

  const undoDelete = (trip: Trip) => {
    const pending = pendingDeletesRef.current.get(trip.id);
    if (!pending) return; // la finestra per l'Annulla è già scaduta: niente da recuperare
    // Anche il timer dell'animazione: un Annulla immediato (entro i 200ms)
    // non deve comunque far sparire la card dalla lista.
    clearTimeout(pending.animTimer);
    clearTimeout(pending.commitTimer);
    pendingDeletesRef.current.delete(trip.id);
    setLeavingId(prev => (prev === trip.id ? null : prev));
    // Re-inserito nell'ordine giusto (stesso criterio di loadTrips: data decrescente).
    setTrips(prev => prev.some(t => t.id === trip.id)
      ? prev
      : [...prev, trip].sort((a, b) => b.trip_date.localeCompare(a.trip_date)));
  };

  // Mostra prima la card che sta uscendo (opacity+scale via CSS), poi la
  // rimuove dalla lista visibile — senza cancellarla ancora da storage,
  // per lasciare tempo all'eventuale "Annulla" nel toast.
  const handleDeleteRequested = (trip: Trip) => {
    // La card resta cliccabile durante l'animazione di uscita: una seconda
    // conferma non deve creare un secondo timer orfano.
    if (pendingDeletesRef.current.has(trip.id)) return;

    setLeavingId(trip.id);
    const animTimer = setTimeout(() => {
      setTrips(prev => prev.filter(t => t.id !== trip.id));
      setLeavingId(prev => (prev === trip.id ? null : prev));
    }, DELETE_ANIM_MS);

    const commitTimer = setTimeout(() => commitDelete(trip), UNDO_GRACE_MS);

    const toastId = toast(`"${trip.title || trip.city}" eliminato`, {
      duration: UNDO_GRACE_MS,
      action: { label: "Annulla", onClick: () => undoDelete(trip) },
    });
    pendingDeletesRef.current.set(trip.id, { animTimer, commitTimer, toastId, trip });
  };

  const tripYear = (t: Trip) => t.trip_date ? new Date(t.trip_date).getFullYear().toString() : "—";

  // Anni disponibili calcolati su tutti i viaggi (non sui filtrati): i chip
  // restano stabili mentre si scrive nella ricerca, invece di sparire.
  const allYears = Array.from(new Set(trips.map(tripYear))).sort((a, b) => b.localeCompare(a));

  // Anche le tappe intermedie e le note: prima "Firenze" non trovava un
  // viaggio in cui Firenze era solo una tappa (e non la destinazione), pur
  // essendo l'app pensata per i multi-tappa.
  const matchesSearch = (t: Trip, q: string) => {
    const needle = q.toLowerCase();
    const fields = [
      t.title, t.city, t.country, t.notes,
      ...(t.waypoints ?? []).flatMap(w => [w.city, w.country]),
    ];
    return fields.some(s => s?.toLowerCase().includes(needle));
  };

  const filtered = trips.filter(t =>
    (!search || matchesSearch(t, search)) && (!yearFilter || tripYear(t) === yearFilter)
  );

  const byYear = filtered.reduce((acc, t) => {
    const year = tripYear(t);
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

          {allYears.length > 1 && (
            <div style={{display:"flex",gap:6,marginTop:10,overflowX:"auto",paddingBottom:2}}>
              <button
                type="button"
                onClick={() => setYearFilter(null)}
                style={{
                  flexShrink:0, fontSize:12, fontWeight:600, padding:"5px 12px", borderRadius:999,
                  border: yearFilter === null ? "1px solid #60a5fa" : "1px solid #1a2d4a",
                  background: yearFilter === null ? "rgba(96,165,250,0.15)" : "transparent",
                  color: yearFilter === null ? "#60a5fa" : "rgba(255,255,255,0.5)",
                  cursor:"pointer",
                }}
              >
                Tutti
              </button>
              {allYears.map(year => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setYearFilter(yearFilter === year ? null : year)}
                  aria-pressed={yearFilter === year}
                  style={{
                    flexShrink:0, fontSize:12, fontWeight:600, padding:"5px 12px", borderRadius:999,
                    border: yearFilter === year ? "1px solid #60a5fa" : "1px solid #1a2d4a",
                    background: yearFilter === year ? "rgba(96,165,250,0.15)" : "transparent",
                    color: yearFilter === year ? "#60a5fa" : "rgba(255,255,255,0.5)",
                    cursor:"pointer",
                  }}
                >
                  {year}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Trips */}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">
            {search || yearFilter ? "Nessun risultato." : "Nessun viaggio ancora. Aggiungine uno!"}
          </p>
        ) : (
          <div className="space-y-8">
            {years.map(year => (
              <div key={year}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <span style={{fontSize:11,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(255,255,255,0.3)"}}>{year}</span>
                  <div style={{flex:1,height:"0.5px",background:"#1a2d4a"}}/>
                  <span style={{fontSize:11,color:"rgba(255,255,255,0.25)"}}>{byYear[year].length}</span>
                  {byYear[year].length > 1 && (
                    <button type="button" onClick={() => setFlyoverYear(year)} aria-label={`Rivivi il ${year} in 3D`}
                      style={{width:22,height:22,background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.3)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <Video style={{width:13,height:13}}/>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {byYear[year].map(t => (
                    <div key={t.id} style={{
                      transition: `opacity ${DELETE_ANIM_MS}ms ease, transform ${DELETE_ANIM_MS}ms ease`,
                      opacity: leavingId === t.id ? 0 : 1,
                      transform: leavingId === t.id ? "scale(0.95)" : "none",
                    }}>
                      <TripCardTicket trip={t} onDeleteRequested={handleDeleteRequested}/>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {flyoverYear && (
        <TripFlyover trips={byYear[flyoverYear] ?? []} onClose={() => setFlyoverYear(null)} />
      )}
    </main>
  );
}
