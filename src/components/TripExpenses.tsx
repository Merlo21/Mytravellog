import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trip, updateTrip, parseLocalDate, isValidDateISO } from "@/lib/storage";
import { CUR } from "@/lib/plans";
import { X, Plus, Trash2 } from "lucide-react";
import { useModalFocus } from "@/lib/useModalFocus";

/**
 * "Quanto è costato": consuntivo delle spese di un viaggio già fatto.
 *
 * Usa lo STESSO campo `budget` dei viaggi in programma, ma ne legge la colonna
 * dei soldi realmente usciti (`paid`) invece del preventivo (`amount`): così un
 * viaggio nato come programma arriva qui già compilato con quanto avevi pagato,
 * e il preventivo resta accanto come promemoria di quanto avevi previsto.
 */

export type ExpenseRow = NonNullable<Trip["budget"]>[number];

const DEFAULT_ROWS: ExpenseRow[] = [
  { label: "Viaggio", amount: 0, paid: 0 },
  { label: "Alloggio", amount: 0, paid: 0 },
  { label: "Cibo", amount: 0, paid: 0 },
];

/** Totale speso: la somma di ciò che è uscito davvero. */
export function totalSpent(trip: Pick<Trip, "budget">): number {
  return (trip.budget ?? []).reduce((s, r) => s + (r.paid || 0), 0);
}

interface Props {
  trip: Trip;
  onClose: () => void;
  onSaved?: (rows: ExpenseRow[]) => void;
}

export function TripExpenses({ trip, onClose, onSaved }: Props) {
  const modalRef = useModalFocus<HTMLDivElement>();
  const [rows, setRows] = useState<ExpenseRow[]>(() =>
    trip.budget && trip.budget.length ? trip.budget.map(r => ({ ...r })) : DEFAULT_ROWS.map(r => ({ ...r })),
  );
  const dirtyRef = useRef(false);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const total = useMemo(() => rows.reduce((s, r) => s + (r.paid || 0), 0), [rows]);
  const preventivo = useMemo(() => rows.reduce((s, r) => s + (r.amount || 0), 0), [rows]);

  // Giorni del viaggio, per il "al giorno" — inclusivi come ovunque nell'app.
  // parseLocalDate e non new Date(): la stringa YYYY-MM-DD sarebbe letta in UTC
  // e nei fusi negativi il conto slitterebbe di un giorno (stessa trappola già
  // corretta in biglietto, heatmap e recap).
  const days = useMemo(() => {
    if (!isValidDateISO(trip.trip_date) || !trip.date_end || !isValidDateISO(trip.date_end)) return 1;
    const d = Math.round((parseLocalDate(trip.date_end).getTime() - parseLocalDate(trip.trip_date).getTime()) / 86400000) + 1;
    return Number.isFinite(d) && d > 0 ? d : 1;
  }, [trip.trip_date, trip.date_end]);

  // Salvataggio allo SMONTAGGIO, non solo dalla X: il tasto indietro di Android
  // o un cambio di pagina smontano il pannello senza passare da onClose, e i
  // numeri appena scritti andrebbero persi (lezione già pagata con diario e
  // pianificazione).
  useEffect(() => {
    return () => {
      if (!dirtyRef.current) return;
      const clean = rowsRef.current.filter(r => r.label.trim() || (r.paid || 0) > 0 || (r.amount || 0) > 0);
      updateTrip(trip.id, { budget: clean });
      dirtyRef.current = false;
      onSaved?.(clean);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id]);

  // Scroll della pagina bloccato mentre il pannello è aperto (pattern iOS-proof).
  useEffect(() => {
    const y = window.scrollY;
    const body = document.body;
    const prev = { position: body.style.position, top: body.style.top, width: body.style.width };
    body.style.position = "fixed"; body.style.top = `-${y}px`; body.style.width = "100%";
    return () => {
      body.style.position = prev.position; body.style.top = prev.top; body.style.width = prev.width;
      window.scrollTo(0, y);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const patch = (i: number, v: Partial<ExpenseRow>) => {
    dirtyRef.current = true;
    setRows(prev => prev.map((r, k) => (k === i ? { ...r, ...v } : r)));
  };
  const addRow = () => { dirtyRef.current = true; setRows(prev => [...prev, { label: "", amount: 0, paid: 0 }]); };
  const removeRow = (i: number) => { dirtyRef.current = true; setRows(prev => prev.filter((_, k) => k !== i)); };

  const money: React.CSSProperties = {
    width: 92, background: "rgba(255,255,255,0.04)", border: "0.5px solid #1a2d4a", borderRadius: 8,
    padding: "7px 10px", color: "#f0f4ff", fontSize: 13, fontFamily: '"JetBrains Mono", monospace',
    textAlign: "right", outline: "none",
  };

  return createPortal(
    <div ref={modalRef} role="dialog" aria-modal="true" aria-label={`Spese — ${trip.title || trip.city}`}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "#060e1e", display: "flex", flexDirection: "column" }}>

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.1)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: "#f0f4ff" }}>Quanto è costato</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {trip.title || trip.city}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Chiudi le spese"
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", padding: 4 }}>
          <X style={{ width: 20, height: 20 }} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>

          {rows.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input value={r.label} onChange={e => patch(i, { label: e.target.value })}
                placeholder="Voce di spesa" aria-label={`Voce di spesa ${i + 1}`}
                style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.04)", border: "0.5px solid #1a2d4a",
                  borderRadius: 8, padding: "7px 12px", color: "#f0f4ff", fontSize: 13, outline: "none" }} />
              <input type="number" inputMode="decimal" min={0} value={r.paid || ""}
                onChange={e => patch(i, { paid: Number(e.target.value) || 0 })}
                placeholder="0" aria-label={`Speso per ${r.label || `voce ${i + 1}`}`} style={money} />
              <button type="button" onClick={() => removeRow(i)} aria-label={`Elimina ${r.label || `voce ${i + 1}`}`}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", cursor: "pointer", display: "flex", padding: 4 }}>
                <Trash2 style={{ width: 15, height: 15 }} />
              </button>
            </div>
          ))}

          <button type="button" onClick={addRow}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", background: "none",
              border: "none", color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer", padding: "4px 0" }}>
            <Plus style={{ width: 14, height: 14 }} /> Aggiungi una voce
          </button>

          <div style={{ borderTop: "0.5px solid #1a2d4a", marginTop: 6, paddingTop: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>Totale</span>
              <span className="font-mono" style={{ fontSize: 22, fontWeight: 700, color: "#6ee7b7" }}>
                {CUR} {total.toLocaleString("it-IT")}
              </span>
            </div>
            {total > 0 && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 6 }}>
                ≈ {CUR} {Math.round(total / days).toLocaleString("it-IT")} al giorno
                {/* Il preventivo compare solo se il viaggio era stato programmato. */}
                {preventivo > 0 && ` · avevi previsto ${CUR} ${preventivo.toLocaleString("it-IT")}`}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>,
    document.body,
  );
}
