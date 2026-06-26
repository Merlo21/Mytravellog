import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trip, updateTrip } from "@/lib/storage";
import { toast } from "sonner";
import { X, Plane, Train, Car, Ship, Footprints, Loader2 } from "lucide-react";

interface Props {
  trip: Trip;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

type TransportMode = "plane" | "train" | "car" | "ship" | "walk";

const TRANSPORT: { value: TransportMode; label: string; color: string; bg: string; icon: React.ReactNode }[] = [
  { value: "plane", label: "Aereo",   color: "#378ADD", bg: "rgba(55,138,221,0.15)",  icon: <Plane className="w-3.5 h-3.5"/> },
  { value: "train", label: "Treno",   color: "#BA7517", bg: "rgba(186,117,23,0.15)",  icon: <Train className="w-3.5 h-3.5"/> },
  { value: "car",   label: "Auto",    color: "#639922", bg: "rgba(99,153,34,0.15)",   icon: <Car className="w-3.5 h-3.5"/> },
  { value: "ship",  label: "Nave",    color: "#0F6E56", bg: "rgba(15,110,86,0.15)",   icon: <Ship className="w-3.5 h-3.5"/> },
  { value: "walk",  label: "A piedi", color: "#D85A30", bg: "rgba(216,90,48,0.15)",   icon: <Footprints className="w-3.5 h-3.5"/> },
];

const RATING_LABELS: Record<number, string> = { 1: "Non memorabile", 2: "Nella media", 3: "Bello", 4: "Fantastico", 5: "Indimenticabile" };

function daysBetween(a: string, b: string) {
  if (!a || !b) return null;
  const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
  return d > 0 ? d : null;
}

export function EditTripDialog({ trip, open, onOpenChange, onSaved }: Props) {
  const [title, setTitle] = useState(trip.title);
  const [dateStart, setDateStart] = useState(trip.trip_date);
  const [dateEnd, setDateEnd] = useState(trip.date_end ?? "");
  const [notes, setNotes] = useState(trip.notes ?? "");
  const [rating, setRating] = useState(trip.rating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [transport, setTransport] = useState<TransportMode | null>(trip.transport_mode ?? null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(trip.title);
    setDateStart(trip.trip_date);
    setDateEnd(trip.date_end ?? "");
    setNotes(trip.notes ?? "");
    setRating(trip.rating ?? 0);
    setTransport(trip.transport_mode ?? null);
  }, [trip]);

  const handleSave = async () => {
    setSaving(true);
    updateTrip(trip.id, {
      title: title.trim() || trip.city,
      trip_date: dateStart,
      date_end: dateEnd || null,
      notes: notes.trim() || null,
      transport_mode: transport,
      rating: rating || null,
    });
    toast.success("Viaggio aggiornato!");
    setSaving(false);
    onSaved?.();
  };

  const days = daysBetween(dateStart, dateEnd);

  if (!open) return null;

  return createPortal(<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.75)",backdropFilter:"blur(6px)"}}
      onClick={e => { if (e.target === e.currentTarget) onOpenChange(false); }}>
      <div className="glass-card w-full max-w-lg mx-4 overflow-hidden"
        style={{ maxHeight: "92vh", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <div className="text-2xl">{trip.country_code ? String.fromCodePoint(...[...trip.country_code.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : "🌍"}</div>
          <h2 className="text-base font-bold flex-1">{trip.city}, {trip.country}</h2>
          <button onClick={() => onOpenChange(false)}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary/60">
            <X className="w-4 h-4 text-muted-foreground"/>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Nome */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">Nome del viaggio</label>
            <input className="input-field w-full" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Es. Viaggio di nozze…"/>
          </div>

          {/* Periodo */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">Periodo</label>
            <div className="flex items-stretch rounded-xl overflow-hidden border border-border">
              <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-secondary/20">
                <Plane className="w-3.5 h-3.5 text-primary flex-shrink-0" style={{transform:"rotate(-45deg)"}}/>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Partenza</div>
                  <input type="date" className="bg-transparent text-sm font-medium outline-none w-full"
                    value={dateStart} onChange={e => setDateStart(e.target.value)}/>
                </div>
              </div>
              <div className="w-px bg-border"/>
              <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-secondary/20">
                <Plane className="w-3.5 h-3.5 text-primary flex-shrink-0" style={{transform:"rotate(45deg) scaleX(-1)"}}/>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Ritorno</div>
                  <input type="date" className="bg-transparent text-sm font-medium outline-none w-full"
                    value={dateEnd} onChange={e => setDateEnd(e.target.value)}/>
                </div>
              </div>
              {days && (
                <>
                  <div className="w-px bg-border"/>
                  <div className="px-3 py-2.5 flex items-center bg-secondary/20">
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Durata</div>
                      <div className="text-sm text-muted-foreground">{days}g</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mezzo */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">Mezzo principale</label>
            <div className="flex flex-wrap gap-2">
              {TRANSPORT.map(t => (
                <button key={t.value} type="button"
                  onClick={() => setTransport(prev => prev === t.value ? null : t.value)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{
                    background: transport === t.value ? t.bg : "transparent",
                    color: transport === t.value ? t.color : "rgba(255,255,255,0.4)",
                    border: `0.5px solid ${transport === t.value ? t.color : "#1a2d4a"}`,
                  }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note + Stelle */}
          <div className="flex gap-3 items-start">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Note <span className="opacity-40 normal-case text-[9px]">(opzionale)</span>
              </label>
              <textarea className="input-field w-full resize-none text-sm" rows={3}
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Aggiungi una nota…"/>
            </div>
            <div className="flex-shrink-0">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Valutazione <span className="opacity-40 normal-case text-[9px]">(opzionale)</span>
              </label>
              <div className="input-field flex items-center gap-1 px-3">
                {[1,2,3,4,5].map(i => (
                  <button key={i} type="button"
                    onMouseEnter={() => setHoverRating(i)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(rating === i ? 0 : i)}
                    style={{
                      fontSize: "20px",
                      color: i <= (hoverRating || rating) ? "#fbbf24" : "rgba(255,255,255,0.15)",
                      transition: "color 0.1s, transform 0.1s",
                      transform: i <= (hoverRating || rating) ? "scale(1.1)" : "scale(1)",
                      background: "none", border: "none", cursor: "pointer",
                    }}>★</button>
                ))}
              </div>
              {(hoverRating || rating) > 0 && (
                <div className="text-[10px] text-center mt-1" style={{ color: "#fbbf24" }}>
                  {RATING_LABELS[hoverRating || rating]}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-secondary/10">
          <button onClick={() => onOpenChange(false)}
            className="btn-ghost px-4 py-2 text-sm rounded-xl">Annulla</button>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary flex items-center gap-2 px-5 py-2 text-sm rounded-xl">
            {saving && <Loader2 className="w-4 h-4 animate-spin"/>}
            Salva modifiche
          </button>
        </div>

      </div>
    </div>
  , document.body);
}
