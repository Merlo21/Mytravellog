import { useEffect, useRef } from "react";
import { X, Plus } from "lucide-react";

interface CityInfo {
  name: string;
  country: string;
  country_code: string;
  latitude: number;
  longitude: number;
}

interface Props {
  city: CityInfo;
  onClose: () => void;
  onAddTrip: (city: CityInfo) => void;
}

const flag = (c: string) =>
  c.length === 2
    ? String.fromCodePoint(...c.toUpperCase().split("").map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
    : "🌍";

export function CityMapPopup({ city, onClose, onAddTrip }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dynamically load Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Dynamically load Leaflet JS then init map
    const initMap = () => {
      const L = (window as any).L;
      if (!L || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [city.latitude, city.longitude],
        zoom: 13,
        zoomControl: true,
        attributionControl: true,
      });

      // Base: Esri World Imagery (satellite)
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "© Esri © OpenStreetMap contributors", maxZoom: 19 }
      ).addTo(map);

      // Overlay: Esri Reference Labels — roads, cities, POIs, neighborhoods at all zoom levels
      // This is the same overlay Google Maps Hybrid uses
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { attribution: "", maxZoom: 19, opacity: 1 }
      ).addTo(map);

      // Extra detail at high zoom: road names overlay
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
        { attribution: "", maxZoom: 19, opacity: 0.8 }
      ).addTo(map);

      // City marker
      const marker = L.circleMarker([city.latitude, city.longitude], {
        radius: 8,
        fillColor: "#22d3ee",
        color: "#fff",
        weight: 2,
        fillOpacity: 1,
      }).addTo(map);
      marker.bindPopup(`<b>${city.name}</b><br>${city.country}`).openPopup();

      mapInstanceRef.current = map;
    };

    if ((window as any).L) {
      initMap();
    } else if (!document.getElementById("leaflet-js")) {
      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = initMap;
      document.head.appendChild(script);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [city.latitude, city.longitude]);

  // Invalidate map size after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <div className="text-2xl">{flag(city.country_code)}</div>
          <div className="flex-1">
            <h2 className="font-bold text-base leading-none">{city.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{city.country}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Map */}
        <div ref={mapRef} style={{ height: 320, width: "100%", background: "#0a1628" }} />

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {city.latitude.toFixed(4)}°, {city.longitude.toFixed(4)}°
          </p>
          <button
            onClick={() => { onAddTrip(city); onClose(); }}
            className="btn-primary flex items-center gap-2 text-sm py-2 px-4"
          >
            <Plus className="w-4 h-4" />
            Aggiungi come viaggio
          </button>
        </div>
      </div>
    </div>
  );
}
