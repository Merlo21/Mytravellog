import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trip, updateTrip, parseLocalDate } from "@/lib/storage";
import { X } from "lucide-react";

export interface DiaryEntry { date: string; text: string }

interface Props {
  trip: Trip;
  /** Diario CORRENTE (dal chiamante, sempre fresco) — non `trip.diary`, che in
   *  memoria resta stantio dopo un salvataggio finché la pagina non ricarica. */
  entries: DiaryEntry[];
  onClose: () => void;
  /** Chiamato al salvataggio col diario aggiornato, così il biglietto rinfresca il conteggio. */
  onSaved?: (diary: DiaryEntry[]) => void;
}

const MAX_DAYS = 120; // salvagente per "viaggi" lunghissimi (anno all'estero ecc.)

/** Giorni [YYYY-MM-DD] dal range del viaggio (partenza→ritorno, inclusivi). */
function tripDays(trip: Trip): string[] {
  const start = parseLocalDate(trip.trip_date);
  const end = trip.date_end ? parseLocalDate(trip.date_end) : start;
  const days: string[] = [];
  const d = new Date(start);
  while (d <= end && days.length < MAX_DAYS) {
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    d.setDate(d.getDate() + 1);
  }
  return days.length ? days : [trip.trip_date];
}

function dayLabel(iso: string): { day: string; wd: string; mon: string } {
  const d = parseLocalDate(iso);
  return {
    day: String(d.getDate()),
    wd: d.toLocaleDateString("it-IT", { weekday: "short" }).replace(".", ""),
    mon: d.toLocaleDateString("it-IT", { month: "short" }).replace(".", ""),
  };
}

/**
 * Diario giorno-per-giorno di un viaggio, in un pannello a schermo intero
 * (portal su body). Un riquadro per ogni giorno del range; si salva alla
 * chiusura (updateTrip) tenendo solo i giorni con testo + eventuali voci di
 * date fuori-range già scritte (non si perde nulla se le date del viaggio
 * cambiano). Scroll della pagina bloccato con il pattern iOS-proof.
 */
