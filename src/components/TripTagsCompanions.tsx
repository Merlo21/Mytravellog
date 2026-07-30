import { useMemo, useState } from "react";
import { loadTrips } from "@/lib/storage";
import { X } from "lucide-react";

/** Tag preset del viaggio; l'utente può comunque aggiungerne di custom. */
export const PRESET_TAGS = ["Vacanza", "Lavoro", "Coppia", "Weekend", "Famiglia", "Amici", "Avventura"];

interface Props {
  tags: string[];
  setTags: (t: string[]) => void;
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
const chipBase: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
  border: "0.5px solid #1a2d4a", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)",
};
const chipOn: React.CSSProperties = {
  ...chipBase, background: "rgba(96,165,250,0.16)", border: "1px solid #60a5fa", color: "#60a5fa",
};
const smallInput: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: "0.5px solid #1a2d4a", borderRadius: 8,
  padding: "8px 12px", color: "#f0f4ff", fontSize: 13, outline: "none", width: "100%",
};

/**
 * Blocco "Con chi / Che tipo" del form viaggio: tag (preset + custom, multi-
 * scelta) e compagni (nomi con autocomplete dai viaggi già salvati). Componente
 * controllato: lo stato vive nel form, che lo passa ad addTrip/updateTrip.
 * Standalone di proposito (TripFormParts è FROZEN): importato dai due form.
 */
export function TripTagsCompanions({ tags, setTags, companions, setCompanions }: Props) {
  const [customTag, setCustomTag] = useState("");
  const [nameInput, setNameInput] = useState("");

  const toggleTag = (t: string) =>
    setTags(tags.includes(t) ? tags.filter(x => x !== t) : [...tags, t]);

  const addCustomTag = () => {
    const v = customTag.trim();
    if (v && !tags.some(x => x.toLowerCase() === v.toLowerCase())) setTags([...tags, v]);
    setCustomTag("");
  };

  const customTags = tags.filter(t => !PRESET_TAGS.includes(t));

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
      {/* Tipo di viaggio (tag) */}
      <div style={box}>
        <label style={label}>Tipo di viaggio <span style={{ opacity: 0.4, textTransform: "none" }}>(opzionale)</span></label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {PRESET_TAGS.map(t => (
            <button key={t} type="button" onClick={() => toggleTag(t)}
              style={tags.includes(t) ? chipOn : chipBase} aria-pressed={tags.includes(t)}>
              {t}
            </button>
          ))}
          {customTags.map(t => (
            <span key={t} style={{ ...chipOn, display: "inline-flex", alignItems: "center", gap: 6 }}>
              {t}
              <button type="button" onClick={() => toggleTag(t)} aria-label={`Rimuovi tag ${t}`}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", display: "flex", opacity: 0.7 }}>
                <X style={{ width: 12, height: 12 }} />
              </button>
            </span>
          ))}
        </div>
        <input
          value={customTag}
          onChange={e => setCustomTag(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
          onBlur={addCustomTag}
          placeholder="+ aggiungi un tag tuo…"
          style={{ ...smallInput, marginTop: 10 }}
        />
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
                // onMouseDown (non onClick): parte PRIMA del blur dell'input, che
                // altrimenti aggiungerebbe già il testo digitato e chiuderebbe la lista.
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
