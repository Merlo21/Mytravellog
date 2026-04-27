import { useState } from "react";
import { ComposableMap, Geographies, Geography, Marker, Line, ZoomableGroup } from "react-simple-maps";
import { LocalTrip } from "@/lib/storage";

// Public TopoJSON of world countries (~110m, lightweight, includes country names)
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface Props {
  trips: LocalTrip[];
  onSelectTrip?: (t: LocalTrip) => void;
  selectedId?: string | null;
}

export function WorldMap({ trips, onSelectTrip, selectedId }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  // Visited country names (lowercase, normalized)
  const visitedCountries = new Set(
    trips.map((t) => t.country.toLowerCase().trim())
  );

  const home = trips[0]
    ? ([trips[0].home_longitude, trips[0].home_latitude] as [number, number])
    : null;

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-[hsl(var(--ocean))] border border-border">
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 165 }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup center={[10, 20]} zoom={1} minZoom={0.8} maxZoom={6}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const name: string = geo.properties.name ?? "";
                const isVisited = visitedCountries.has(name.toLowerCase().trim());
                const isHovered = hovered === geo.rsmKey;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={() => setHovered(geo.rsmKey)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      default: {
                        fill: isVisited
                          ? "hsl(var(--primary) / 0.35)"
                          : "hsl(var(--land))",
                        stroke: "hsl(var(--border))",
                        strokeWidth: 0.4,
                        outline: "none",
                        transition: "fill 0.25s ease",
                      },
                      hover: {
                        fill: isVisited
                          ? "hsl(var(--primary) / 0.6)"
                          : "hsl(var(--muted))",
                        stroke: "hsl(var(--primary) / 0.6)",
                        strokeWidth: 0.6,
                        outline: "none",
                        cursor: "pointer",
                      },
                      pressed: { fill: "hsl(var(--primary) / 0.7)", outline: "none" },
                    }}
                  >
                    {isHovered && <title>{name}{isVisited ? " ✓" : ""}</title>}
                  </Geography>
                );
              })
            }
          </Geographies>

          {/* Arcs from home to each trip */}
          {home &&
            trips.map((t) => (
              <Line
                key={`line-${t.id}`}
                from={home}
                to={[t.longitude, t.latitude]}
                stroke="hsl(var(--primary))"
                strokeWidth={selectedId === t.id ? 1.4 : 0.5}
                strokeOpacity={selectedId === t.id ? 0.9 : 0.35}
                strokeLinecap="round"
                strokeDasharray="2 3"
              />
            ))}

          {/* Home marker */}
          {home && (
            <Marker coordinates={home}>
              <circle r={9} fill="hsl(var(--accent) / 0.25)" />
              <circle r={4} fill="hsl(var(--accent))" stroke="hsl(var(--background))" strokeWidth={1} />
            </Marker>
          )}

          {/* Trip markers */}
          {trips.map((t) => {
            const isSelected = selectedId === t.id;
            return (
              <Marker
                key={t.id}
                coordinates={[t.longitude, t.latitude]}
                onClick={() => onSelectTrip?.(t)}
                style={{
                  default: { cursor: "pointer" },
                  hover: { cursor: "pointer" },
                  pressed: { cursor: "pointer" },
                }}
              >
                <circle
                  r={isSelected ? 11 : 7}
                  fill="hsl(var(--primary) / 0.25)"
                  className="transition-all"
                />
                <circle
                  r={isSelected ? 4.5 : 3}
                  fill="hsl(var(--primary))"
                  stroke="hsl(var(--background))"
                  strokeWidth={0.8}
                >
                  <title>{t.city}, {t.country}</title>
                </circle>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 glass-card px-3 py-2 flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-primary/40 border border-primary/60" />
          Visitato
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-accent" />
          Casa
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-primary" />
          Viaggio
        </div>
      </div>
    </div>
  );
}
