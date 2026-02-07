"use client";

import maplibregl, { Map, Popup } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import * as turf from "@turf/turf";

type FC = GeoJSON.FeatureCollection<GeoJSON.Geometry>;
type PointFC = GeoJSON.FeatureCollection<GeoJSON.Point>;

// --- Constants ---
const PARISH_SRC_ID = "parroquias";
const PARISH_FILL_ID = "parroquias-fill";
const PARISH_EXTRUSION_ID = "parroquias-3d";
const PARISH_LINE_ID = "parroquias-line";
const PARISH_LABEL_ID = "parroquias-label";

const MARKERS_SRC_ID = "markers";
const MARKERS_LAYER_ID = "markers-layer";

const SIGNALS_SRC_ID = "signals-sector";
const SIGNALS_LAYER_ID = "signals-sector-fill";
const SIGNALS_CENTER_ID = "signals-center";
const SIGNALS_WAVE_ID = "signals-wave";
const SIGNALS_WAVE_SRC_ID = "signals-wave-src";

interface Signal {
  id: string;
  type: "pulse" | "sector";
  lngLat: [number, number];
  azimuth?: number;
  beamwidth?: number;
  radius?: number;
  color?: string;
}

interface ParishStyles {
  visible: boolean;
  opacity: number;
  color: string;
  height: number; // For 3D Isometric visualization
}

// --- Helpers ---
function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch { return defaultValue; }
}

