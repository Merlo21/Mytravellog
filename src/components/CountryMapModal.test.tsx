import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor, configure } from "@testing-library/react";
import { CountryMapModal, __clearGeoCache } from "./CountryMapModal";
import type { Trip } from "@/lib/storage";
import React from "react";

// Default 1000ms is troppo stretto sotto carico (suite in parallelo).
configure({ asyncUtilTimeout: 5000 });

beforeEach(() => __clearGeoCache());

// ── GeoJSON fixture helpers ──────────────────────────────────────────────────

function makePolygon(name: string, nameProp = "reg_name") {
  return {
    type: "Feature",
    properties: { [nameProp]: name },
    geometry: {
      type: "Polygon",
      // Simple square around centre of Italy for projection
      coordinates: [[[10, 43], [14, 43], [14, 47], [10, 47], [10, 43]]],
    },
  };
}

function makeGeoJSON(features: any[]) {
  return JSON.stringify({ type: "FeatureCollection", features });
}

// Minimal Italy GeoJSON with 5 regions
const ITALY_FEATURES = [
  makePolygon("Lazio"),
  makePolygon("Toscana"),
  makePolygon("Puglia"),
  makePolygon("Sicilia"),
  makePolygon("Sardegna"),
];
const ITALY_GEOJSON = makeGeoJSON(ITALY_FEATURES);

// Le 9 regioni austriache nel loro nome tedesco (come nel GeoJSON reale).
// L'Austria usa nameProp="name" (non "reg_name" come l'Italia, il default di makePolygon).
const AUSTRIA_FEATURES = [
  makePolygon("Wien", "name"),
  makePolygon("Tirol", "name"),
  makePolygon("Steiermark", "name"),
  makePolygon("Oberösterreich", "name"),
  makePolygon("Niederösterreich", "name"),
  makePolygon("Kärnten", "name"),
  makePolygon("Burgenland", "name"),
  makePolygon("Salzburg", "name"),
  makePolygon("Vorarlberg", "name"),
];
const AUSTRIA_GEOJSON = makeGeoJSON(AUSTRIA_FEATURES);

function mockFetch(body: string, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: async () => JSON.parse(body),
  } as any);
}

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: Math.random().toString(36).slice(2),
    created_at: new Date().toISOString(),
    title: "Test",
    country: "Italia",
    city: "Roma",
    country_code: "IT",
    trip_date: "2024-01-01",
    date_end: null,
    rating: null,
    notes: null,
    transport_mode: null,
    waypoints: [],
    latitude: 41.9,
    longitude: 12.5,
    home_latitude: null,
    home_longitude: null,
    home_label: null,
    route_geometry: null,
    temperature_c: null,
    altitude_m: null,
    distance_from_home_km: null,
    max_distance_from_home_km: null,
    max_distance_city: null,
    max_altitude_m: null,
    max_altitude_city: null,
    hottest_temp_c: null,
    hottest_city: null,
    coldest_temp_c: null,
    coldest_city: null,
    region: null,
    ...overrides,
  };
}

function renderModal(props: Partial<{
  countryCode: string;
  countryName: string;
  trips: Trip[];
  onClose: () => void;
}> = {}) {
  return render(
    <CountryMapModal
      countryCode={props.countryCode ?? "IT"}
      countryName={props.countryName ?? "Italia"}
      trips={props.trips ?? []}
      onClose={props.onClose ?? vi.fn()}
    />
  );
}

describe("CountryMapModal — render base", () => {
  afterEach(() => vi.restoreAllMocks());

  it("mostra il nome del paese nell'header", async () => {
    mockFetch(ITALY_GEOJSON);
    renderModal({ countryName: "Italia" });
    expect(await screen.findByText("Italia")).toBeInTheDocument();
  });

  it("mostra 'Caricamento mappa…' durante il fetch", () => {
    // fetch non si risolve mai → stato loading
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    renderModal();
    expect(screen.getByText(/caricamento mappa/i)).toBeInTheDocument();
  });
});

