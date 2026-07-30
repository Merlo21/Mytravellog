import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { searchPlaces, GeoResult } from "@/lib/geo";
import { Trip, loadPlans, addPlan, formatTripDate } from "@/lib/storage";
import { planCountdown, CUR } from "@/lib/plans";
import { TripPlanner } from "@/components/TripPlanner";
import { isReturnBeforeDeparture } from "@/components/TripFormParts";
import { CalendarClock, Plus, MapPin, X, Check } from "lucide-react";
import { toast } from "sonner";

function buildPlan(dest: GeoResult, title: string, dateStart: string, dateEnd: string): Omit<Trip, "id" | "created_at" | "status"> {
  return {
    title: title.trim() || dest.name,
    country: dest.country, city: dest.name, country_code: dest.country_code ?? "",
    trip_date: dateStart, date_end: dateEnd || null,
    rating: null, notes: null, transport_mode: "plane", waypoints: [],
    latitude: dest.latitude, longitude: dest.longitude,
    home_latitude: null, home_longitude: null, home_label: null, route_geometry: null,
    temperature_c: null, altitude_m: null, max_altitude_m: null, max_altitude_city: null,
    distance_from_home_km: null, max_distance_from_home_km: null, max_distance_city: null,
    hottest_temp_c: null, hottest_city: null, coldest_temp_c: null, coldest_city: null,
    region: null, region_details: null,
  };
}

function dateRange(t: Trip): string {
  return t.date_end ? `${formatTripDate(t.trip_date)} – ${formatTripDate(t.date_end)}` : formatTripDate(t.trip_date);
}