export default function Page() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const popupRef = useRef<Popup | null>(null);

  // States
  const [markers, setMarkers] = useState<PointFC>(() => loadFromStorage("markers_fc", { type: "FeatureCollection", features: [] }));
  const [signals, setSignals] = useState<Signal[]>(() => loadFromStorage("signals_list", []));
  const [parishOverrides, setParishOverrides] = useState<Record<string, Partial<ParishStyles>>>(() => loadFromStorage("parish_overrides", {}));

  const [selectedElement, setSelectedElement] = useState<{ id: string; type: "signal" | "parish" | "marker" } | null>(null);
  const [activeTool, setActiveTool] = useState<"none" | "pulse" | "sector" | "marker">("none");

  // Game/Isometric State
  const [isometricMode, setIsometricMode] = useState(true);

  const [config, setConfig] = useState({
    radius: 500,
    angle: 360,
    azimuth: 0,
    color: "#00e5ff",
  });

  const [globalParishStyles, setGlobalParishStyles] = useState<ParishStyles>({
    visible: true,
    opacity: 0.2,
    color: "#00e5ff",
    height: 100, // meters
  });

  const animationFrameRef = useRef<number | undefined>(undefined);
  const activeToolRef = useRef(activeTool);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

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
          zoom: 13.5,
          pitch: 55, // Isometric start
          bearing: -20,
          antialias: true
        });

        mapRef.current = map;
        popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
        map.addControl(new maplibregl.NavigationControl(), "top-right");

        map.on("load", async () => {
          // --- Parroquias ---
          const res = await fetch("/data/parroquias_libertador_14.geojson");
          const parroquias = (await res.json()) as FC;
          map.addSource(PARISH_SRC_ID, { type: "geojson", data: parroquias, promoteId: "id" } as any);

          // 3D Isometric View
          map.addLayer({
            id: PARISH_EXTRUSION_ID,
            type: "fill-extrusion",
            source: PARISH_SRC_ID,
            paint: {
              "fill-extrusion-color": ["coalesce", ["get", "color"], "#00e5ff"],
              "fill-extrusion-height": ["coalesce", ["get", "height"], 0],
              "fill-extrusion-base": 0,
              "fill-extrusion-opacity": 0.6,
            },
          });

          map.addLayer({
            id: PARISH_LINE_ID,
            type: "line",
            source: PARISH_SRC_ID,
            paint: {
              "line-color": "#ffffff",
              "line-opacity": 0.8,
              "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 4, 1],
            },
          });

          map.addLayer({
            id: PARISH_LABEL_ID,
            type: "symbol",
            source: PARISH_SRC_ID,
            layout: {
              "text-field": ["get", "name_full"],
              "text-font": ["Noto Sans Bold"],
              "text-size": 10,
              "text-variable-anchor": ["top", "bottom"],
              "text-radial-offset": 1.5,
            },
            paint: {
              "text-color": "#ffffff",
              "text-halo-color": "#000000",
              "text-halo-width": 2,
            }
          });

          // --- Markers ---
          map.addSource(MARKERS_SRC_ID, { type: "geojson", data: markers });
          map.addLayer({
            id: MARKERS_LAYER_ID,
            type: "circle",
            source: MARKERS_SRC_ID,
            paint: {
              "circle-radius": ["case", ["==", ["get", "selected"], true], 10, 6],
              "circle-color": "#ff00ff", // Vaporwave neon
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 2,
              "circle-blur": 0.5,
            },
          });

          // --- Signals ---
          map.addSource(SIGNALS_SRC_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: SIGNALS_LAYER_ID, type: "fill", source: SIGNALS_SRC_ID, filter: ["==", "$type", "Polygon"], paint: { "fill-color": ["get", "color"], "fill-opacity": 0.3 } });
          map.addLayer({
            id: SIGNALS_CENTER_ID,
            type: "circle",
            source: SIGNALS_SRC_ID,
            filter: ["==", "$type", "Point"],
            paint: {
              "circle-radius": ["case", ["==", ["get", "selected"], true], 10, 5],
              "circle-color": ["get", "color"],
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 2,
            },
          });

          map.addSource(SIGNALS_WAVE_SRC_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: SIGNALS_WAVE_ID, type: "fill", source: SIGNALS_WAVE_SRC_ID, paint: { "fill-color": ["get", "color"], "fill-opacity": 0.4 } });
        });
      });

    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // Central Click Listener
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const tool = activeToolRef.current;
      if (tool !== "none") {
        const id = `${tool}_${Date.now()}`;
        if (tool === "marker") {
          setMarkers(prev => ({ ...prev, features: [...prev.features, { type: "Feature", id, geometry: { type: "Point", coordinates: [e.lngLat.lng, e.lngLat.lat] }, properties: { id, selected: false } }] }));
        } else {
          setSignals(prev => [...prev, { id, type: tool, lngLat: [e.lngLat.lng, e.lngLat.lat], radius: config.radius / 1000, azimuth: config.azimuth, beamwidth: tool === "pulse" ? 360 : config.angle, color: config.color }]);
        }
        setActiveTool("none");
        setSelectedElement({ id, type: tool === "marker" ? "marker" : "signal" });
        return;
      }

      const features = map.queryRenderedFeatures(e.point, { layers: [SIGNALS_CENTER_ID, MARKERS_LAYER_ID, PARISH_EXTRUSION_ID] });
      if (features.length === 0) { setSelectedElement(null); return; }

      const signal = features.find(f => f.layer.id === SIGNALS_CENTER_ID);
      const marker = features.find(f => f.layer.id === MARKERS_LAYER_ID);
      const parish = features.find(f => f.layer.id === PARISH_EXTRUSION_ID);

      if (signal) setSelectedElement({ id: String(signal.properties?.id), type: "signal" });
      else if (marker) setSelectedElement({ id: String(marker.properties?.id), type: "marker" });
      else if (parish) setSelectedElement({ id: String(parish.id ?? parish.properties?.id), type: "parish" });
    };

    map.on("click", handleClick);
    return () => { map.off("click", handleClick); };
  }, [config]);

  // Syncing Sources
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    (map.getSource(SIGNALS_SRC_ID) as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: [
        ...signals.map(s => turf.sector(s.lngLat, s.radius || 0.5, (s.azimuth || 0) - ((s.beamwidth || 0) / 2), (s.azimuth || 0) + ((s.beamwidth || 0) / 2), { properties: { id: s.id, color: s.color, selected: selectedElement?.id === s.id } })),
        ...signals.map(s => turf.point(s.lngLat, { id: s.id, color: s.color, selected: selectedElement?.id === s.id }))
      ]
    });

    (map.getSource(MARKERS_SRC_ID) as maplibregl.GeoJSONSource)?.setData({
      ...markers,
      features: markers.features.map(f => ({ ...f, properties: { ...f.properties, selected: selectedElement?.id === f.id } }))
    });

    fetch("/data/parroquias_libertador_14.geojson").then(r => r.json()).then((data: FC) => {
      data.features.forEach(f => {
        const id = String(f.id ?? f.properties?.id);
        const styles = { ...globalParishStyles, ...parishOverrides[id] };
        // Game specific visual scale
        const height = styles.visible ? styles.height : 0;
        f.properties = { ...f.properties, id, color: styles.color, height: isometricMode ? height : 0, opacity: styles.opacity };
        map.setFeatureState({ source: PARISH_SRC_ID, id }, { selected: selectedElement?.id === id });
      });
      (map.getSource(PARISH_SRC_ID) as maplibregl.GeoJSONSource)?.setData(data);
    });
  }, [signals, markers, parishOverrides, globalParishStyles, selectedElement, isometricMode]);

  // Radar Animation
  useEffect(() => {
    const animate = () => {
      const map = mapRef.current;
      if (!map || signals.length === 0) { animationFrameRef.current = requestAnimationFrame(animate); return; }
      const progress = (Date.now() % 3000) / 3000;
      const waves = signals.map((s) => {
        const az = s.azimuth || 0; const beam = s.beamwidth || 360;
        const geom = beam === 360 ? turf.circle(s.lngLat, Math.max(0.001, (s.radius || 0.5) * progress)) : turf.sector(s.lngLat, Math.max(0.001, (s.radius || 0.5) * progress), az - beam / 2, az + beam / 2);
        return { ...geom, properties: { color: s.color } };
      });
      (map.getSource(SIGNALS_WAVE_SRC_ID) as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: waves as any });
      if (map.getLayer(SIGNALS_WAVE_ID)) map.setPaintProperty(SIGNALS_WAVE_ID, 'fill-opacity', 0.5 * (1 - progress));
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameRef.current!);
  }, [signals]);

  const updateSelected = (updates: Partial<typeof config>) => {
    if (selectedElement?.type === 'signal') setSignals(prev => prev.map(s => s.id === selectedElement.id ? { ...s, ...updates, radius: updates.radius !== undefined ? updates.radius / 1000 : s.radius, beamwidth: updates.angle !== undefined ? updates.angle : s.beamwidth } : s));
    else setConfig({ ...config, ...updates });
  };

  const updateSelectedParish = (updates: Partial<ParishStyles>) => {
    if (selectedElement?.type === 'parish') setParishOverrides(prev => ({ ...prev, [selectedElement.id]: { ...prev[selectedElement.id], ...updates } }));
    else setGlobalParishStyles(prev => ({ ...prev, ...updates }));
  };

  const currentConfig = selectedElement?.type === 'signal' ? {
    radius: Math.round((signals.find(s => s.id === selectedElement.id)?.radius || 0) * 1000),
    angle: signals.find(s => s.id === selectedElement.id)?.beamwidth || 360,
    azimuth: signals.find(s => s.id === selectedElement.id)?.azimuth || 0,
    color: signals.find(s => s.id === selectedElement.id)?.color || "#ffffff"
  } : config;

  const currentParish = selectedElement?.type === 'parish' ? { ...globalParishStyles, ...parishOverrides[selectedElement.id] } : globalParishStyles;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", height: "100vh", background: "#050b12", color: "#fff", fontFamily: "'Inter', sans-serif" }}>
      <aside style={{ padding: 24, background: "rgba(5, 11, 18, 0.95)", backdropFilter: "blur(10px)", borderRight: "1px solid rgba(0, 229, 255, 0.2)", overflowY: "auto", boxShadow: "10px 0 30px rgba(0,0,0,0.5)", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <div style={{ width: 40, height: 40, background: "linear-gradient(45deg, #00e5ff, #ff00ff)", borderRadius: 10, boxShadow: "0 0 15px #00e5ff88" }} />
          <h1 style={{ margin: 0, fontSize: 20, letterSpacing: 1, fontWeight: 900, textTransform: "uppercase", background: "linear-gradient(to right, #fff, #00e5ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Netlink Atlas</h1>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <button onClick={() => { localStorage.setItem("markers_fc", JSON.stringify(markers)); localStorage.setItem("signals_list", JSON.stringify(signals)); localStorage.setItem("parish_overrides", JSON.stringify(parishOverrides)); alert("Mapa Guardado"); }} style={{ flex: 2, background: "linear-gradient(90deg, #00e5ff, #00acc1)", color: "#000", fontWeight: "bold", border: "none", borderRadius: 8, padding: "10px 15px", cursor: "pointer", boxShadow: "0 4px 15px rgba(0, 229, 255, 0.3)" }}>GUARDAR MAPA</button>
          <button onClick={() => setIsometricMode(!isometricMode)} style={{ flex: 1, background: isometricMode ? "#ff00ff" : "#333", border: "none", borderRadius: 8, color: "#fff", fontSize: 10, fontWeight: "bold" }}>3D {isometricMode ? "ON" : "OFF"}</button>
        </div>

        {selectedElement && (
          <div style={{ marginBottom: 24, padding: 20, background: "rgba(0, 229, 255, 0.05)", borderRadius: 12, border: "1px solid rgba(0, 229, 255, 0.3)", position: "relative" }}>
            <div style={{ fontSize: 10, color: "#00e5ff", fontWeight: "bold", marginBottom: 5 }}>EDITOR ACTIVO</div>
            <div style={{ fontSize: 16, fontWeight: "bold", textTransform: "uppercase" }}>{selectedElement.type} #{selectedElement.id.slice(-4)}</div>
            <button onClick={() => setSelectedElement(null)} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 14 }}>✕</button>
            <button onClick={() => {
              if (selectedElement.type === 'signal') setSignals(prev => prev.filter(s => s.id !== selectedElement.id));
              else if (selectedElement.type === 'marker') setMarkers(prev => ({ ...prev, features: prev.features.filter(f => f.id !== selectedElement.id) }));
              setSelectedElement(null);
            }} style={{ marginTop: 15, width: "100%", background: "rgba(255, 68, 68, 0.1)", border: "1px solid #ff444466", color: "#ff4444", borderRadius: 6, padding: "6px", fontSize: 11, cursor: "pointer" }}>Eliminar</button>
          </div>
        )}

        <div style={{ background: "rgba(255,255,255,0.02)", padding: 20, borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)", marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, marginBottom: 20, letterSpacing: 1.5 }}>GEOMETRÍA Y DATOS</div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13 }}>
              <span>Escala / Altura</span>
              <span style={{ color: "#00e5ff", fontWeight: "bold" }}>{currentConfig.radius} m</span>
            </div>
            <input type="range" min="50" max="15000" step="50" value={currentConfig.radius} onChange={(e) => updateSelected({ radius: Number(e.target.value) })} style={{ width: "100%", accentColor: "#00e5ff" }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13 }}>
              <span>Apertura Angular</span>
              <span style={{ color: "#00e5ff" }}>{currentConfig.angle}°</span>
            </div>
            <input type="range" min="10" max="360" step="10" value={currentConfig.angle} onChange={(e) => updateSelected({ angle: Number(e.target.value) })} style={{ width: "100%", accentColor: "#00e5ff" }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13 }}>
              <span>Azimut / Dirección</span>
              <span style={{ color: "#00e5ff" }}>{currentConfig.azimuth}°</span>
            </div>
            <input type="range" min="0" max="360" step="1" value={currentConfig.azimuth} onChange={(e) => updateSelected({ azimuth: Number(e.target.value) })} style={{ width: "100%", accentColor: "#00e5ff" }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13 }}>Espectro / Color</span>
            <input type="color" value={currentConfig.color} onChange={(e) => updateSelected({ color: e.target.value })} style={{ border: "2px solid rgba(255,255,255,0.1)", width: 40, height: 30, background: 'none', borderRadius: 4, cursor: "pointer" }} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
          <button onClick={() => setActiveTool("marker")} style={{ padding: 12, background: activeTool === "marker" ? "#ff00ff33" : "rgba(255,255,255,0.03)", border: `1px solid ${activeTool === "marker" ? "#ff00ff" : "rgba(255,255,255,0.1)"}`, color: activeTool === "marker" ? "#ff00ff" : "#fff", borderRadius: 8, fontSize: 12, fontWeight: "bold", cursor: "pointer", transition: "all 0.2s" }}>PUNTO</button>
          <button onClick={() => setActiveTool("pulse")} style={{ padding: 12, background: activeTool === "pulse" ? "#00e5ff33" : "rgba(255,255,255,0.03)", border: `1px solid ${activeTool === "pulse" ? "#00e5ff" : "rgba(255,255,255,0.1)"}`, color: activeTool === "pulse" ? "#00e5ff" : "#fff", borderRadius: 8, fontSize: 12, fontWeight: "bold", cursor: "pointer" }}>PULSO</button>
          <button onClick={() => setActiveTool("sector")} style={{ padding: 12, gridColumn: "span 2", background: activeTool === "sector" ? "#00e5ff33" : "rgba(255,255,255,0.03)", border: `1px solid ${activeTool === "sector" ? "#00e5ff" : "rgba(255,255,255,0.1)"}`, color: activeTool === "sector" ? "#00e5ff" : "#fff", borderRadius: 8, fontSize: 12, fontWeight: "bold", cursor: "pointer" }}>SECTOR DINÁMICO</button>
        </div>

        <div style={{ background: "rgba(0,0,0,0.3)", padding: 20, borderRadius: 12, border: "1px solid rgba(0, 229, 255, 0.1)" }}>
          <div style={{ fontSize: 11, color: "#00e5ff", fontWeight: 700, marginBottom: 20, letterSpacing: 1.5 }}>ESTADÍSTICAS PARROQUIALES</div>

          {selectedElement?.type === 'parish' ? (
            <div style={{ marginBottom: 15 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13 }}>
                <span>Altura Isométrica (Dato)</span>
                <span style={{ color: "#00e5ff" }}>{currentParish.height} m</span>
              </div>
              <input type="range" min="0" max="2000" step="50" value={currentParish.height} onChange={(e) => updateSelectedParish({ height: Number(e.target.value) })} style={{ width: "100%", accentColor: "#00e5ff" }} />
            </div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.6, fontStyle: "italic", marginBottom: 15 }}>Selecciona una parroquia en el mapa para ajustar su altura 3D individualmente.</div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13 }}>Visibilidad Global</span>
            <input type="checkbox" checked={currentParish.visible} onChange={(e) => updateSelectedParish({ visible: e.target.checked })} />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13 }}>Opacidad</span>
            <input type="range" min="0" max="1" step="0.1" value={currentParish.opacity} onChange={(e) => updateSelectedParish({ opacity: Number(e.target.value) })} style={{ width: "100px" }} />
          </div>
        </div>

        <div style={{ marginTop: 30, textAlign: "center", opacity: 0.3, fontSize: 10 }}>Atlas Engine v2.0 - Netlink Labs</div>
      </aside>

      <main ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
        <div style={{ position: "absolute", bottom: 20, right: 20, zIndex: 5, background: "rgba(5, 11, 18, 0.8)", padding: "8px 15px", borderRadius: 20, fontSize: 11, border: "1px solid rgba(0,229,255,0.3)", backdropFilter: "blur(5px)" }}>
          LAT: <span style={{ color: "#00e5ff" }}>8.582</span> / LNG: <span style={{ color: "#00e5ff" }}>-71.150</span>
        </div>
      </main>
    </div>
  );
}
