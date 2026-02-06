import maplibregl, { Map, Popup, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import * as turf from "@turf/turf";

type FC = GeoJSON.FeatureCollection<GeoJSON.Geometry>;

// ... (previous constants)
const PARISH_SRC_ID = "parroquias";
const PARISH_FILL_ID = "parroquias-fill";
const PARISH_LINE_ID = "parroquias-line";

const MARKERS_SRC_ID = "markers";
const MARKERS_LAYER_ID = "markers-layer";

const SIGNALS_SRC_ID = "signals-sector";
const SIGNALS_LAYER_ID = "signals-sector-fill";

interface Signal {
  id: string;
  type: "pulse" | "sector";
  lngLat: [number, number];
  azimuth?: number; // 0-360
  beamwidth?: number; // degrees
  radius?: number; // km
  markerRef?: Marker; // For cleaning up DOM markers
}

function loadMarkers(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  try {
    const raw = localStorage.getItem("markers_fc");
    if (!raw) return { type: "FeatureCollection", features: [] };
    return JSON.parse(raw);
  } catch {
    return { type: "FeatureCollection", features: [] };
  }
}

function saveMarkers(fc: GeoJSON.FeatureCollection<GeoJSON.Point>) {
  localStorage.setItem("markers_fc", JSON.stringify(fc));
}

export default function Page() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const popupRef = useRef<Popup | null>(null);

  const [selectedParish, setSelectedParish] = useState<{ id?: string; name?: string; name_full?: string } | null>(null);
  const [markers, setMarkers] = useState<GeoJSON.FeatureCollection<GeoJSON.Point>>({ type: "FeatureCollection", features: [] });

  // Advanced Signals State
  const [activeTool, setActiveTool] = useState<"none" | "pulse" | "sector">("none");
  const [signals, setSignals] = useState<Signal[]>([]);

  // Animation Refs
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const saved = loadMarkers();
    setMarkers(saved);

    // Fetch key from runtime API
    fetch("/api/key")
      .then((res) => res.json())
      .then((data) => {
        if (!data.key) {
          alert(data.error || "Falta API Key");
          return;
        }

        const map = new maplibregl.Map({
          container: containerRef.current!,
          style: `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${data.key}`,
          center: [-71.1505, 8.582],
          zoom: 12.6,
        });

        mapRef.current = map;
        popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false });

        map.addControl(new maplibregl.NavigationControl(), "top-right");

        let hoveredId: string | number | null = null;

        map.on("load", async () => {
          // --- Parroquias ---
          const res = await fetch("/data/parroquias_libertador_14.geojson");
          const parroquias = (await res.json()) as FC;

          map.addSource(PARISH_SRC_ID, { type: "geojson", data: parroquias, promoteId: "id" } as any);
          map.addLayer({
            id: PARISH_FILL_ID,
            type: "fill",
            source: PARISH_SRC_ID,
            paint: {
              "fill-color": "#ffffff",
              "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.18, 0.08],
            },
          });
          map.addLayer({
            id: PARISH_LINE_ID,
            type: "line",
            source: PARISH_SRC_ID,
            paint: {
              "line-color": "#ffffff",
              "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.95, 0.6],
              "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 3, 2],
            },
          });

          // --- Markers Source ---
          map.addSource(MARKERS_SRC_ID, { type: "geojson", data: saved });
          map.addLayer({
            id: MARKERS_LAYER_ID,
            type: "circle",
            source: MARKERS_SRC_ID,
            paint: {
              "circle-radius": 6,
              "circle-color": "#00e5ff",
              "circle-opacity": 0.9,
              "circle-stroke-color": "#001018",
              "circle-stroke-width": 2,
            },
          });

          // --- Signals Sector Source (Dynamic Polygon) ---
          map.addSource(SIGNALS_SRC_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({
            id: SIGNALS_LAYER_ID,
            type: "fill",
            source: SIGNALS_SRC_ID,
            paint: {
              "fill-color": "#00ff88",
              "fill-opacity": 0.4, // We will animate this later if needed
              "fill-outline-color": "#00ff88",
            },
          });

          // --- Interaction ---

          // Hover Parroquia
          map.on("mousemove", PARISH_FILL_ID, (e) => {
            map.getCanvas().style.cursor = "pointer";
            const f = e.features?.[0];
            if (!f) return;
            const id = (f.properties as any)?.id ?? f.id;
            if (id == null) return;

            if (hoveredId !== null && hoveredId !== id) {
              map.setFeatureState({ source: PARISH_SRC_ID, id: hoveredId }, { hover: false });
            }
            hoveredId = id;
            map.setFeatureState({ source: PARISH_SRC_ID, id }, { hover: true });

            const name = (f.properties as any)?.name_full ?? (f.properties as any)?.name ?? "Parroquia";
            popupRef.current!.setLngLat(e.lngLat).setHTML(`<div style="font-family:system-ui;font-size:12px">${name}</div>`).addTo(map);
          });

          map.on("mouseleave", PARISH_FILL_ID, () => {
            map.getCanvas().style.cursor = "";
            popupRef.current?.remove();
            if (hoveredId !== null) map.setFeatureState({ source: PARISH_SRC_ID, id: hoveredId }, { hover: false });
            hoveredId = null;
          });

          map.on("click", PARISH_FILL_ID, (e) => {
            const f = e.features?.[0];
            if (!f) return;
            setSelectedParish({
              id: (f.properties as any)?.id ?? (f.id as any),
              name: (f.properties as any)?.name ?? "",
              name_full: (f.properties as any)?.name_full ?? (f.properties as any)?.name ?? "",
            });
          });

          // Global Map Click Handler
          map.on("click", (e) => {
            const { lng, lat } = e.lngLat;
            // Access current tool from ref or state wrapper? 
            // Since we are inside closure, better to stick to a mutable ref or check state in a safe way.
            // But here activeTool is state. State in closure is stale. 
            // Quick fix: we need to use a Ref or just rely on 'page' component re-render 
            // but MapLibre listeners are bound once. 
            // We'll dispatch a custom event or check a Ref. 
          });
        });

      })
      .catch((err) => console.error("Error loading:", err));

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // Only run once

  // We need a separate effect to handle tool interaction because of the Closure Trap in map.on('click')
  // Or we just add/remove listener when tool changes. 
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (activeTool === "none") return;

      const { lng, lat } = e.lngLat;
      const id = `s_${Date.now()}`;

      if (activeTool === "pulse") {
        // Create Pulse DOM Marker
        const el = document.createElement('div');
        el.className = 'pulse-marker';

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map);

        setSignals((prev: Signal[]) => [...prev, { id, type: "pulse", lngLat: [lng, lat], markerRef: marker }]);
        setActiveTool("none"); // Reset tool
      }
      else if (activeTool === "sector") {
        // Create Sector Geometry (Default: North 0, 60deg width, 2km radius)
        const center = [lng, lat];
        const radius = 2; // km
        const bearing1 = -30; // 0 is North. -30 to 30 = 60 deg sector centered on North
        const bearing2 = 30;

        const sectorPoly = turf.sector(center, radius, bearing1, bearing2);

        // Add to Signals State
        const newSignal: Signal = {
          id, type: "sector", lngLat: [lng, lat] as [number, number],
          radius, azimuth: 0, beamwidth: 60
        };

        setSignals((prev: Signal[]) => {
          const next = [...prev, newSignal];
          updateSectorSource(map, next);
          return next;
        });
        setActiveTool("none");
      }
    };

    map.on("click", onClick);
    return () => { map.off("click", onClick); };
  }, [activeTool]); // Re-bind when tool changes

  // Update Sector Source Helper
  function updateSectorSource(map: Map, signalsList: Signal[]) {
    const sectors = signalsList
      .filter(s => s.type === "sector")
      .map(s => {
        // Re-calculate geometry
        const center = s.lngLat;
        const r = s.radius || 2;
        const az = s.azimuth || 0;
        const bw = s.beamwidth || 60;
        const b1 = az - (bw / 2);
        const b2 = az + (bw / 2);
        return turf.sector(center, r, b1, b2, { properties: { id: s.id } });
      });

    const src = map.getSource(SIGNALS_SRC_ID) as maplibregl.GeoJSONSource;
    if (src) {
      src.setData({ type: "FeatureCollection", features: sectors });
    }
  }

  // Animation Loop for "Breathing" Sectors
  useEffect(() => {
    let start: number;
    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = (timestamp - start) % 2000; // 2s cycle
      // Opacity 0.2 to 0.6
      const opacity = 0.2 + 0.4 * Math.sin((progress / 2000) * Math.PI);

      if (mapRef.current && mapRef.current.getLayer(SIGNALS_LAYER_ID)) {
        mapRef.current.setPaintProperty(SIGNALS_LAYER_ID, 'fill-opacity', opacity);
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameRef.current!);
  }, []);

  function clearMarkers() {
    // Logic from before... plus clear signals
    setMarkers({ type: "FeatureCollection", features: [] });
    saveMarkers({ type: "FeatureCollection", features: [] });
    mapRef.current?.getSource(MARKERS_SRC_ID)?.setData({ type: "FeatureCollection", features: [] });

    // Clear signals
    signals.forEach(s => s.markerRef?.remove());
    setSignals([]);
    mapRef.current?.getSource(SIGNALS_SRC_ID)?.setData({ type: "FeatureCollection", features: [] });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", height: "100vh" }}>
      <aside style={{ padding: 14, borderRight: "1px solid rgba(255,255,255,0.08)" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Libertador / Mérida</h2>
        <p style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
          Sistema de Gestión de Redes
        </p>

        {/* Tools */}
        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <button
            onClick={() => setActiveTool(activeTool === 'pulse' ? 'none' : 'pulse')}
            style={{ background: activeTool === 'pulse' ? '#00e5ff' : undefined, color: activeTool === 'pulse' ? '#000' : undefined }}
          >
            Add Pulse
          </button>
          <button
            onClick={() => setActiveTool(activeTool === 'sector' ? 'none' : 'sector')}
            style={{ background: activeTool === 'sector' ? '#00ff88' : undefined, color: activeTool === 'sector' ? '#000' : undefined }}
          >
            Add Sector
          </button>
        </div>
        <div style={{ fontSize: 12, marginTop: 5, opacity: 0.7 }}>
          {activeTool !== 'none' ? `Click en el mapa para agregar ${activeTool}...` : "Selecciona una herramienta"}
        </div>

        <div style={{ marginTop: 12, padding: 10, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 }}>
          <div style={{ fontSize: 13, opacity: 0.8 }}>Resumen</div>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            Pulsos: {signals.filter((s: Signal) => s.type === 'pulse').length}<br />
            Sectores: {signals.filter((s: Signal) => s.type === 'sector').length}
          </div>
          <button onClick={clearMarkers} style={{ marginTop: 10, width: '100%', borderColor: '#ff4444', color: '#ff4444' }}>
            Limpiar Todo
          </button>
        </div>

      </aside>

      <main ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
