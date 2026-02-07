"use client";

import maplibregl, { Map, Popup, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import * as turf from "@turf/turf";

type FC = GeoJSON.FeatureCollection<GeoJSON.Geometry>;

// --- Constants ---
const PARISH_SRC_ID = "parroquias";
const PARISH_FILL_ID = "parroquias-fill";
const PARISH_LINE_ID = "parroquias-line";
const PARISH_LABEL_ID = "parroquias-label";

const SIGNALS_SRC_ID = "signals-sector";
const SIGNALS_LAYER_ID = "signals-sector-fill";
const SIGNALS_CENTER_ID = "signals-center";
const SIGNALS_WAVE_ID = "signals-wave";
const SIGNALS_WAVE_SRC_ID = "signals-wave-src";

interface Signal {
  id: string;
  type: "pulse" | "sector";
  lngLat: [number, number];
  azimuth?: number; // 0-360
  beamwidth?: number; // degrees
  radius?: number; // km
  color?: string; // hex
}

interface ParishStyles {
  visible: boolean;
  opacity: number;
  color: string;
  onlyOutline: boolean;
}

function loadMarkers(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  if (typeof window === "undefined") return { type: "FeatureCollection", features: [] };
  try {
    const raw = localStorage.getItem("markers_fc");
    return raw ? JSON.parse(raw) : { type: "FeatureCollection", features: [] };
  } catch { return { type: "FeatureCollection", features: [] }; }
}

export default function Page() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const popupRef = useRef<Popup | null>(null);

  // Selection State
  const [selectedElement, setSelectedElement] = useState<{ id: string; type: "signal" | "parish" } | null>(null);

  // Advanced Signals State
  const [activeTool, setActiveTool] = useState<"none" | "pulse" | "sector">("none");
  const [signals, setSignals] = useState<Signal[]>([]);

  // Configuration State (Defaults for new elements)
  const [config, setConfig] = useState({
    radius: 500, // meters
    angle: 360, // degrees
    azimuth: 0,
    color: "#00e5ff",
  });

  // Parish Global Styles
  const [globalParishStyles, setGlobalParishStyles] = useState<ParishStyles>({
    visible: true,
    opacity: 0.15,
    color: "#ffffff",
    onlyOutline: false,
  });

  // Individual Parish Overrides
  const [parishOverrides, setParishOverrides] = useState<Record<string, Partial<ParishStyles>>>({});

  // Animation Refs
  const animationFrameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    fetch("/api/key")
      .then((res) => res.json())
      .then((data) => {
        if (!data.key) return;

        const map = new maplibregl.Map({
          container: containerRef.current!,
          style: `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${data.key}`,
          center: [-71.1505, 8.582],
          zoom: 12.6,
        });

        mapRef.current = map;
        popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
        map.addControl(new maplibregl.NavigationControl(), "top-right");

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
              "fill-color": ["coalesce", ["get", "color"], "#ffffff"],
              "fill-opacity": ["coalesce", ["get", "opacity"], 0.15],
            },
          });

          map.addLayer({
            id: PARISH_LINE_ID,
            type: "line",
            source: PARISH_SRC_ID,
            paint: {
              "line-color": "#ffffff",
              "line-opacity": 0.8,
              "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, 1],
            },
          });

          // Labels
          map.addLayer({
            id: PARISH_LABEL_ID,
            type: "symbol",
            source: PARISH_SRC_ID,
            layout: {
              "text-field": ["get", "name_full"],
              "text-font": ["Noto Sans Bold"],
              "text-size": 11,
              "text-variable-anchor": ["top", "bottom", "left", "right"],
              "text-radial-offset": 0.5,
              "text-justify": "auto",
            },
            paint: {
              "text-color": "#ffffff",
              "text-halo-color": "rgba(0,0,0,0.8)",
              "text-halo-width": 1,
            }
          });

          // --- Signals ---
          map.addSource(SIGNALS_SRC_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });

          map.addLayer({
            id: SIGNALS_LAYER_ID,
            type: "fill",
            source: SIGNALS_SRC_ID,
            filter: ["==", "$type", "Polygon"],
            paint: {
              "fill-color": ["get", "color"],
              "fill-opacity": 0.3,
            },
          });

          map.addLayer({
            id: SIGNALS_CENTER_ID,
            type: "circle",
            source: SIGNALS_SRC_ID,
            filter: ["==", "$type", "Point"],
            paint: {
              "circle-radius": ["case", ["==", ["get", "selected"], true], 7, 4],
              "circle-color": ["get", "color"],
              "circle-stroke-color": ["case", ["==", ["get", "selected"], true], "#fff", "#000"],
              "circle-stroke-width": 2,
            },
          });

          map.addSource(SIGNALS_WAVE_SRC_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({
            id: SIGNALS_WAVE_ID,
            type: "fill",
            source: SIGNALS_WAVE_SRC_ID,
            paint: { "fill-color": ["get", "color"], "fill-opacity": 0.2 },
          });

          // Selection Handlers
          map.on("click", (e) => {
            const features = map.queryRenderedFeatures(e.point, { layers: [SIGNALS_CENTER_ID, PARISH_FILL_ID] });

            if (features.length === 0) {
              if (activeTool === "none") setSelectedElement(null);
              return;
            }

            const signal = features.find(f => f.layer.id === SIGNALS_CENTER_ID);
            const parish = features.find(f => f.layer.id === PARISH_FILL_ID);

            if (signal) {
              setSelectedElement({ id: String(signal.properties?.id), type: "signal" });
            } else if (parish && activeTool === 'none') {
              const pId = String(parish.id ?? parish.properties?.id);
              setSelectedElement({ id: pId, type: "parish" });
            }
          });
        });
      });

    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, [activeTool]);

  // Update Signals Source Logic
  const updateSignalsSource = (map: Map, signalsList: Signal[]) => {
    const source = map.getSource(SIGNALS_SRC_ID) as maplibregl.GeoJSONSource;
    if (!source) return;

    const sectors = signalsList.map((s) => {
      const b1 = (s.azimuth || 0) - ((s.beamwidth || 360) / 2);
      const b2 = (s.azimuth || 0) + ((s.beamwidth || 360) / 2);
      return turf.sector(s.lngLat, s.radius || 0.5, b1, b2, {
        properties: { id: s.id, color: s.color, selected: selectedElement?.id === s.id }
      });
    });
    const centers = signalsList.map((s) => turf.point(s.lngLat, { id: s.id, color: s.color, selected: selectedElement?.id === s.id }));
    source.setData({ type: "FeatureCollection", features: [...sectors, ...centers] });
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    updateSignalsSource(map, signals);
  }, [selectedElement, signals]);

  // Sync Parish Styles (Baking overrides into GeoJSON)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource(PARISH_SRC_ID) as maplibregl.GeoJSONSource;
    if (!source) return;

    fetch("/data/parroquias_libertador_14.geojson")
      .then(r => r.json())
      .then((data: FC) => {
        data.features.forEach(f => {
          const id = String(f.id ?? f.properties?.id);
          const override = parishOverrides[id];
          const styles = { ...globalParishStyles, ...override };

          f.properties = {
            ...f.properties,
            id: id,
            color: styles.color,
            opacity: styles.visible ? (styles.onlyOutline ? 0 : styles.opacity) : 0,
            selected: selectedElement?.id === id && selectedElement.type === 'parish'
          };
          map.setFeatureState({ source: PARISH_SRC_ID, id }, { selected: selectedElement?.id === id });
        });
        source.setData(data);
      });
  }, [parishOverrides, globalParishStyles, selectedElement]);

  // Radar Animation Loop
  useEffect(() => {
    const animate = () => {
      const map = mapRef.current;
      if (!map || signals.length === 0) { animationFrameRef.current = requestAnimationFrame(animate); return; }
      const progress = (Date.now() % 3000) / 3000;
      const waves = signals.map((s) => {
        const r = s.radius || 0.5;
        const beam = s.beamwidth || 360;
        const az = s.azimuth || 0;
        const waveRadius = Math.max(0.001, r * progress);
        const geom = beam === 360 ? turf.circle(s.lngLat, waveRadius) : turf.sector(s.lngLat, waveRadius, az - (beam / 2), az + (beam / 2));
        return { ...geom, properties: { color: s.color } };
      });
      (map.getSource(SIGNALS_WAVE_SRC_ID) as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: waves as any });
      if (map.getLayer(SIGNALS_WAVE_ID)) map.setPaintProperty(SIGNALS_WAVE_ID, 'fill-opacity', 0.4 * (1 - progress));
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameRef.current!);
  }, [signals]);

  // Add click handler
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onAddClick = (e: maplibregl.MapMouseEvent) => {
      if (activeTool === "none") return;
      const id = `s_${Date.now()}`;
      const newSignal: Signal = {
        id,
        type: activeTool,
        lngLat: [e.lngLat.lng, e.lngLat.lat],
        radius: config.radius / 1000,
        azimuth: config.azimuth,
        beamwidth: activeTool === "pulse" ? 360 : config.angle,
        color: config.color,
      };
      setSignals(prev => [...prev, newSignal]);
      setActiveTool("none");
      setSelectedElement({ id, type: "signal" });
    };
    map.on("click", onAddClick);
    return () => { map.off("click", onAddClick); };
  }, [activeTool, config]);

  const updateSelected = (updates: Partial<typeof config>) => {
    if (selectedElement?.type === 'signal') {
      setSignals(prev => prev.map(s => s.id === selectedElement.id ? {
        ...s,
        ...updates,
        radius: updates.radius !== undefined ? updates.radius / 1000 : s.radius,
        beamwidth: updates.angle !== undefined ? updates.angle : s.beamwidth,
        azimuth: updates.azimuth !== undefined ? updates.azimuth : s.azimuth,
        color: updates.color !== undefined ? updates.color : s.color
      } : s));
    } else { setConfig({ ...config, ...updates }); }
  };

  const updateSelectedParish = (updates: Partial<ParishStyles>) => {
    if (selectedElement?.type === 'parish') {
      setParishOverrides(prev => ({ ...prev, [selectedElement.id]: { ...prev[selectedElement.id], ...updates } }));
    } else { setGlobalParishStyles({ ...globalParishStyles, ...updates }); }
  };

  const toggleTool = (tool: "pulse" | "sector") => {
    if (activeTool === tool) setActiveTool("none");
    else {
      setActiveTool(tool);
      if (tool === "pulse") setConfig(c => ({ ...c, angle: 360 }));
      else if (tool === "sector") setConfig(c => ({ ...c, angle: 60 }));
    }
  };

  const currentConfig = selectedElement?.type === 'signal'
    ? {
      radius: Math.round((signals.find(s => s.id === selectedElement.id)?.radius || 0) * 1000),
      angle: signals.find(s => s.id === selectedElement.id)?.beamwidth || 360,
      azimuth: signals.find(s => s.id === selectedElement.id)?.azimuth || 0,
      color: signals.find(s => s.id === selectedElement.id)?.color || "#ffffff"
    }
    : config;

  const currentParish = selectedElement?.type === 'parish'
    ? { ...globalParishStyles, ...parishOverrides[selectedElement.id] }
    : globalParishStyles;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", height: "100vh" }}>
      <aside style={{ padding: 14, borderRight: "1px solid rgba(255,255,255,0.08)", overflowY: "auto", background: "#050b12" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Mapas Netlink</h2>

        {selectedElement && (
          <div style={{ marginTop: 10, padding: 10, background: "#00e5ff1a", borderRadius: 8, border: "1px solid #00e5ff44" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span>Editando: <b>{selectedElement.type.toUpperCase()}</b></span>
              <button onClick={() => setSelectedElement(null)} style={{ padding: '2px 8px', fontSize: 10 }}>Descartar</button>
            </div>
            {selectedElement.type === 'signal' && (
              <button onClick={() => { setSignals(prev => prev.filter(s => s.id !== selectedElement.id)); setSelectedElement(null); }} style={{ marginTop: 8, width: '100%', fontSize: 11, color: '#ff4444' }}>Eliminar Señal</button>
            )}
          </div>
        )}

        <div style={{ marginTop: 20, padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
          <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 16, fontWeight: 700 }}>{selectedElement?.type === 'signal' ? 'PROPIEDADES DE SEÑAL' : 'NUEVA SEÑAL'}</div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
              <label>Radio</label>
              <span style={{ color: '#00e5ff' }}>{currentConfig.radius} m</span>
            </div>
            <input type="range" min="50" max="15000" step="50" value={currentConfig.radius} onChange={(e) => updateSelected({ radius: Number(e.target.value) })} style={{ width: "100%" }} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
              <label>Ángulo</label>
              <span>{currentConfig.angle}°</span>
            </div>
            <input type="range" min="10" max="360" step="10" value={currentConfig.angle} onChange={(e) => updateSelected({ angle: Number(e.target.value) })} style={{ width: "100%" }} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
              <label>Azimut</label>
              <span>{currentConfig.azimuth}°</span>
            </div>
            <input type="range" min="0" max="360" step="1" value={currentConfig.azimuth} onChange={(e) => updateSelected({ azimuth: Number(e.target.value) })} style={{ width: "100%" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontSize: 13 }}>Color</label>
            <input type="color" value={currentConfig.color} onChange={(e) => updateSelected({ color: e.target.value })} style={{ border: "none", width: 30, height: 30, background: 'none' }} />
          </div>
        </div>

        {!selectedElement && (
          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <button onClick={() => toggleTool("pulse")} style={{ flex: 1, background: activeTool === "pulse" ? config.color : '', color: activeTool === "pulse" ? '#000' : '' }}>Pulso</button>
            <button onClick={() => toggleTool("sector")} style={{ flex: 1, background: activeTool === "sector" ? config.color : '', color: activeTool === "sector" ? '#000' : '' }}>Sector</button>
          </div>
        )}

        <div style={{ marginTop: 24, padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
          <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 16, fontWeight: 700 }}>{selectedElement?.type === 'parish' ? 'EDITAR PARROQUIA' : 'ESTILO PARROQUIAS'}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}><label style={{ fontSize: 13 }}>Visibilidad</label><input type="checkbox" checked={currentParish.visible} onChange={(e) => updateSelectedParish({ visible: e.target.checked })} /></div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}><label>Opacidad</label><span>{Math.round(currentParish.opacity * 100)}%</span></div>
            <input type="range" min="0" max="1" step="0.05" value={currentParish.opacity} onChange={(e) => updateSelectedParish({ opacity: Number(e.target.value) })} style={{ width: "100%" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}><label style={{ fontSize: 13 }}>Color</label><input type="color" value={currentParish.color} onChange={(e) => updateSelectedParish({ color: e.target.value })} style={{ border: "none", width: 30, height: 30, background: 'none' }} /></div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><label style={{ fontSize: 13 }}>Sólo Bordes</label><input type="checkbox" checked={currentParish.onlyOutline} onChange={(e) => updateSelectedParish({ onlyOutline: e.target.checked })} /></div>
        </div>
      </aside>
      <main ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