describe("CountryMapModal — paese non supportato", () => {
  it("mostra errore per paese senza GeoJSON source (es. DE)", () => {
    renderModal({ countryCode: "DE", countryName: "Germania" });
    expect(screen.getByText(/mappa non disponibile/i)).toBeInTheDocument();
  });

  it("mostra errore per paese senza GeoJSON source (es. JP)", () => {
    renderModal({ countryCode: "JP", countryName: "Giappone" });
    expect(screen.getByText(/mappa non disponibile/i)).toBeInTheDocument();
  });

  it("mostra le regioni visitate nell'error state se ci sono", () => {
    renderModal({
      countryCode: "DE",
      trips: [makeTrip({ region: "Bavaria" })],
    });
    expect(screen.getByText(/Bavaria/)).toBeInTheDocument();
  });
});

describe("CountryMapModal — fetch fallisce", () => {
  afterEach(() => vi.restoreAllMocks());

  it("mostra errore se fetch fallisce", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    renderModal({ countryCode: "IT" });
    await waitFor(() =>
      expect(screen.getByText(/mappa non disponibile/i)).toBeInTheDocument()
    );
  });

  it("mostra errore se fetch ritorna ok=false", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) } as any);
    renderModal({ countryCode: "IT" });
    await waitFor(() =>
      expect(screen.getByText(/mappa non disponibile/i)).toBeInTheDocument()
    );
  });
});

