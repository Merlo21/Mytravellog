import { Trip, formatTripDate } from "@/lib/storage";
import { planCountdown, CUR } from "@/lib/plans";
import { MapPin, Check } from "lucide-react";

/**
 * Card di un viaggio "in programma": conto alla rovescia, tappe, budget e
 * cose da organizzare. Toccandola si apre il pannello di pianificazione.
 *
 * Vive qui perché la usano DUE pagine: "In programma" (l'elenco) e "I miei
 * viaggi" (in cima, sopra i ricordi) — prima lì c'era solo una strisciolina
 * che rimandava altrove, e per vedere il budget bisognava cambiare pagina.
 */

function dateRange(t: Trip): string {
  return t.date_end ? `${formatTripDate(t.trip_date)} – ${formatTripDate(t.date_end)}` : formatTripDate(t.trip_date);
}

export function PlanCard({ plan: p, onOpen }: { plan: Trip; onOpen: () => void }) {
  const total = (p.budget ?? []).reduce((s, r) => s + (r.amount || 0), 0);
  const paid = (p.budget ?? []).reduce((s, r) => s + (r.paid || 0), 0);
  const cl = p.checklist ?? [];
  const done = cl.filter(c => c.done).length;
  const cd = planCountdown(p);

  return (
    <button type="button" onClick={onOpen}
      style={{ display: "block", width: "100%", textAlign: "left", background: "#0b1a33",
        border: "0.5px solid " + (cd.returned ? "rgba(52,211,153,0.35)" : "#1a2d4a"),
        borderRadius: 12, padding: "16px 18px", color: "#f0f4ff", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 16, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {p.title || p.city} {p.country_code && <span style={{ fontSize: 10, color: "#93c5fd" }}>{p.country_code.toUpperCase()}</span>}
        </div>
        <div style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, color: cd.returned ? "#34d399" : cd.urgent ? "#fbbf24" : "rgba(255,255,255,0.6)" }}>{cd.text}</div>
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{dateRange(p)} · in programma</div>
      {(p.waypoints?.length ?? 0) > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#93c5fd", marginTop: 6, minWidth: 0 }}>
          <MapPin style={{ width: 12, height: 12, flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {[...p.waypoints.map(w => w.city), p.city].join(" → ")}
          </span>
        </div>
      )}
      {cd.returned && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 11, color: "#34d399" }}>
          <Check style={{ width: 14, height: 14 }} /> Viaggio concluso — aprilo e segnalo come fatto
        </div>
      )}

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 14 }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 9, letterSpacing: ".06em", color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>BUDGET PREVENTIVO</div>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{total > 0 ? `${CUR} ${total.toLocaleString("it-IT")}` : "—"}</div>
          {total > 0 && (
            <>
              <div style={{ height: 5, borderRadius: 999, background: "#16233d", marginTop: 6, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, Math.round((paid / total) * 100))}%`, height: "100%", background: "#34d399" }} />
              </div>
              {paid > 0 && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", marginTop: 3 }}>già pagato {CUR} {paid.toLocaleString("it-IT")}</div>}
            </>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 9, letterSpacing: ".06em", color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>DA ORGANIZZARE</div>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{cl.length ? `${done} / ${cl.length}` : "—"} {cl.length > 0 && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 400 }}>fatte</span>}</div>
          {cl.length > 0 && (
            <div style={{ height: 5, borderRadius: 999, background: "#16233d", marginTop: 6, overflow: "hidden" }}>
              <div style={{ width: `${Math.round((done / cl.length) * 100)}%`, height: "100%", background: "#60a5fa" }} />
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
