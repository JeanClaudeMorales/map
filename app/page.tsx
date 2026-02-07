"use client";

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
  color?: string; // hex
  markerRef?: Marker; // Legacy/Cleanup
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

  // Configuration State
  const [config, setConfig] = useState({
    radius: 500, // meters
    angle: 360, // degrees
    color: "#00e5ff", // hex
  });

  // Animation Refs
  const animationFrameRef = useRef<number | undefined>(undefined);

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
          try {
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
          } catch (e) {
            console.error("Failed to load parroquias", e);
          }

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
              "fill-color": ["get", "color"], // Data driven color
              "fill-opacity": 0.4,
              "fill-outline-color": ["get", "color"],
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
        });

      })
      .catch((err) => console.error("Error loading:", err));

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // Only run once

  // Update logic to use current config state
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (activeTool === "none") return;

      const { lng, lat } = e.lngLat;
      const id = `s_${Date.now()}`;

      // Config radius is in meters, Turf wants km for standard length-aware functions 
      // but turf.sector 'radius' param unit defaults to kilometers.
      const radiusKm = config.radius / 1000;

      // Determine beamwidth
      // Pulse Tool: uses configured angle (User wants angle configurable 360 default)
      // Sector Tool: also uses configured angle
      // We will trust the knob.
      const beamwidth = config.angle;

      const newSignal: Signal = {
        id,
        type: activeTool,
        lngLat: [lng, lat],
        radius: radiusKm,
        azimuth: 0, // Default North, could be configurable later
        beamwidth: beamwidth,
        color: config.color
      };

      setSignals((prev: Signal[]) => {
        const next = [...prev, newSignal];
        updateSignalsSource(map, next);
        return next;
      });

      setActiveTool("none");
    };

    map.on("click", onClick);
    return () => { map.off("click", onClick); };
  }, [activeTool, config]); // Re-bind when tool or config changes

  // Update Signals Source
  function updateSignalsSource(map: Map, signalsList: Signal[]) {
    const sectors = signalsList.map(s => {
      const center = s.lngLat;
      const r = s.radius || 0.5;
      const az = s.azimuth || 0;
      // Sector needs start/end bearing
      const bw = s.beamwidth || 360;

      // Calculate bearings centered on azimuth (0 = North)
      // turf.sector bearings are decimal degrees.
      // MapLibre bearing 0 is North. 
      // turf.sector uses -180 to 180 (North is 0).

      const b1 = az - (bw / 2);
      const b2 = az + (bw / 2);

      return turf.sector(center, r, b1, b2, {
        properties: {
          id: s.id,
          color: s.color ?? '#00ff88'
        }
      });
    });

    const src = map.getSource(SIGNALS_SRC_ID) as maplibregl.GeoJSONSource;
    if (src) {
      src.setData({ type: "FeatureCollection", features: sectors });
    }
  }

  // Animation Loop for "Breathing"
  useEffect(() => {
    let start: number;
    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = (timestamp - start) % 2000;
      // Simple sine breathing
      const val = (Math.sin((Date.now() / 2000) * Math.PI * 2) + 1) / 2; // 0 to 1
      const dynamicOpacity = 0.2 + (0.4 * val); // 0.2 to 0.6

      if (mapRef.current && mapRef.current.getLayer(SIGNALS_LAYER_ID)) {
        mapRef.current.setPaintProperty(SIGNALS_LAYER_ID, 'fill-opacity', dynamicOpacity);
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameRef.current!);
  }, []);

  function clearMarkers() {
    setMarkers({ type: "FeatureCollection", features: [] });
    saveMarkers({ type: "FeatureCollection", features: [] });
    (mapRef.current?.getSource(MARKERS_SRC_ID) as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: [] });

    setSignals([]);
    (mapRef.current?.getSource(SIGNALS_SRC_ID) as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: [] });
  }

  // Helper to handle tool selection
  const toggleTool = (tool: "pulse" | "sector") => {
    if (activeTool === tool) setActiveTool("none");
    else {
      setActiveTool(tool);
      // Auto-presets
      if (tool === 'pulse') setConfig(c => ({ ...c, angle: 360 }));
      if (tool === 'sector') setConfig(c => ({ ...c, angle: 60 }));
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", height: "100vh" }}>
      <aside style={{ padding: 14, borderRight: "1px solid rgba(255,255,255,0.08)", overflowY: "auto", background: "#050b12" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Libertador / Mérida</h2>
        <p style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
          Sistema de Gestión de Redes
        </p>

        {/* Configuration Panel */}
        <div style={{ marginTop: 20, padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Configuración de Señal</div>

          {/* Radius */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ fontSize: 13 }}>Radio</label>
              <span style={{ fontSize: 13, opacity: 0.7 }}>{config.radius} m</span>
            </div>
            <input
              type="range" min="100" max="5000" step="50"
              value={config.radius}
              onChange={(e) => setConfig({ ...config, radius: Number(e.target.value) })}
              style={{ width: "100%", cursor: "pointer" }}
            />
          </div>

          {/* Angle */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ fontSize: 13 }}>Apertura</label>
              <span style={{ fontSize: 13, opacity: 0.7 }}>{config.angle}°</span>
            </div>
            <input
              type="range" min="10" max="360" step="10"
              value={config.angle}
              onChange={(e) => setConfig({ ...config, angle: Number(e.target.value) })}
              style={{ width: "100%", cursor: "pointer" }}
            />
          </div>

          {/* Color */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontSize: 13 }}>Color</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, opacity: 0.5 }}>{config.color}</span>
              <input
                type="color"
                value={config.color}
                onChange={(e) => setConfig({ ...config, color: e.target.value })}
                style={{
                  border: "none", width: 24, height: 24, padding: 0,
                  background: "none", cursor: "pointer", borderRadius: 4, overflow: "hidden"
                }}
              />
            </div>
          </div>
        </div>

        {/* Tools */}
        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <button
            onClick={() => toggleTool('pulse')}
            style={{
              flex: 1,
              background: activeTool === 'pulse' ? config.color : undefined,
              color: activeTool === 'pulse' ? '#000' : undefined,
              borderColor: activeTool === 'pulse' ? config.color : undefined,
              transition: "all 0.2s"
            }}
          >
            {activeTool === 'pulse' ? '• Colocando...' : 'Pulso / Omni'}
          </button>

          <button
            onClick={() => toggleTool('sector')}
            style={{
              flex: 1,
              background: activeTool === 'sector' ? config.color : undefined,
              color: activeTool === 'sector' ? '#000' : undefined,
              borderColor: activeTool === 'sector' ? config.color : undefined,
              transition: "all 0.2s"
            }}
          >
            {activeTool === 'sector' ? '• Colocando...' : 'Sector'}
          </button>
        </div>

        <div style={{ fontSize: 12, marginTop: 10, opacity: 0.6, textAlign: "center" }}>
          {activeTool !== 'none'
            ? "Haz click en el mapa para agregar la señal"
            : "Selecciona una herramienta para comenzar"}
        </div>

        <div style={{ marginTop: 24, padding: 12, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 }}>
          <div style={{ fontSize: 13, opacity: 0.8, fontWeight: 500 }}>Resumen de Red</div>
          <div style={{ marginTop: 8, fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Pulsos (Omni):</span>
              <span>{signals.filter(s => s.type === 'pulse').length}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Sectores:</span>
              <span>{signals.filter(s => s.type === 'sector').length}</span>
            </div>
          </div>
          <button onClick={clearMarkers} style={{ marginTop: 14, width: '100%', borderColor: '#ff4444', color: '#ff4444', opacity: 0.8 }}>
            Limpiar Todo
          </button>
        </div>

      </aside>

      <main ref={containerRef} style={{ width: "100%", height: "100%", background: "#0e0e0e" }} />
    </div>
  );
}