const InProgramma = () => {
  const [plans, setPlans] = useState<Trip[]>(() => loadPlans());
  const [openId, setOpenId] = useState<string | null>(null);
  const reload = () => setPlans(loadPlans());

  // Mini-form di creazione
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [dest, setDest] = useState<GeoResult | null>(null);
  const [title, setTitle] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.length < 2 || dest) { setResults([]); return; }
      setResults((await searchPlaces(query)).slice(0, 5));
    }, 300);
    return () => clearTimeout(t);
  }, [query, dest]);

  const resetForm = () => { setAdding(false); setQuery(""); setResults([]); setDest(null); setTitle(""); setDateStart(""); setDateEnd(""); };

  const canSave = dest && dateStart;
  const create = () => {
    if (!dest || !dateStart) return;
    if (isReturnBeforeDeparture(dateStart, dateEnd)) {
      toast.error("Il ritorno non può essere prima della partenza");
      return;
    }
    addPlan(buildPlan(dest, title, dateStart, dateEnd));
    resetForm();
    reload();
  };

  const openPlan = useMemo(() => plans.find(p => p.id === openId) ?? null, [plans, openId]);

  return (
    <div style={{ minHeight: "100vh", background: "#060e1e", display: "flex", flexDirection: "column" }}>
      <AppHeader />

      <div style={{ maxWidth: 760, margin: "0 auto", width: "100%", padding: "28px 20px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <CalendarClock style={{ width: 22, height: 22, color: "#60a5fa" }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f0f4ff", margin: 0 }}>In programma</h1>
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "0 0 20px" }}>
          I viaggi che devi ancora fare: budget e cose da organizzare. Al ritorno diventano ricordi nel diario.
        </p>

        {/* Mini-form / bottone */}
        {!adding ? (
          <button type="button" onClick={() => setAdding(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#60a5fa", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 700, color: "#04203f", cursor: "pointer", marginBottom: 24 }}>
            <Plus style={{ width: 17, height: 17 }} /> Programma un viaggio
          </button>
        ) : (
          <div style={{ background: "#0b1a33", border: "0.5px solid #1a2d4a", borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f4ff" }}>Nuovo viaggio in programma</div>
              <button type="button" onClick={resetForm} aria-label="Annulla"
                style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: 2 }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {/* Destinazione */}
            {dest ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(96,165,250,0.12)", border: "0.5px solid rgba(96,165,250,0.35)", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
                <MapPin style={{ width: 15, height: 15, color: "#93c5fd" }} />
                <span style={{ fontSize: 13, color: "#f0f4ff", flex: 1 }}>{dest.name}, {dest.country}</span>
                <button type="button" onClick={() => { setDest(null); setQuery(""); }} aria-label="Cambia destinazione"
                  style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: 2 }}>
                  <X style={{ width: 15, height: 15 }} />
                </button>
              </div>
            ) : (
              <div style={{ position: "relative", marginBottom: 10 }}>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Dove vuoi andare?" autoFocus
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "0.5px solid #1a2d4a", borderRadius: 8, padding: "9px 11px", fontSize: 13, color: "#f0f4ff", outline: "none", fontFamily: "inherit" }} />
                {results.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 5, marginTop: 4, background: "#0d1f3d", border: "0.5px solid #1a2d4a", borderRadius: 8, overflow: "hidden" }}>
                    {results.map((r, i) => (
                      <button key={i} type="button" onMouseDown={() => { setDest(r); setResults([]); if (!title) setTitle(r.name); }}
                        style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", borderTop: i ? "0.5px solid #16233d" : "none", padding: "9px 11px", fontSize: 13, color: "#f0f4ff", cursor: "pointer" }}>
                        {r.name} <span style={{ color: "rgba(255,255,255,0.4)" }}>· {r.country}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Date */}
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <label style={{ flex: 1, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Partenza
                <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)}
                  style={{ width: "100%", marginTop: 4, background: "rgba(255,255,255,0.04)", border: "0.5px solid #1a2d4a", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#f0f4ff", outline: "none", fontFamily: "inherit", colorScheme: "dark" }} />
              </label>
              <label style={{ flex: 1, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Ritorno
                <input type="date" value={dateEnd} min={dateStart || undefined} onChange={e => setDateEnd(e.target.value)}
                  style={{ width: "100%", marginTop: 4, background: "rgba(255,255,255,0.04)", border: "0.5px solid #1a2d4a", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#f0f4ff", outline: "none", fontFamily: "inherit", colorScheme: "dark" }} />
              </label>
            </div>

            {/* Titolo */}
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titolo (opzionale)"
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "0.5px solid #1a2d4a", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#f0f4ff", outline: "none", fontFamily: "inherit", marginBottom: 12 }} />

            <button type="button" onClick={create} disabled={!canSave}
              style={{ width: "100%", background: canSave ? "#34d399" : "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, color: canSave ? "#052e22" : "rgba(255,255,255,0.35)", cursor: canSave ? "pointer" : "default" }}>
              Aggiungi al programma
            </button>
          </div>
        )}

        {/* Lista piani */}
        {plans.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 20px", color: "rgba(255,255,255,0.4)" }}>
            <CalendarClock style={{ width: 40, height: 40, margin: "0 auto 12px", opacity: 0.4 }} />
            <div style={{ fontSize: 14 }}>Nessun viaggio in programma.</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Programma la tua prossima avventura e organizza budget e da-fare.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {plans.map(p => {
              const total = (p.budget ?? []).reduce((s, r) => s + (r.amount || 0), 0);
              const paid = (p.budget ?? []).reduce((s, r) => s + (r.paid || 0), 0);
              const cl = p.checklist ?? [];
              const done = cl.filter(c => c.done).length;
              const cd = planCountdown(p);
              return (
                <button key={p.id} type="button" onClick={() => setOpenId(p.id)}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "#0b1a33", border: "0.5px solid " + (cd.returned ? "rgba(52,211,153,0.35)" : "#1a2d4a"), borderRadius: 12, padding: "16px 18px", color: "#f0f4ff", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 16, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.title || p.city} {p.country_code && <span style={{ fontSize: 10, color: "#93c5fd" }}>{p.country_code.toUpperCase()}</span>}
                    </div>
                    <div style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, color: cd.returned ? "#34d399" : cd.urgent ? "#fbbf24" : "rgba(255,255,255,0.5)" }}>{cd.text}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{dateRange(p)} · in programma</div>
                  {cd.returned && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 11, color: "#34d399" }}>
                      <Check style={{ width: 14, height: 14 }} /> Viaggio concluso — aprilo e segnalo come fatto
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 14 }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 9, letterSpacing: ".06em", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>BUDGET PREVENTIVO</div>
                      <div style={{ fontSize: 17, fontWeight: 600 }}>{total > 0 ? `${CUR} ${total.toLocaleString("it-IT")}` : "—"}</div>
                      {total > 0 && (
                        <>
                          <div style={{ height: 5, borderRadius: 999, background: "#16233d", marginTop: 6, overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(100, Math.round((paid / total) * 100))}%`, height: "100%", background: "#34d399" }} />
                          </div>
                          {paid > 0 && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>già pagato {CUR} {paid.toLocaleString("it-IT")}</div>}
                        </>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 9, letterSpacing: ".06em", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>DA ORGANIZZARE</div>
                      <div style={{ fontSize: 17, fontWeight: 600 }}>{cl.length ? `${done} / ${cl.length}` : "—"} {cl.length > 0 && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 400 }}>fatte</span>}</div>
                      {cl.length > 0 && (
                        <div style={{ height: 5, borderRadius: 999, background: "#16233d", marginTop: 6, overflow: "hidden" }}>
                          <div style={{ width: `${Math.round((done / cl.length) * 100)}%`, height: "100%", background: "#60a5fa" }} />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {openPlan && <TripPlanner plan={openPlan} onClose={() => setOpenId(null)} onChanged={reload} />}
    </div>
  );
};

export default InProgramma;
