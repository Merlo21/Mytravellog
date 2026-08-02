import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { unshareTrip, formatTripDate, Trip } from "@/lib/storage";
import { sharedMapView, pushSharedMap, hasSharedMap } from "@/lib/coupleSync";
import { Heart, X, Plus, RefreshCw } from "lucide-react";

/**
 * "La nostra mappa": la mappa condivisa (i tuoi viaggi flaggati + quelli del
 * partner, dalla cache sincronizzata). All'apertura fa un pull dal file Drive
 * condiviso (best-effort). "Togli" agisce solo sui TUOI viaggi e propaga.
 */
const NostraMappa = () => {
  const myEmail = localStorage.getItem("atlas.shared.myEmail");
  const [trips, setTrips] = useState<Trip[]>(() => sharedMapView());
  const [syncing, setSyncing] = useState(false);

  // Sync bidirezionale all'apertura (se collegato): push propaga i miei viaggi
  // condivisi E scarica quelli del partner, poi ricalcolo la vista. Silenzioso
  // se offline/non connesso (nessun popup su apertura pagina).
  useEffect(() => {
    if (!hasSharedMap()) return;
    setSyncing(true);
    pushSharedMap(false).then(() => setTrips(sharedMapView())).catch(() => { /* offline */ }).finally(() => setSyncing(false));
  }, []);

  const isMine = (t: Trip) => !t.sharedBy || t.sharedBy === myEmail;

  const remove = (id: string) => {
    unshareTrip(id);
    pushSharedMap().catch(() => { /* propaga al prossimo sync */ });
    setTrips(sharedMapView());
  };

  return (
    <div style={{ minHeight: "100vh", background: "#060e1e", display: "flex", flexDirection: "column" }}>
      <AppHeader />
      <div style={{ maxWidth: 760, margin: "0 auto", width: "100%", padding: "28px 20px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Heart style={{ width: 22, height: 22, color: "#f472b6", fill: "#f472b6" }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f0f4ff", margin: 0 }}>La nostra mappa</h1>
          {syncing && <RefreshCw style={{ width: 15, height: 15, color: "rgba(255,255,255,0.4)", animation: "spin 1s linear infinite" }} />}
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "0 0 20px" }}>
          {trips.length === 0
            ? "I viaggi che condividi con il partner. Aggiungine uno dal menu ⋮ del suo biglietto."
            : `${trips.length} ${trips.length === 1 ? "viaggio condiviso" : "viaggi condivisi"}${hasSharedMap() ? "" : " · attiva la mappa in Impostazioni per unirla al partner"}.`}
        </p>

        {trips.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 20px", color: "rgba(255,255,255,0.4)" }}>
            <Heart style={{ width: 40, height: 40, margin: "0 auto 12px", opacity: 0.4 }} />
            <div style={{ fontSize: 14 }}>Ancora nessun viaggio condiviso.</div>
            <Link to="/miei-viaggi" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14, fontSize: 13, fontWeight: 600, color: "#f472b6", textDecoration: "none" }}>
              <Plus style={{ width: 15, height: 15 }} /> Vai ai tuoi viaggi
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {trips.map(t => {
              const mine = isMine(t);
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#0b1a33", border: "0.5px solid #1a2d4a", borderRadius: 12, padding: "12px 16px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#f0f4ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.title || t.city} {t.country_code && <span style={{ fontSize: 10, color: "#93c5fd" }}>{t.country_code.toUpperCase()}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                      {formatTripDate(t.trip_date)}{t.date_end ? ` – ${formatTripDate(t.date_end)}` : ""}
                      {!mine && t.sharedBy && <span style={{ color: "#f9a8d4" }}> · di {t.sharedBy.split("@")[0]}</span>}
                    </div>
                  </div>
                  {mine ? (
                    <button type="button" onClick={() => remove(t.id)} aria-label={`Togli "${t.title || t.city}" dalla nostra mappa`} title="Togli dalla nostra mappa"
                      style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(244,114,182,0.12)", border: "0.5px solid rgba(244,114,182,0.35)", borderRadius: 999, padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "#f9a8d4", cursor: "pointer" }}>
                      <X style={{ width: 13, height: 13 }} /> togli
                    </button>
                  ) : (
                    <Heart style={{ width: 15, height: 15, color: "#f472b6", fill: "#f472b6", flexShrink: 0 }} aria-label="Del partner" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NostraMappa;
