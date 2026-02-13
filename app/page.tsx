"use client";

import maplibregl, { Map, Popup } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import * as turf from "@turf/turf";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

type FC = GeoJSON.FeatureCollection<GeoJSON.Geometry>;
type PointFC = GeoJSON.FeatureCollection<GeoJSON.Point>;

// --- Constants ---
const PARISH_SRC_ID = "parroquias";
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
  height: number;
  outlineColor: string;
  outlineWidth: number;
  labelColor: string;
  labelSize: number;
  labelHaloColor: string;
  labelHaloWidth: number;
}

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
  const [isometricMode, setIsometricMode] = useState(false);
  const [activeSection, setActiveSection] = useState<"tactical" | "parish" | "registry">("tactical");

  const [config, setConfig] = useState({ radius: 500, angle: 360, azimuth: 0, color: "#7F66FF" });
  const [globalParishStyles, setGlobalParishStyles] = useState<ParishStyles>({
    visible: true,
    opacity: 0.8,
    color: "#7F66FF",
    height: 40,
    outlineColor: "#7F66FF",
    outlineWidth: 1,
    labelColor: "#ffffff",
    labelSize: 10,
    labelHaloColor: "#000000",
    labelHaloWidth: 1
  });
  const [personForm, setPersonForm] = useState({ id: "", name: "", whatsapp: "", address: "", email: "" });

  const animationFrameRef = useRef<number | undefined>(undefined);
  const activeToolRef = useRef(activeTool);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

  const parroquiasDataRef = useRef<FC | null>(null);

  const syncData = (map: Map) => {
    if (!map.isStyleLoaded()) return;
    (map.getSource(SIGNALS_SRC_ID) as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: [
        ...signals.map(s => turf.sector(s.lngLat, s.radius || 0.5, (s.azimuth || 0) - ((s.beamwidth || 0) / 2), (s.azimuth || 0) + ((s.beamwidth || 0) / 2), { properties: { id: s.id, color: s.color, selected: selectedElement?.id === s.id } })),
        ...signals.map(s => turf.point(s.lngLat, { id: s.id, color: s.color, selected: selectedElement?.id === s.id }))
      ]
    });
    (map.getSource(MARKERS_SRC_ID) as maplibregl.GeoJSONSource)?.setData({ ...markers, features: markers.features.map(f => ({ ...f, properties: { ...f.properties, selected: selectedElement?.id === f.id } })) });

    if (parroquiasDataRef.current) {
      const data = { ...parroquiasDataRef.current };
      if (data.features) {
        data.features = data.features.map(f => {
          const id = String(f.id ?? f.properties?.id);
          const styles = { ...globalParishStyles, ...parishOverrides[id] };
          return {
            ...f,
            properties: {
              ...f.properties,
              id,
              color: styles.color,
              height: isometricMode ? (styles.visible ? styles.height : 0) : 0,
              opacity: styles.opacity,
              outlineColor: styles.outlineColor,
              outlineWidth: styles.outlineWidth,
              labelColor: styles.labelColor,
              labelSize: styles.labelSize,
              labelHaloColor: styles.labelHaloColor,
              labelHaloWidth: styles.labelHaloWidth
            }
          };
        });
        (map.getSource(PARISH_SRC_ID) as maplibregl.GeoJSONSource)?.setData(data as any);
        data.features.forEach(f => {
          const id = String(f.id ?? f.properties?.id);
          map.setFeatureState({ source: PARISH_SRC_ID, id }, { selected: selectedElement?.id === id });
        });
      }
    }
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    fetch("/api/key").then((res) => res.json()).then((data) => {
      if (!data.key) return;
      const map = new maplibregl.Map({
        container: containerRef.current!,
        style: `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${data.key}`,
        center: [-71.1505, 8.582],
        zoom: 13,
        pitch: 0,
        bearing: 0,
        antialias: true
      });

      mapRef.current = map;
      popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
      map.addControl(new maplibregl.NavigationControl(), "top-right");

      map.on("load", async () => {
        const res = await fetch("/data/parroquias_libertador_14.geojson");
        const parroquias = (await res.json()) as FC;
        parroquiasDataRef.current = parroquias;

        map.addSource(PARISH_SRC_ID, { type: "geojson", data: parroquias, promoteId: "id" } as any);

        map.addLayer({
          id: PARISH_EXTRUSION_ID,
          type: "fill-extrusion",
          source: PARISH_SRC_ID,
          paint: {
            "fill-extrusion-color": ["coalesce", ["get", "color"], "#7F66FF"],
            "fill-extrusion-height": ["coalesce", ["get", "height"], 0],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": ["get", "opacity"],
          },
        });

        map.addLayer({
          id: PARISH_LINE_ID,
          type: "line",
          source: PARISH_SRC_ID,
          paint: {
            "line-color": ["coalesce", ["get", "outlineColor"], "#7F66FF"],
            "line-opacity": 0.8,
            "line-width": ["coalesce", ["get", "outlineWidth"], 1],
          },
        });

        map.addLayer({
          id: PARISH_LABEL_ID,
          type: "symbol",
          source: PARISH_SRC_ID,
          layout: {
            "text-field": ["get", "name_full"],
            "text-font": ["Noto Sans Bold"],
            "text-size": ["coalesce", ["get", "labelSize"], 9],
            "text-transform": "uppercase",
            "text-letter-spacing": 0.1,
            "text-variable-anchor": ["top", "bottom"],
            "text-radial-offset": 2,
          },
          paint: {
            "text-color": ["coalesce", ["get", "labelColor"], "#ffffff"],
            "text-halo-color": ["coalesce", ["get", "labelHaloColor"], "#000000"],
            "text-halo-width": ["coalesce", ["get", "labelHaloWidth"], 1],
          }
        });

        map.addSource(MARKERS_SRC_ID, { type: "geojson", data: markers });
        map.addLayer({
          id: MARKERS_LAYER_ID,
          type: "circle",
          source: MARKERS_SRC_ID,
          paint: {
            "circle-radius": ["case", ["==", ["get", "selected"], true], 10, 5],
            "circle-color": "#7F66FF",
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: "markers-heading",
          type: "symbol",
          source: MARKERS_SRC_ID,
          layout: {
            "text-field": "➤",
            "text-size": 12,
            "text-rotate": ["get", "rotation"],
            "text-anchor": "center",
            "text-allow-overlap": true,
            "icon-allow-overlap": true,
            "text-offset": [0, 0] // Centered
          },
          paint: {
            "text-color": "#ffffff"
          }
        });

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
        map.addLayer({ id: SIGNALS_WAVE_ID, type: "fill", source: SIGNALS_WAVE_SRC_ID, paint: { "fill-color": ["get", "color"], "fill-opacity": 0.3 } });

        syncData(map);
      });
    });

    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const tool = activeToolRef.current;
      if (tool !== "none") {
        const id = `${tool}_${Date.now()}`;
        if (tool === "marker") { setMarkers(prev => ({ ...prev, features: [...prev.features, { type: "Feature", id, geometry: { type: "Point", coordinates: [e.lngLat.lng, e.lngLat.lat] }, properties: { id, selected: false, rotation: 0 } }] })); }
        else { setSignals(prev => [...prev, { id, type: tool, lngLat: [e.lngLat.lng, e.lngLat.lat], radius: config.radius / 1000, azimuth: config.azimuth, beamwidth: tool === "pulse" ? 360 : config.angle, color: config.color }]); }
        setActiveTool("none");
        setSelectedElement({ id, type: tool === "marker" ? "marker" : "signal" });
        return;
      }
      const features = map.queryRenderedFeatures(e.point, { layers: [SIGNALS_CENTER_ID, MARKERS_LAYER_ID, PARISH_EXTRUSION_ID] });
      if (features.length === 0) { setSelectedElement(null); return; }
      const f = features[0];
      if (f.layer.id === SIGNALS_CENTER_ID) setSelectedElement({ id: String(f.properties?.id), type: "signal" });
      else if (f.layer.id === MARKERS_LAYER_ID) setSelectedElement({ id: String(f.properties?.id), type: "marker" });
      else if (f.layer.id === PARISH_EXTRUSION_ID) setSelectedElement({ id: String(f.id ?? f.properties?.id), type: "parish" });
    };
    map.on("click", handleClick);
    return () => { map.off("click", handleClick); };
  }, [config]);

  useEffect(() => {
    if (mapRef.current) syncData(mapRef.current);
  }, [signals, markers, parishOverrides, globalParishStyles, selectedElement, isometricMode]);

  useEffect(() => {
    const animate = () => {
      const map = mapRef.current;
      if (!map || signals.length === 0) { animationFrameRef.current = requestAnimationFrame(animate); return; }
      const progress = (Date.now() % 3000) / 3000;
      const waves = signals.map((s) => {
        const geom = (s.beamwidth || 360) === 360 ? turf.circle(s.lngLat, (s.radius || 0.5) * progress) : turf.sector(s.lngLat, (s.radius || 0.5) * progress, (s.azimuth || 0) - (s.beamwidth || 0) / 2, (s.azimuth || 0) + (s.beamwidth || 0) / 2);
        return { ...geom, properties: { color: s.color } };
      });
      (map.getSource(SIGNALS_WAVE_SRC_ID) as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: waves as any });
      if (map.getLayer(SIGNALS_WAVE_ID)) map.setPaintProperty(SIGNALS_WAVE_ID, 'fill-opacity', 0.4 * (1 - progress));
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameRef.current!);
  }, [signals]);

  const updateSelected = (u: Partial<typeof config>) => {
    if (selectedElement?.type === 'signal') setSignals(prev => prev.map(s => s.id === selectedElement.id ? { ...s, ...u, radius: u.radius !== undefined ? u.radius / 1000 : s.radius, beamwidth: u.angle !== undefined ? u.angle : s.beamwidth } : s));
    else setConfig({ ...config, ...u });
  };

  const currentConfig = selectedElement?.type === 'signal' ? {
    radius: Math.round((signals.find(s => s.id === selectedElement.id)?.radius || 0) * 1000),
    angle: signals.find(s => s.id === selectedElement.id)?.beamwidth || 360,
    azimuth: signals.find(s => s.id === selectedElement.id)?.azimuth || 0,
    color: signals.find(s => s.id === selectedElement.id)?.color || "#7F66FF"
  } : config;

  return (
    <div style={{ height: "100vh", display: "grid", gridTemplateColumns: "1fr", position: "relative", background: "var(--bg-deep)" }}>
      {/* Sidebar - Modern Floating Card */}
      <motion.aside
        initial={{ x: -400 }}
        animate={{ x: 0 }}
        className="glass-card"
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          bottom: "20px",
          width: "360px",
          zIndex: 10,
          padding: "30px",
          display: "flex",
          flexDirection: "column",
          gap: "30px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.8)"
        }}
      >
        <div>
          <h1 style={{ fontSize: "22px", margin: 0, color: "var(--white)" }}>GALILEO_CORE</h1>
          <div style={{ fontSize: "10px", color: "var(--accent-purple)", fontWeight: "bold", marginTop: "4px" }} className="mono">DESIGN BY JEAN CLAUDE</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <button onClick={() => { localStorage.setItem("markers_fc", JSON.stringify(markers)); localStorage.setItem("signals_list", JSON.stringify(signals)); alert("SYNC_COMPLETE"); }} style={{ gridColumn: "span 2" }}>COMMIT_CHANGES</button>
          <Link href="/dashboard" style={{ textDecoration: "none" }}><button className="secondary" style={{ width: "100%" }}>DASHBOARD</button></Link>
          <button onClick={() => window.location.href = "/login"} className="secondary">EXIT</button>
        </div>

        <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "25px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
            <button onClick={() => setActiveSection("tactical")} className={activeSection === "tactical" ? "mono small" : "secondary mono small"} style={{ padding: "8px" }}>TACTICAL</button>
            <button onClick={() => setActiveSection("parish")} className={activeSection === "parish" ? "mono small" : "secondary mono small"} style={{ padding: "8px" }}>PARISH</button>
            <button onClick={() => setActiveSection("registry")} className={activeSection === "registry" ? "mono small" : "secondary mono small"} style={{ padding: "8px" }}>REGISTRY</button>
          </div>

          <div style={{ fontSize: "10px", color: "var(--text-dim)" }} className="mono">
            {selectedElement ? `EDITING_${selectedElement.type.toUpperCase()}_${selectedElement.id.slice(-4)}` : `${activeSection.toUpperCase()}_MOD_ACTIVE`}
          </div>

          <AnimatePresence mode="wait">
            {activeSection === "tactical" && (
              <motion.div
                key="tactical"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                style={{ display: "flex", flexDirection: "column", gap: "25px" }}
              >
                <div className="flex-col gap-sm">
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                    <span className="mono">RANGE</span>
                    <span className="mono" style={{ color: "var(--accent-purple)" }}>{currentConfig.radius}M</span>
                  </div>
                  <input type="range" min="50" max="15000" step="50" value={currentConfig.radius} onChange={(e) => updateSelected({ radius: Number(e.target.value) })} />
                </div>

                <div className="flex-col gap-sm">
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                    <span className="mono">BEAM</span>
                    <span className="mono" style={{ color: "var(--accent-purple)" }}>{currentConfig.angle}°</span>
                  </div>
                  <input type="range" min="10" max="360" step="10" value={currentConfig.angle} onChange={(e) => updateSelected({ angle: Number(e.target.value) })} />
                </div>

                <div className="flex-col gap-sm">
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                    <span className="mono">AZIMUTH</span>
                    <span className="mono" style={{ color: "var(--accent-purple)" }}>{currentConfig.azimuth}°</span>
                  </div>
                  <input type="range" min="0" max="360" step="5" value={currentConfig.azimuth} onChange={(e) => updateSelected({ azimuth: Number(e.target.value) })} />
                </div>

                <div className="flex-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <span className="mono" style={{ fontSize: "11px" }}>CHROMA</span>
                  <input type="color" value={currentConfig.color} onChange={(e) => updateSelected({ color: e.target.value })} style={{ width: "32px", height: "32px", background: "none", border: "1px solid var(--border-light)", borderRadius: "8px", cursor: "pointer" }} />
                </div>

                {selectedElement && selectedElement.type === 'marker' && (
                  <div className="flex-col gap-sm">
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                      <span className="mono">ROTATION</span>
                      <span className="mono" style={{ color: "var(--accent-purple)" }}>{markers.features.find(f => f.id === selectedElement.id)?.properties?.rotation || 0}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="5"
                      value={markers.features.find(f => f.id === selectedElement.id)?.properties?.rotation || 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setMarkers(prev => ({
                          ...prev,
                          features: prev.features.map(f => f.id === selectedElement.id ? { ...f, properties: { ...f.properties, rotation: val } } : f)
                        }));
                      }}
                    />
                  </div>
                )}

                {selectedElement && (selectedElement.type === 'signal' || selectedElement.type === 'marker') && (
                  <button onClick={() => {
                    if (selectedElement.type === 'signal') setSignals(prev => prev.filter(s => s.id !== selectedElement.id));
                    else if (selectedElement.type === 'marker') setMarkers(prev => ({ ...prev, features: prev.features.filter(f => f.id !== selectedElement.id) }));
                    setSelectedElement(null);
                  }} className="danger">ELIMINAR_ENTIDAD</button>
                )}
              </motion.div>
            )}

            {activeSection === "parish" && (
              <motion.div
                key="parish"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                style={{ display: "flex", flexDirection: "column", gap: "25px" }}
              >
                {selectedElement?.type === 'parish' ? (
                  <>
                    <div className="flex-col gap-sm">
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                        <span className="mono">PARISH_HEIGHT</span>
                        <span className="mono" style={{ color: "var(--accent-purple)" }}>{(parishOverrides[selectedElement.id]?.height ?? globalParishStyles.height)}M</span>
                      </div>
                      <input type="range" min="0" max="500" step="10" value={parishOverrides[selectedElement.id]?.height ?? globalParishStyles.height} onChange={(e) => setParishOverrides(prev => ({ ...prev, [selectedElement.id]: { ...prev[selectedElement.id], height: Number(e.target.value) } }))} />
                    </div>

                    <div className="flex-col gap-sm">
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                        <span className="mono">OUTLINE_WIDTH</span>
                        <span className="mono" style={{ color: "var(--accent-purple)" }}>{(parishOverrides[selectedElement.id]?.outlineWidth ?? globalParishStyles.outlineWidth)}px</span>
                      </div>
                      <input type="range" min="0" max="10" step="0.5" value={parishOverrides[selectedElement.id]?.outlineWidth ?? globalParishStyles.outlineWidth} onChange={(e) => setParishOverrides(prev => ({ ...prev, [selectedElement.id]: { ...prev[selectedElement.id], outlineWidth: Number(e.target.value) } }))} />
                    </div>

                    <div className="flex-col gap-sm">
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                        <span className="mono">LABEL_SIZE</span>
                        <span className="mono" style={{ color: "var(--accent-purple)" }}>{(parishOverrides[selectedElement.id]?.labelSize ?? globalParishStyles.labelSize)}px</span>
                      </div>
                      <input type="range" min="0" max="30" step="1" value={parishOverrides[selectedElement.id]?.labelSize ?? globalParishStyles.labelSize} onChange={(e) => setParishOverrides(prev => ({ ...prev, [selectedElement.id]: { ...prev[selectedElement.id], labelSize: Number(e.target.value) } }))} />
                    </div>

                    <div className="flex-col gap-sm">
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                        <span className="mono">HALO_WIDTH</span>
                        <span className="mono" style={{ color: "var(--accent-purple)" }}>{(parishOverrides[selectedElement.id]?.labelHaloWidth ?? globalParishStyles.labelHaloWidth)}px</span>
                      </div>
                      <input type="range" min="0" max="5" step="0.5" value={parishOverrides[selectedElement.id]?.labelHaloWidth ?? globalParishStyles.labelHaloWidth} onChange={(e) => setParishOverrides(prev => ({ ...prev, [selectedElement.id]: { ...prev[selectedElement.id], labelHaloWidth: Number(e.target.value) } }))} />
                    </div>

                    <div className="flex-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <span className="mono" style={{ fontSize: "11px" }}>PARISH_COLOR</span>
                      <input type="color" value={parishOverrides[selectedElement.id]?.color ?? globalParishStyles.color} onChange={(e) => setParishOverrides(prev => ({ ...prev, [selectedElement.id]: { ...prev[selectedElement.id], color: e.target.value } }))} style={{ width: "32px", height: "32px", background: "none", border: "1px solid var(--border-light)", borderRadius: "8px", cursor: "pointer" }} />
                    </div>

                    <div className="flex-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <span className="mono" style={{ fontSize: "11px" }}>OUTLINE_COLOR</span>
                      <input type="color" value={parishOverrides[selectedElement.id]?.outlineColor ?? globalParishStyles.outlineColor} onChange={(e) => setParishOverrides(prev => ({ ...prev, [selectedElement.id]: { ...prev[selectedElement.id], outlineColor: e.target.value } }))} style={{ width: "32px", height: "32px", background: "none", border: "1px solid var(--border-light)", borderRadius: "8px", cursor: "pointer" }} />
                    </div>

                    <div className="flex-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <span className="mono" style={{ fontSize: "11px" }}>LABEL_COLOR</span>
                      <input type="color" value={parishOverrides[selectedElement.id]?.labelColor ?? globalParishStyles.labelColor} onChange={(e) => setParishOverrides(prev => ({ ...prev, [selectedElement.id]: { ...prev[selectedElement.id], labelColor: e.target.value } }))} style={{ width: "32px", height: "32px", background: "none", border: "1px solid var(--border-light)", borderRadius: "8px", cursor: "pointer" }} />
                    </div>

                    <div className="flex-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <span className="mono" style={{ fontSize: "11px" }}>HALO_COLOR</span>
                      <input type="color" value={parishOverrides[selectedElement.id]?.labelHaloColor ?? globalParishStyles.labelHaloColor} onChange={(e) => setParishOverrides(prev => ({ ...prev, [selectedElement.id]: { ...prev[selectedElement.id], labelHaloColor: e.target.value } }))} style={{ width: "32px", height: "32px", background: "none", border: "1px solid var(--border-light)", borderRadius: "8px", cursor: "pointer" }} />
                    </div>

                    <div className="flex-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <span className="mono" style={{ fontSize: "11px" }}>VISIBLE</span>
                      <input type="checkbox" checked={parishOverrides[selectedElement.id]?.visible ?? globalParishStyles.visible} onChange={(e) => setParishOverrides(prev => ({ ...prev, [selectedElement.id]: { ...prev[selectedElement.id], visible: e.target.checked } }))} />
                    </div>

                    <button className="secondary small" onClick={() => {
                      const newOverrides = { ...parishOverrides };
                      delete newOverrides[selectedElement.id];
                      setParishOverrides(newOverrides);
                    }}>RESET_OVERRIDES</button>
                  </>
                ) : (
                  <div className="mono" style={{ fontSize: "11px", color: "var(--text-dim)", textAlign: "center", padding: "20px", border: "1px dashed var(--border-light)", borderRadius: "12px" }}>
                    SELECT_A_PARISH_ON_MAP_TO_OVERRIDE
                  </div>
                )}

                <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "20px" }}>
                  <div style={{ fontSize: "10px", color: "var(--text-dim)", marginBottom: "15px" }} className="mono">GLOBAL_DEFAULTS</div>
                  <div className="flex-col gap-sm">
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                      <span className="mono">DEFAULT_HEIGHT</span>
                      <span className="mono">{globalParishStyles.height}M</span>
                    </div>
                    <input type="range" min="0" max="200" step="5" value={globalParishStyles.height} onChange={(e) => setGlobalParishStyles(prev => ({ ...prev, height: Number(e.target.value) }))} />
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection === "registry" && (
              <motion.div
                key="registry"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                style={{ display: "flex", flexDirection: "column", gap: "15px" }}
              >
                <div className="flex-col gap-xs">
                  <label className="mono" style={{ fontSize: "9px" }}>CÉDULA</label>
                  <input type="text" placeholder="V-00000000" value={personForm.id} onChange={(e) => setPersonForm(prev => ({ ...prev, id: e.target.value }))} />
                </div>
                <div className="flex-col gap-xs">
                  <label className="mono" style={{ fontSize: "9px" }}>NOMBRE_COMPLETO</label>
                  <input type="text" placeholder="JEAN CLAUDE MORALES" value={personForm.name} onChange={(e) => setPersonForm(prev => ({ ...prev, name: e.target.value }))} />
                </div>
                <div className="flex-col gap-xs">
                  <label className="mono" style={{ fontSize: "9px" }}>WHATSAPP</label>
                  <input type="text" placeholder="+58 4XX XXXXXXX" value={personForm.whatsapp} onChange={(e) => setPersonForm(prev => ({ ...prev, whatsapp: e.target.value }))} />
                </div>
                <div className="flex-col gap-xs">
                  <label className="mono" style={{ fontSize: "9px" }}>DIRECCIÓN</label>
                  <input type="text" placeholder="AV. PRINCIPAL..." value={personForm.address} onChange={(e) => setPersonForm(prev => ({ ...prev, address: e.target.value }))} />
                </div>
                <div className="flex-col gap-xs">
                  <label className="mono" style={{ fontSize: "9px" }}>CORREO</label>
                  <input type="email" placeholder="example@email.com" value={personForm.email} onChange={(e) => setPersonForm(prev => ({ ...prev, email: e.target.value }))} />
                </div>
                <button onClick={() => { alert(`PERSON_REGISTERED: ${personForm.name}`); setPersonForm({ id: "", name: "", whatsapp: "", address: "", email: "" }); }} style={{ marginTop: "10px" }}>COMMIT_REGISTRY</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ fontSize: "10px", color: "var(--text-dim)", marginBottom: "5px" }} className="mono">ENTITIES_DEPLOYMENT</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <button onClick={() => setActiveTool("marker")} className={activeTool === "marker" ? "" : "secondary"} style={{ fontSize: "11px" }}>POINT</button>
            <button onClick={() => setActiveTool("pulse")} className={activeTool === "pulse" ? "" : "secondary"} style={{ fontSize: "11px" }}>PULSE</button>
            <button onClick={() => setActiveTool("sector")} className={activeTool === "sector" ? "" : "secondary"} style={{ fontSize: "11px", gridColumn: "span 2" }}>SECTOR_BEAM</button>
          </div>
        </div>

        <div style={{ marginTop: "auto", borderTop: "1px solid var(--border-light)", paddingTop: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-dim)" }} className="mono">
            <span>COORD_NODE: 8.5822 / -71.1505</span>
          </div>
          <button onClick={() => setIsometricMode(!isometricMode)} className="secondary" style={{ width: "100%", marginTop: "15px", fontSize: "10px" }}>
            {isometricMode ? "DISABLE_ISOMETRIC_RENDER" : "ENABLE_ISOMETRIC_RENDER"}
          </button>
        </div>
      </motion.aside>

      <main ref={containerRef} style={{ width: "100%", height: "100%" }} />

      <div style={{ position: "absolute", top: "20px", right: "20px", pointerEvents: "none" }}>
        <div className="glass-card mono" style={{ padding: "10px 20px", fontSize: "10px", color: "var(--accent-green)" }}>
          UPLINK_STATUS: ACTIVE // 128ms
        </div>
      </div>
    </div>
  );
}
