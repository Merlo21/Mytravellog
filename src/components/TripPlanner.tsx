import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Trip, updatePlan, deletePlan, promotePlanToTrip } from "@/lib/storage";
import { X, Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

export interface BudgetRow { label: string; amount: number; paid?: number }
export interface ChecklistRow { text: string; done: boolean }

interface Props {
  plan: Trip;
  onClose: () => void;
  /** Richiama il ricarico dei piani nella pagina (dopo salva / promuovi / elimina). */
  onChanged: () => void;
}

export const CUR = "€"; // valuta di default (nessun selettore valuta in v1)

const DEFAULT_BUDGET: BudgetRow[] = [
  { label: "Volo", amount: 0 },
  { label: "Alloggio", amount: 0 },
  { label: "Trasporti", amount: 0 },
  { label: "Cibo", amount: 0 },
  { label: "Attività", amount: 0 },
];
const DEFAULT_CHECKLIST: ChecklistRow[] = [
  { text: "Prenota volo", done: false },
  { text: "Prenota alloggio", done: false },
  { text: "Documenti / passaporto", done: false },
];

function fmt(n: number): string {
  return n.toLocaleString("it-IT");
}

/**
 * Pannello di pianificazione di un viaggio "in programma": budget preventivo
 * per categoria (con eventuale "già pagato") + checklist "da organizzare".
 * Portal a schermo intero, si salva alla chiusura. "Segna come fatto" sposta
 * il viaggio nel diario (promotePlanToTrip). Scroll pagina bloccato (iOS-proof).
 */
export function TripPlanner({ plan, onClose, onChanged }: Props) {
  const [budget, setBudget] = useState<BudgetRow[]>(() =>
    plan.budget && plan.budget.length ? plan.budget.map(r => ({ ...r })) : DEFAULT_BUDGET.map(r => ({ ...r })),
  );
  const [checklist, setChecklist] = useState<ChecklistRow[]>(() =>
    plan.checklist && plan.checklist.length ? plan.checklist.map(r => ({ ...r })) : DEFAULT_CHECKLIST.map(r => ({ ...r })),
  );

  const total = useMemo(() => budget.reduce((s, r) => s + (r.amount || 0), 0), [budget]);
  const paidTotal = useMemo(() => budget.reduce((s, r) => s + (r.paid || 0), 0), [budget]);
  const doneCount = checklist.filter(c => c.done).length;

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

  const persist = () => {
    const b = budget.filter(r => r.label.trim() || r.amount || r.paid)
      .map(r => ({ label: r.label.trim() || "Voce", amount: r.amount || 0, ...(r.paid ? { paid: r.paid } : {}) }));
    const c = checklist.filter(r => r.text.trim()).map(r => ({ text: r.text.trim(), done: r.done }));
    updatePlan(plan.id, { budget: b.length ? b : undefined, checklist: c.length ? c : undefined });
    onChanged();
  };

  const close = () => { persist(); onClose(); };

  const promote = () => {
    if (!window.confirm(`Segnare "${plan.title || plan.city}" come fatto? Verrà spostato nei tuoi viaggi.`)) return;
    persist();
    promotePlanToTrip(plan.id);
    toast.success("Spostato nei tuoi viaggi ✓");
    onChanged();
    onClose();
  };

  const remove = () => {
    if (!window.confirm(`Eliminare il viaggio in programma "${plan.title || plan.city}"?`)) return;
    deletePlan(plan.id);
    toast.success("Piano eliminato");
    onChanged();
    onClose();
  };

  const setBudgetRow = (i: number, patch: Partial<BudgetRow>) =>
    setBudget(rows => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const numInput: React.CSSProperties = {
    width: 78, background: "rgba(255,255,255,0.04)", border: "0.5px solid #1a2d4a", borderRadius: 7,
    padding: "6px 8px", fontSize: 12, color: "#f0f4ff", outline: "none", textAlign: "right", fontFamily: "inherit",
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", margin: "0 0 10px",
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#060e1e", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.1)", background: "rgba(6,14,30,0.95)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#f0f4ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            🧭 Pianifica — {plan.title || plan.city}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
            Budget e cose da organizzare · si salva da solo
          </div>
        </div>
        <button type="button" onClick={close} aria-label="Chiudi la pianificazione"
          style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.8)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X style={{ width: 18, height: 18 }} />
        </button>
      </div>

      {/* Corpo scrollabile */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", padding: 16 }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>

          {/* BUDGET */}
          <div style={sectionTitle}>Budget preventivo</div>
          {budget.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <input value={r.label} onChange={e => setBudgetRow(i, { label: e.target.value })} placeholder="Categoria"
                style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.04)", border: "0.5px solid #1a2d4a", borderRadius: 7, padding: "6px 10px", fontSize: 13, color: "#f0f4ff", outline: "none", fontFamily: "inherit" }} />
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: 8, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{CUR}</span>
                <input type="number" inputMode="decimal" min={0} value={r.amount || ""} onChange={e => setBudgetRow(i, { amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0" title="Preventivo" style={{ ...numInput, paddingLeft: 18 }} />
              </div>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }} title="Già pagato / prenotato">
                <Check style={{ position: "absolute", left: 7, width: 11, height: 11, color: "rgba(52,211,153,0.7)" }} />
                <input type="number" inputMode="decimal" min={0} value={r.paid || ""} onChange={e => setBudgetRow(i, { paid: parseFloat(e.target.value) || 0 })}
                  placeholder="pagato" style={{ ...numInput, paddingLeft: 22, color: "#6ee7b7" }} />
              </div>
              <button type="button" onClick={() => setBudget(rows => rows.filter((_, idx) => idx !== i))} aria-label="Rimuovi categoria"
                style={{ flexShrink: 0, background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: 4 }}>
                <Trash2 style={{ width: 15, height: 15 }} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setBudget(rows => [...rows, { label: "", amount: 0 }])}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "2px 0", marginTop: 2 }}>
            <Plus style={{ width: 14, height: 14 }} /> aggiungi categoria
          </button>

          {/* Totali */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14, paddingTop: 12, borderTop: "0.5px solid #2a3f5f" }}>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>Totale preventivo</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#f0f4ff" }}>{CUR} {fmt(total)}</div>
            </div>
            {paidTotal > 0 && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>Già pagato</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#6ee7b7" }}>{CUR} {fmt(paidTotal)}</div>
              </div>
            )}
          </div>
          {total > 0 && (
            <div style={{ height: 6, borderRadius: 999, background: "#16233d", marginTop: 10, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, Math.round((paidTotal / total) * 100))}%`, height: "100%", background: "#34d399" }} />
            </div>
          )}

          {/* CHECKLIST */}
          <div style={{ ...sectionTitle, marginTop: 28 }}>
            Da organizzare {checklist.length > 0 && <span style={{ color: "#60a5fa" }}>· {doneCount}/{checklist.length}</span>}
          </div>
          {checklist.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <button type="button" onClick={() => setChecklist(rows => rows.map((r, idx) => idx === i ? { ...r, done: !r.done } : r))}
                aria-label={c.done ? "Segna da fare" : "Segna fatto"} role="checkbox" aria-checked={c.done}
                style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, border: "1.5px solid " + (c.done ? "#34d399" : "#2a3f5f"), background: c.done ? "rgba(52,211,153,0.18)" : "transparent", color: "#34d399", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                {c.done && <Check style={{ width: 14, height: 14 }} />}
              </button>
              <input value={c.text} onChange={e => setChecklist(rows => rows.map((r, idx) => idx === i ? { ...r, text: e.target.value } : r))}
                placeholder="Cosa c'è da fare?"
                style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", borderBottom: "0.5px solid #1a2d4a", padding: "5px 2px", fontSize: 13, color: c.done ? "rgba(255,255,255,0.4)" : "#f0f4ff", textDecoration: c.done ? "line-through" : "none", outline: "none", fontFamily: "inherit" }} />
              <button type="button" onClick={() => setChecklist(rows => rows.filter((_, idx) => idx !== i))} aria-label="Rimuovi voce"
                style={{ flexShrink: 0, background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: 4 }}>
                <Trash2 style={{ width: 15, height: 15 }} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setChecklist(rows => [...rows, { text: "", done: false }])}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "2px 0", marginTop: 2 }}>
            <Plus style={{ width: 14, height: 14 }} /> aggiungi cosa da fare
          </button>

          {/* Azioni */}
          <div style={{ display: "flex", gap: 10, marginTop: 32, paddingTop: 18, borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
            <button type="button" onClick={promote}
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, background: "#34d399", border: "none", borderRadius: 10, padding: "11px 14px", fontSize: 14, fontWeight: 700, color: "#052e22", cursor: "pointer" }}>
              <Check style={{ width: 17, height: 17 }} /> Segna come fatto
            </button>
            <button type="button" onClick={remove} aria-label="Elimina piano"
              style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "0.5px solid rgba(248,113,113,0.4)", borderRadius: 10, padding: "11px 14px", color: "#f87171", cursor: "pointer" }}>
              <Trash2 style={{ width: 17, height: 17 }} />
            </button>
          </div>

        </div>
      </div>
    </div>,
    document.body,
  );
}