export function TripDiary({ trip, entries, onClose, onSaved }: Props) {
  const days = useMemo(() => tripDays(trip), [trip]);

  // Giorni totali del range: se superano MAX_DAYS il troncamento va DETTO
  // (prima era silenzioso: un viaggio da 200 giorni ne mostrava 120 e basta).
  const totalDays = useMemo(() => {
    const start = parseLocalDate(trip.trip_date);
    const end = trip.date_end ? parseLocalDate(trip.date_end) : start;
    return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  }, [trip]);
  const truncated = totalDays > MAX_DAYS;

  // "dirty": l'utente ha scritto qualcosa. Senza, ogni apri-e-chiudi riscriveva
  // il diario identico su localStorage (innocuo ma inutile, e incoerente con
  // TripPlanner che il flag ce l'ha già).
  const dirtyRef = useRef(false);

  // Mappa date→testo iniziale dal diario corrente (prop, sempre fresco).
  const [texts, setTexts] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const e of entries) m[e.date] = e.text;
    return m;
  });

  // Voci "orfane": date con testo che NON sono nel range attuale (es. il viaggio
  // è stato accorciato dopo). Le mostriamo in fondo così non spariscono.
  const orphanDates = useMemo(
    () => entries.map(e => e.date).filter(d => !days.includes(d)).sort(),
    [entries, days],
  );

  // Blocco scroll pagina sotto (iOS-proof): body fixed + posizione ripristinata.
  useEffect(() => {
    const html = document.documentElement, body = document.body;
    const scrollY = window.scrollY;
    const prev = { htmlO: html.style.overflow, pos: body.style.position, top: body.style.top, w: body.style.width };
    html.style.overflow = "hidden";
    body.style.position = "fixed"; body.style.top = `-${scrollY}px`; body.style.left = "0"; body.style.right = "0"; body.style.width = "100%";
    return () => {
      html.style.overflow = prev.htmlO;
      body.style.position = prev.pos; body.style.top = prev.top; body.style.left = ""; body.style.right = ""; body.style.width = prev.w;
      window.scrollTo(0, scrollY);
    };
  }, []);

  const save = () => {
    if (!dirtyRef.current) return; // niente modifiche: non riscrivere il diario identico
    const diary: DiaryEntry[] = Object.entries(texts)
      .map(([date, text]) => ({ date, text: text.trim() }))
      .filter(e => e.text.length > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    updateTrip(trip.id, { diary: diary.length ? diary : undefined });
    dirtyRef.current = false;
    onSaved?.(diary);
  };

  const close = () => { save(); onClose(); };

  // Ref sempre aggiornate per i listener/cleanup qui sotto (evitano closure stantie).
  const saveRef = useRef(save); saveRef.current = save;
  const closeRef = useRef(close); closeRef.current = close;

  // Esc chiude (salvando) + salvataggio allo SMONTAGGIO: su mobile il gesto
  // istintivo per uscire da un pannello a schermo intero è il back di
  // Android/lo swipe indietro, che cambia rotta e smonta il componente senza
  // passare dalla X — senza questo cleanup tutto il testo scritto andava perso.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); saveRef.current(); };
  }, []);

  // Auto-grow: la textarea cresce col testo (la maniglia di resize manuale è
  // inutilizzabile su touch). useCallback stabile: gira solo al mount di ogni
  // textarea (per il testo precompilato), NON a ogni render della lista.
  const growRef = useCallback((el: HTMLTextAreaElement | null) => {
    if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
  }, []);
  const autoGrow = (el: HTMLTextAreaElement) => { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; };

  const renderDay = (iso: string) => {
    const { day, wd, mon } = dayLabel(iso);
    return (
      <div key={iso} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ flexShrink: 0, width: 54, textAlign: "center", background: "rgba(96,165,250,0.12)", border: "0.5px solid rgba(96,165,250,0.3)", borderRadius: 8, padding: "7px 0" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#60a5fa", lineHeight: 1 }}>{day}</div>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: ".5px", marginTop: 3 }}>{wd} {mon}</div>
        </div>
        <textarea
          ref={growRef}
          value={texts[iso] ?? ""}
          onChange={e => { dirtyRef.current = true; autoGrow(e.target); setTexts(t => ({ ...t, [iso]: e.target.value })); }}
          placeholder="Cosa hai fatto questo giorno?"
          rows={2}
          style={{
            flex: 1, background: "rgba(255,255,255,0.04)", border: "0.5px solid #1a2d4a", borderRadius: 8,
            padding: "8px 10px", fontSize: 13, color: "#f0f4ff", lineHeight: 1.45, outline: "none",
            resize: "none", overflow: "hidden", fontFamily: "inherit", minHeight: 42,
          }}
        />
      </div>
    );
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Diario — ${trip.title || trip.city}`}
      style={{
        position: "fixed", inset: 0, zIndex: 200, background: "#060e1e",
        display: "flex", flexDirection: "column",
      }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
        borderBottom: "0.5px solid rgba(255,255,255,0.1)", background: "rgba(6,14,30,0.95)",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#f0f4ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            📖 Diario — {trip.title || trip.city}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
            Scrivi il racconto giorno per giorno · si salva da solo
          </div>
        </div>
        <button type="button" onClick={close} aria-label="Chiudi il diario"
          style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.8)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X style={{ width: 18, height: 18 }} />
        </button>
      </div>

      {/* Giorni */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", padding: 16 }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          {days.map(renderDay)}
          {truncated && (
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", margin: "2px 0 14px" }}>
              Mostro i primi {MAX_DAYS} giorni — il viaggio ne ha {totalDays}.
            </div>
          )}
          {orphanDates.length > 0 && (
            <>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: "1.5px", textTransform: "uppercase", margin: "18px 0 10px" }}>
                Altri giorni (fuori dalle date attuali del viaggio)
              </div>
              {orphanDates.map(renderDay)}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