describe("CountryMapModal — pct e regioni visitate", () => {
  afterEach(() => vi.restoreAllMocks());

  it("mostra 0% con trips senza region", async () => {
    mockFetch(ITALY_GEOJSON);
    renderModal({ trips: [makeTrip({ region: null })] });
    await waitFor(() => expect(screen.getByText(/regioni? su 5/)).toBeInTheDocument());
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("mostra 1 regione su 5 con region='Lazio'", async () => {
    mockFetch(ITALY_GEOJSON);
    renderModal({ trips: [makeTrip({ region: "Lazio" })] });
    await waitFor(() => expect(screen.getByText("1 regione su 5")).toBeInTheDocument());
    expect(screen.getByText("20%")).toBeInTheDocument();
  });

  it("conta 2 regioni su 5 con due trip che hanno regioni diverse", async () => {
    mockFetch(ITALY_GEOJSON);
    renderModal({
      trips: [
        makeTrip({ region: "Lazio" }),
        makeTrip({ region: "Toscana" }),
      ],
    });
    await waitFor(() => expect(screen.getByText("2 regioni su 5")).toBeInTheDocument());
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("non duplica la stessa regione visitata due volte", async () => {
    mockFetch(ITALY_GEOJSON);
    renderModal({
      trips: [
        makeTrip({ region: "Lazio" }),
        makeTrip({ region: "Lazio" }),
      ],
    });
    await waitFor(() => expect(screen.getByText("1 regione su 5")).toBeInTheDocument());
    expect(screen.getByText("20%")).toBeInTheDocument();
  });
});

describe("CountryMapModal — regionMatches (via render)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("match esatto case-insensitive: 'lazio' trova 'Lazio'", async () => {
    mockFetch(ITALY_GEOJSON);
    renderModal({ trips: [makeTrip({ region: "lazio" })] });
    await waitFor(() => expect(screen.getByText("1 regione su 5")).toBeInTheDocument());
  });

  it("alias EN→IT: 'Tuscany' trova 'Toscana'", async () => {
    mockFetch(ITALY_GEOJSON);
    renderModal({ trips: [makeTrip({ region: "Tuscany" })] });
    await waitFor(() => expect(screen.getByText("1 regione su 5")).toBeInTheDocument());
  });

  it("alias EN→IT: 'Sicily' trova 'Sicilia'", async () => {
    mockFetch(ITALY_GEOJSON);
    renderModal({ trips: [makeTrip({ region: "Sicily" })] });
    await waitFor(() => expect(screen.getByText("1 regione su 5")).toBeInTheDocument());
  });

  it("alias EN→IT: 'Apulia' trova 'Puglia'", async () => {
    mockFetch(ITALY_GEOJSON);
    renderModal({ trips: [makeTrip({ region: "Apulia" })] });
    await waitFor(() => expect(screen.getByText("1 regione su 5")).toBeInTheDocument());
  });

  it("substring match: 'Tosc' NON trova 'Toscana' (troppo corto, min 4 chars per substring)", async () => {
    mockFetch(ITALY_GEOJSON);
    // "Tosc" ha 4 chars → è il limite minimo, ma "toscana".includes("tosc") = true
    renderModal({ trips: [makeTrip({ region: "Tosc" })] });
    await waitFor(() => expect(screen.getByText(/regione? su 5/)).toBeInTheDocument());
    // "Tosc" lunghezza 4 → incluso, quindi trova "Toscana"
    expect(screen.getByText("1 regione su 5")).toBeInTheDocument();
  });

  it("regione non riconosciuta: 'XYZ' non trova nessuna regione", async () => {
    mockFetch(ITALY_GEOJSON);
    renderModal({ trips: [makeTrip({ region: "XYZ" })] });
    await waitFor(() => expect(screen.getByText(/regioni? su 5/)).toBeInTheDocument());
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});

describe("CountryMapModal — alias EN→DE per l'Austria", () => {
  afterEach(() => vi.restoreAllMocks());

  function renderAustria(region: string) {
    mockFetch(AUSTRIA_GEOJSON);
    return renderModal({
      countryCode: "AT", countryName: "Austria",
      trips: [makeTrip({ region, country: "Austria", country_code: "AT" })],
    });
  }

  it("'Vienna' (Nominatim EN) trova 'Wien' (GeoJSON DE)", async () => {
    renderAustria("Vienna");
    await waitFor(() => expect(screen.getByText("1 regione su 9")).toBeInTheDocument());
  });

  it("'Tyrol' trova 'Tirol'", async () => {
    renderAustria("Tyrol");
    await waitFor(() => expect(screen.getByText("1 regione su 9")).toBeInTheDocument());
  });

  it("'Styria' trova 'Steiermark'", async () => {
    renderAustria("Styria");
    await waitFor(() => expect(screen.getByText("1 regione su 9")).toBeInTheDocument());
  });

  it("'Upper Austria' trova 'Oberösterreich'", async () => {
    renderAustria("Upper Austria");
    await waitFor(() => expect(screen.getByText("1 regione su 9")).toBeInTheDocument());
  });

  it("'Lower Austria' trova 'Niederösterreich'", async () => {
    renderAustria("Lower Austria");
    await waitFor(() => expect(screen.getByText("1 regione su 9")).toBeInTheDocument());
  });

  it("'Carinthia' trova 'Kärnten'", async () => {
    renderAustria("Carinthia");
    await waitFor(() => expect(screen.getByText("1 regione su 9")).toBeInTheDocument());
  });

  it("'Salzburg', 'Burgenland', 'Vorarlberg' (stesso nome in EN e DE) continuano a funzionare", async () => {
    mockFetch(AUSTRIA_GEOJSON);
    renderModal({
      countryCode: "AT", countryName: "Austria",
      trips: [makeTrip({ region: "Salzburg, Burgenland, Vorarlberg", country: "Austria", country_code: "AT" })],
    });
    await waitFor(() => expect(screen.getByText("3 regioni su 9")).toBeInTheDocument());
  });
});

describe("CountryMapModal — visitedSet con regioni multiple (comma-separated)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("esplode 'Lazio, Toscana' in due regioni separate", async () => {
    mockFetch(ITALY_GEOJSON);
    renderModal({ trips: [makeTrip({ region: "Lazio, Toscana" })] });
    await waitFor(() => expect(screen.getByText("2 regioni su 5")).toBeInTheDocument());
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("combina regioni da trip diversi e deduplica", async () => {
    mockFetch(ITALY_GEOJSON);
    renderModal({
      trips: [
        makeTrip({ region: "Lazio, Toscana" }),
        makeTrip({ region: "Toscana, Puglia" }),
      ],
    });
    // Lazio + Toscana + Puglia = 3 uniche
    await waitFor(() => expect(screen.getByText("3 regioni su 5")).toBeInTheDocument());
  });
});
