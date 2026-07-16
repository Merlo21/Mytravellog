// [FROZEN] — Non modificare senza esplicita richiesta
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useNavigate, useParams } from "react-router-dom";
import { searchPlaces, fetchElevation, fetchTemperature, fetchDrivingRoute, mergeRegions, distanceKm, GeoResult, RegionInfo } from "@/lib/geo";
import { updateTrip, loadTrips, todayLocalISO } from "@/lib/storage";
import { useSettings } from "@/lib/settings";
import { sequentialMap } from "@/lib/utils";
import { toast } from "sonner";
import {
  TransportMode, Waypoint, ItineraryPanel, TripFormFields, TripPhotosPerStop,
  TripFormActions, useUnsavedChangesGuard, isReturnBeforeDeparture,
} from "@/components/TripFormParts";

async function fetchNominatimRegion(lat: number, lon: number): Promise<RegionInfo> {
  if (!lat || !lon) return { name: null, code: null };
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=6&addressdetails=1`;
    const r = await fetch(url, { headers: { "Accept-Language": "it", "User-Agent": "NAV-TA/1.0" } });
    if (!r.ok) return { name: null, code: null };
    const d = await r.json();
    // Vedi commento in geo.ts::fetchRegion: Nominatim usa campi diversi per
    // paesi diversi (province in Giappone, city per le città-stato).
    const name = d?.address?.state ?? d?.address?.region ?? d?.address?.county
      ?? d?.address?.province ?? d?.address?.city ?? d?.name ?? null;
    const code = d?.address?.["ISO3166-2-lvl4"] ?? null;
    return { name, code };
  } catch {
    return { name: null, code: null };
  }
}

/** Un viaggio multi-tappa può attraversare più regioni: raccoglie quelle di
 * ogni tappa (deduplicate per codice ISO, unite con ", "), non solo quella
 * della destinazione. Le chiamate a Nominatim sono sequenziali (non
 * Promise.all): la sua usage policy chiede non più di 1 richiesta/secondo, e
 * un viaggio con molte tappe sparate tutte in parallelo rischierebbe un
 * rate-limit silenzioso con alcune tappe che restano senza regione. */
export async function fetchMultiRegion(
  points: { lat: number; lon: number }[],
  delayMs = 1100
): Promise<{ region: string | null; details: { name: string; code: string | null }[] }> {
  const results = await sequentialMap(points, p => fetchNominatimRegion(p.lat, p.lon), delayMs);
  const details = mergeRegions(results);
  const region = details.length > 0 ? details.map(r => r.name).join(", ") : null;
  return { region, details };
}

const ModificaViaggio = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const s = useSettings();
  const trip = loadTrips().find(t => t.id === id);

  const [title, setTitle] = useState(trip?.title ?? "");
  const [dateStart, setDateStart] = useState(trip?.trip_date ?? todayLocalISO());
  const [dateEnd, setDateEnd] = useState(trip?.date_end ?? "");
  const [notes, setNotes] = useState(trip?.notes ?? "");
  const [rating, setRating] = useState(trip?.rating ?? 0);
  const [waypoints, setWaypoints] = useState<Waypoint[]>(
    trip ? [
      ...(trip.waypoints ?? []).map(w => ({
        // w.id manca sui viaggi salvati prima che le tappe avessero un id
        // stabile (serve per collegare le foto alla tappa giusta): ne
        // generiamo uno nuovo qui, e un effect subito dopo lo salva davvero
        // (altrimenti resterebbe solo in memoria finché non si preme "Salva").
        id: w.id ?? crypto.randomUUID(),
        city: w.city, country: w.country, country_code: "",
        lat: w.lat ?? 0, lon: w.lon ?? 0, transport_mode: w.transport_mode as TransportMode,
      })),
      { id: crypto.randomUUID(), city: trip.city, country: trip.country, country_code: trip.country_code ?? "",
        lat: trip.latitude, lon: trip.longitude,
        transport_mode: (trip.transport_mode ?? "plane") as TransportMode }
    ] : []
  );
  const [wpQuery, setWpQuery] = useState("");
  const [wpResults, setWpResults] = useState<GeoResult[]>([]);
  const [wpLoading, setWpLoading] = useState(false);
  const [wpOpen, setWpOpen] = useState(false);
  const [wpTransport, setWpTransport] = useState<TransportMode>("plane");
  const homeCity = s.homeCity;
  const [home, setHome] = useState<{ lat: number; lon: number; label: string } | null>(
    trip?.home_latitude ? { lat: trip.home_latitude, lon: trip.home_longitude!, label: trip.home_label ?? "" }
    : homeCity ? { lat: homeCity.lat, lon: homeCity.lon, label: homeCity.label } : null
  );
  const [editingHome, setEditingHome] = useState(false);
  const [homeQuery, setHomeQuery] = useState(trip?.home_label ?? homeCity?.label ?? "");
  const [homeResults, setHomeResults] = useState<GeoResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [destinationError, setDestinationError] = useState(false);

  const { confirmDiscard } = useUnsavedChangesGuard([title, dateStart, dateEnd, notes, rating, waypoints, home]);

  // Le tappe salvate prima che avessero un id stabile lo ricevono al volo
  // sopra (in waypoints ?? crypto.randomUUID()), ma solo in memoria: se
  // l'utente aggiunge foto a una tappa senza mai premere "Salva viaggio",
  // quell'id andrebbe perso e le foto orfane. Lo persistiamo subito qui,
  // usando esattamente gli stessi id già generati in waypoints (stesso
  // ordine), non nuovi — altrimenti in-memory e salvato andrebbero fuori sync.
  useEffect(() => {
    if (!id || !trip) return;
    const original = trip.waypoints ?? [];
    if (original.every(w => w.id)) return;
    const withIds = original.map((w, i) => ({ ...w, id: waypoints[i]?.id ?? w.id ?? crypto.randomUUID() }));
    updateTrip(id, { waypoints: withIds });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (homeQuery.length < 2) { setHomeResults([]); return; }
      setHomeResults(await searchPlaces(homeQuery));
    }, 300);
    return () => clearTimeout(t);
  }, [homeQuery]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (wpQuery.length < 2) { setWpResults([]); setWpLoading(false); return; }
      setWpLoading(true);
      setWpResults((await searchPlaces(wpQuery)).slice(0, 5));
      setWpLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [wpQuery]);

  // Prima questo controllo (e il redirect) precedeva tutti gli hook sopra:
  // se il viaggio veniva eliminato altrove mentre questa pagina era aperta,
  // "trip" sarebbe diventato undefined in un render successivo con MENO hook
  // chiamati rispetto al render precedente — un errore React ("Rendered
  // fewer hooks than expected"), non solo un redirect mancato. Il redirect
  // va quindi in un effect, e l'uscita anticipata dalla JSX solo DOPO che
  // tutti gli hook di questo render sono già stati chiamati.
  useEffect(() => {
    if (!trip) navigate("/");
  }, [trip, navigate]);

  if (!trip) return null;

  const addWaypoint = (r: GeoResult) => {
    setWaypoints(prev => [...prev, {
      id: crypto.randomUUID(),
      city: r.name, country: r.country, country_code: r.country_code ?? "",
      lat: r.latitude, lon: r.longitude, transport_mode: wpTransport,
    }]);
    setWpQuery(""); setWpResults([]); setWpOpen(false);
    setDestinationError(false);
  };

  const removeWaypoint = (i: number) => setWaypoints(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!id || waypoints.length === 0) {
      setDestinationError(true);
      toast.error("Aggiungi almeno una città all'itinerario");
      return;
    }
    if (isReturnBeforeDeparture(dateStart, dateEnd)) {
      toast.error("Il ritorno non può essere prima della partenza");
      return;
    }
    setSaving(true);
    try {
    const dest = waypoints[waypoints.length - 1];
    const settHome = s.homeCity;
    const distHome = settHome ?? home;
    // Sum all segments: home → waypoint1 → waypoint2 → ... → destination
    let dist: number | null = null;
    if (distHome) {
      const points: { lat: number; lon: number }[] = [
        { lat: distHome.lat, lon: distHome.lon },
        ...waypoints.slice(0, -1).filter(w => w.lat && w.lon).map(w => ({ lat: w.lat, lon: w.lon })),
        { lat: dest.lat, lon: dest.lon },
      ];
      dist = 0;
      for (let i = 1; i < points.length; i++) {
        dist += distanceKm(points[i-1].lat, points[i-1].lon, points[i].lat, points[i].lon);
      }
    }
    // Max distance from home reached at any point in the trip
    let maxDist: number | null = null;
    let maxDistCity: string | null = null;
    if (distHome) {
      const allStops = [
        ...waypoints.slice(0, -1).filter(w => w.lat && w.lon).map(w => ({ lat: w.lat, lon: w.lon, city: w.city })),
        { lat: dest.lat, lon: dest.lon, city: dest.city },
      ];
      const distances = allStops.map(p => ({ city: p.city, d: distanceKm(distHome.lat, distHome.lon, p.lat, p.lon) }));
      const max = distances.reduce((a, b) => b.d > a.d ? b : a);
      maxDist = max.d;
      maxDistCity = max.city;
    }
    // Fetch temperatures for all stops to find hottest/coldest
    const allStopsWithCoords = [
      ...waypoints.slice(0, -1).filter(w => w.lat && w.lon).map(w => ({ city: w.city, lat: w.lat, lon: w.lon })),
      { city: dest.city, lat: dest.lat, lon: dest.lon },
    ];
    // Percorso stradale reale per ogni tratta in auto (home→tappa1→...→destinazione),
    // invece della linea retta. Ricade su null (linea retta) se manca casa o la
    // chiamata fallisce.
    let prevPt: { lat: number; lon: number } | null = distHome ? { lat: distHome.lat, lon: distHome.lon } : null;
    const routePromises = waypoints.map((wp) => {
      const p = prevPt;
      prevPt = wp.lat && wp.lon ? { lat: wp.lat, lon: wp.lon } : prevPt;
      // Bici e moto seguono la strada reale esattamente come l'auto (stessa
      // richiesta esplicita: "stile di viaggio" uguale alla macchina).
      const followsRoad = wp.transport_mode === "car" || wp.transport_mode === "bici" || wp.transport_mode === "moto";
      if (followsRoad && p && wp.lat && wp.lon) {
        return fetchDrivingRoute(p.lat, p.lon, wp.lat, wp.lon);
      }
      return Promise.resolve(null);
    });
    const routeGeometriesPromise = Promise.all(routePromises);
    const [...rest] = await Promise.all([
      ...allStopsWithCoords.map(s => s.lat ? fetchTemperature(s.lat, s.lon, dateStart) : Promise.resolve(null)),
      ...allStopsWithCoords.map(s => s.lat ? fetchElevation(s.lat, s.lon) : Promise.resolve(null)),
    ]);
    const routeGeometries = await routeGeometriesPromise;
    const n = allStopsWithCoords.length;
    const stopTemps = rest.slice(0, n);
    const stopAlts = rest.slice(n, 2 * n);
    const alt = stopAlts[stopAlts.length - 1] ?? trip?.altitude_m ?? null; // altitudine della destinazione (per-trip badge)
    const temp = stopTemps[stopTemps.length - 1] ?? null;
    const tempsWithCity = allStopsWithCoords.map((s, i) => ({ city: s.city, temp: stopTemps[i] as number | null })).filter(x => x.temp != null);
    const hottestStop = tempsWithCity.length ? tempsWithCity.reduce((a, b) => (b.temp! > a.temp! ? b : a)) : null;
    const coldestStop = tempsWithCity.length ? tempsWithCity.reduce((a, b) => (b.temp! < a.temp! ? b : a)) : null;
    const altsWithCity = allStopsWithCoords.map((s, i) => ({ city: s.city, alt: stopAlts[i] as number | null })).filter(x => x.alt != null);
    const highestStop = altsWithCity.length ? altsWithCity.reduce((a, b) => (b.alt! > a.alt! ? b : a)) : null;
    // La regione non è mai mostrata all'utente in questa pagina: viene
    // ricalcolata ad ogni salvataggio, senza condizioni, così è sempre
    // aggiornata senza bisogno di un pulsante manuale.
    const fetchedRegion = await fetchMultiRegion(waypoints.map(w => ({ lat: w.lat, lon: w.lon })));
    const region = fetchedRegion.region;
    const regionDetails = fetchedRegion.details.length > 0 ? fetchedRegion.details : null;
    updateTrip(id!, {
      title: title.trim() || dest.city,
      country: dest.country, city: dest.city,
      trip_date: dateStart, date_end: dateEnd || null,
      notes: notes.trim() || null,
      transport_mode: dest.transport_mode,
      waypoints: waypoints.slice(0, -1).map((w, i) => ({ id: w.id, city: w.city, country: w.country, country_code: w.country_code, transport_mode: w.transport_mode, lat: w.lat, lon: w.lon, route_geometry: routeGeometries[i] ?? null })),
      latitude: dest.lat || trip?.latitude || 0,
      longitude: dest.lon || trip?.longitude || 0,
      route_geometry: routeGeometries[routeGeometries.length - 1] ?? null,
      home_latitude: home?.lat ?? null, home_longitude: home?.lon ?? null, home_label: home?.label ?? null,
      distance_from_home_km: dist, max_distance_from_home_km: maxDist, max_distance_city: maxDistCity, altitude_m: alt, max_altitude_m: highestStop?.alt ?? null, max_altitude_city: highestStop?.city ?? null, temperature_c: temp, hottest_temp_c: hottestStop?.temp ?? null, hottest_city: hottestStop?.city ?? null, coldest_temp_c: coldestStop?.temp ?? null, coldest_city: coldestStop?.city ?? null, region: region ?? null, region_details: regionDetails,
      country_code: dest.country_code || trip?.country_code || "",
      rating: rating || null,
    });
    toast.success("Viaggio aggiornato!");
    navigate("/");
    } finally {
      // try/finally invece di un setSaving(false) a fine funzione: se una
      // delle chiamate sopra dovesse lanciare per un motivo imprevisto (le
      // fetch verso le API esterne catturano già tutto internamente, ma
      // meglio non fidarsi ciecamente), il form non deve restare bloccato
      // per sempre sullo spinner.
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#060e1e", display:"flex", flexDirection:"column" }}>
      {/* Header */}
      <AppHeader/>

      {/* Main layout: itinerario hero sinistra, form destra (impilati su mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-stretch"
        style={{ maxWidth:1200, margin:"0 auto", width:"100%", padding:"32px 24px" }}>

        {/* LEFT — Itinerario hero */}
        <ItineraryPanel
          waypoints={waypoints} home={home}
          onEditHome={() => { setEditingHome(v => !v); setHomeQuery(home?.label ?? ""); }}
          editingHome={editingHome}
          homeQuery={homeQuery} setHomeQuery={setHomeQuery}
          homeResults={homeResults}
          onSelectHome={r => {
            setHome({ lat:r.latitude, lon:r.longitude, label:`${r.name}, ${r.country}` });
            setHomeQuery(`${r.name}, ${r.country}`);
            setHomeResults([]); setEditingHome(false);
          }}
          onRemoveWaypoint={removeWaypoint}
          wpTransport={wpTransport} setWpTransport={setWpTransport}
          wpOpen={wpOpen} setWpOpen={setWpOpen}
          wpQuery={wpQuery} setWpQuery={setWpQuery}
          wpResults={wpResults} wpLoading={wpLoading}
          onAddWaypoint={addWaypoint}
          destinationError={destinationError}
        />

        {/* RIGHT — Form compatto */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <TripFormFields
            title={title} setTitle={setTitle}
            dateStart={dateStart} setDateStart={setDateStart}
            dateEnd={dateEnd} setDateEnd={setDateEnd}
            notes={notes} setNotes={setNotes}
            rating={rating} setRating={setRating}
          />

          {/* Foto — una sezione per tappa (casa, ogni tappa intermedia,
              destinazione), non più un'unica galleria per l'intero viaggio. */}
          {id && <TripPhotosPerStop tripId={id} home={home} waypoints={waypoints}/>}

          <TripFormActions saving={saving} confirmDiscard={confirmDiscard} onSave={handleSave}/>
        </div>
      </div>
    </div>
  );
};

export default ModificaViaggio;
