import { useMemo, useState } from "react";
import { loadTrips } from "@/lib/storage";
import { X } from "lucide-react";

/** Motivi del viaggio (scelta singola). */
export const PURPOSES = ["Vacanza", "Lavoro"];

interface Props {
  purpose: string | null;
  setPurpose: (p: string | null) => void;
  companions: string[];
  setCompanions: (c: string[]) => void;
}

const box: React.CSSProperties = {
  background: "#0a1628", border: "0.5px solid #1a2d4a", borderRadius: 8, padding: "14px 16px",
};
const label: React.CSSProperties = {
  fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: "1.5px", textTransform: "uppercase",
  display: "block", marginBottom: 9,
};
const smallInput: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: "0.5px solid #1a2d4a", borderRadius: 8,
  padding: "8px 12px", color: "#f0f4ff", fontSize: 13, outline: "none", width: "100%",
};

/**
 * Blocco "Motivo + Compagni" del form viaggio: il MOTIVO è a scelta singola
 * (Vacanza/Lavoro, ri-toccare deseleziona → nessuno); i COMPAGNI sono nomi con
 * autocomplete dai viaggi già salvati. Componente controllato: lo stato vive
 * nel form. Standalone di proposito (TripFormParts è FROZEN).
 */
export function TripPurposeCompanions({ purpose, setPurpose, companions, setCompanions }: Props) {
  const [nameInput, setNameInput] = useState("");

  // Autocomplete compagni: nomi già usati negli altri viaggi (dedup).
  const knownNames = useMemo(() => {
    const set = new Set<string>();
    for (const tr of loadTrips()) for (const c of tr.companions ?? []) set.add(c);
    return Array.from(set);
  }, []);

  const addName = (raw: string) => {
    const v = raw.trim();
    if (v && !companions.some(c => c.toLowerCase() === v.toLowerCase())) setCompanions([...companions, v]);
    setNameInput("");
  };

  const suggestions = nameInput.trim()
    ? knownNames.filter(n =>
        n.toLowerCase().includes(nameInput.trim().toLowerCase()) &&
        !companions.some(c => c.toLowerCase() === n.toLowerCase()),
      ).slice(0, 5)
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Motivo — segmented a scelta singola */}
      <div style={box}>
        <label style={label}>Motivo <span style={{ opacity: 0.4, textTransform: "none" }}>(opzionale)</span></label>
        <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.04)", border: "0.5px solid #1a2d4a", borderRadius: 999, padding: 3, gap: 3 }}>
          {PURPOSES.map(p => {
            const on = purpose === p;
            return (
              <button key={p} type="button" aria-pressed={on}
                onClick={() => setPurpose(on ? null : p)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: "6px 18px", borderRadius: 999, cursor: "pointer",
                  border: "none",
                  background: on ? "rgba(96,165,250,0.18)" : "transparent",
                  color: on ? "#60a5fa" : "rgba(255,255,255,0.55)",
                }}>
                {p}
              </button>
            );
          })}
        </div>
      </div>

      {/* Compagni di viaggio */}
      <div style={box}>
        <label style={label}>Compagni di viaggio <span style={{ opacity: 0.4, textTransform: "none" }}>(opzionale)</span></label>
        {companions.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
            {companions.map(c => (
              <span key={c} style={{
                display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
                padding: "6px 8px 6px 12px", borderRadius: 999,
                background: "rgba(52,211,153,0.14)", border: "0.5px solid rgba(52,211,153,0.5)", color: "#6ee7b7",
              }}>
                {c}
                <button type="button" onClick={() => setCompanions(companions.filter(x => x !== c))}
                  aria-label={`Rimuovi ${c}`}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", display: "flex", opacity: 0.7 }}>
                  <X style={{ width: 12, height: 12 }} />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addName(nameInput); }
          }}
          onBlur={() => addName(nameInput)}
          placeholder="Aggiungi un nome e premi Invio…"
          style={smallInput}
        />
        {suggestions.length > 0 && (
          <div style={{ marginTop: 6, background: "#0b1524", border: "0.5px solid #1a2d4a", borderRadius: 8, overflow: "hidden" }}>
            {suggestions.map(n => (
              <button key={n} type="button"
                // onMouseDown (non onClick): parte PRIMA del blur dell'input.
                onMouseDown={e => { e.preventDefault(); addName(n); }}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "8px 12px",
                  fontSize: 12, color: "rgba(255,255,255,0.8)", background: "none", border: "none", cursor: "pointer",
                }}>
                {n} <span style={{ opacity: 0.4 }}>· già usato</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
