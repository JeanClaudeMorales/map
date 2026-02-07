"use client";

import maplibregl, { Map, Popup } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import * as turf from "@turf/turf";
import Link from "next/link";

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
  const [isometricMode, setIsometricMode] = useState(true);

  const [config, setConfig] = useState({ radius: 500, angle: 360, azimuth: 0, color: "#ffffff" });
  const [globalParishStyles, setGlobalParishStyles] = useState<ParishStyles>({ visible: true, opacity: 0.1, color: "#ffffff", height: 100 });

  const animationFrameRef = useRef<number | undefined>(undefined);
  const activeToolRef = useRef(activeTool);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

  // --- Parroquias Data Cache ---
  const parroquiasDataRef = useRef<FC | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    fetch("/api/key").then((res) => res.json()).then((data) => {
      if (!data.key) return;
      const map = new maplibregl.Map({
        container: containerRef.current!,
        style: `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${data.key}`,
        center: [-71.1505, 8.582],
        zoom: 13,
        pitch: 60,
        bearing: -20,
        antialias: true
      });

      mapRef.current = map;
      popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
      map.addControl(new maplibregl.NavigationControl(), "top-right");

      map.on("load", async () => {
        const res = await fetch("/data/parroquias_libertador_14.geojson");
        const parroquias = (await res.json()) as FC;
        parroquiasDataRef.current = parroquias; // Cache it

        map.addSource(PARISH_SRC_ID, { type: "geojson", data: parroquias, promoteId: "id" } as any);

        map.addLayer({
          id: PARISH_EXTRUSION_ID,
          type: "fill-extrusion",
          source: PARISH_SRC_ID,
          paint: {
            "fill-extrusion-color": ["coalesce", ["get", "color"], "#ffffff"],
            "fill-extrusion-height": ["coalesce", ["get", "height"], 0],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.4,
          },
        });

        map.addLayer({
          id: PARISH_LINE_ID,
          type: "line",
          source: PARISH_SRC_ID,
          paint: {
            "line-color": "#ffffff",
            "line-opacity": 0.5,
            "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 4, 0.5],
          },
        });

        map.addLayer({
          id: PARISH_LABEL_ID,
          type: "symbol",
          source: PARISH_SRC_ID,
          layout: {
            "text-field": ["get", "name_full"],
            "text-font": ["Noto Sans Bold"],
            "text-size": 9,
            "text-transform": "uppercase",
            "text-letter-spacing": 0.1,
            "text-variable-anchor": ["top", "bottom"],
            "text-radial-offset": 2,
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "#000000",
            "text-halo-width": 1,
          }
        });

        map.addSource(MARKERS_SRC_ID, { type: "geojson", data: markers });
        map.addLayer({
          id: MARKERS_LAYER_ID,
          type: "circle",
          source: MARKERS_SRC_ID,
          paint: {
            "circle-radius": ["case", ["==", ["get", "selected"], true], 10, 5],
            "circle-color": "#ffffff",
            "circle-stroke-color": "#000",
            "circle-stroke-width": 2,
          },
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

        // Trigger initial render of dynamic data
        syncData(map);
      });
    });

    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

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
      data.features = data.features.map(f => {
        const id = String(f.id ?? f.properties?.id);
        const styles = { ...globalParishStyles, ...parishOverrides[id] };
        return { ...f, properties: { ...f.properties, id, color: styles.color, height: isometricMode ? (styles.visible ? styles.height : 0) : 0, opacity: styles.opacity } };
      });
      (map.getSource(PARISH_SRC_ID) as maplibregl.GeoJSONSource)?.setData(data);
      data.features.forEach(f => {
        const id = String(f.id ?? f.properties?.id);
        map.setFeatureState({ source: PARISH_SRC_ID, id }, { selected: selectedElement?.id === id });
      });
    }
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const tool = activeToolRef.current;
      if (tool !== "none") {
        const id = `${tool}_${Date.now()}`;
        if (tool === "marker") { setMarkers(prev => ({ ...prev, features: [...prev.features, { type: "Feature", id, geometry: { type: "Point", coordinates: [e.lngLat.lng, e.lngLat.lat] }, properties: { id, selected: false } }] })); }
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

  const updateSelectedParish = (u: Partial<ParishStyles>) => {
    if (selectedElement?.type === 'parish') setParishOverrides(p => ({ ...p, [selectedElement.id]: { ...p[selectedElement.id], ...u } }));
    else setGlobalParishStyles(p => ({ ...p, ...u }));
  };

  const currentConfig = selectedElement?.type === 'signal' ? {
    radius: Math.round((signals.find(s => s.id === selectedElement.id)?.radius || 0) * 1000),
    angle: signals.find(s => s.id === selectedElement.id)?.beamwidth || 360,
    azimuth: signals.find(s => s.id === selectedElement.id)?.azimuth || 0,
    color: signals.find(s => s.id === selectedElement.id)?.color || "#ffffff"
  } : config;

  const currentParish = selectedElement?.type === 'parish' ? { ...globalParishStyles, ...parishOverrides[selectedElement.id] } : globalParishStyles;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", height: "100vh", background: "#000" }}>
      <aside style={{ padding: "30px", borderRight: "1px solid rgba(255,255,255,0.1)", overflowY: "auto", display: "flex", flexDirection: "column", gap: "30px" }}>
        {/* Branding */}
        <div>
          <h1 style={{ fontSize: "18px", margin: 0, letterSpacing: "2px", textTransform: "uppercase" }}>PROYECTO GALILEO</h1>
          <div style={{ fontSize: "10px", opacity: 0.4, letterSpacing: "1px", marginTop: "4px" }} className="mono">BY JEAN CLAUDE</div>
        </div>

        {/* Global Actions */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => { localStorage.setItem("markers_fc", JSON.stringify(markers)); localStorage.setItem("signals_list", JSON.stringify(signals)); alert("SYSTEM SYNCED"); }} style={{ flex: 1 }}>SAVE SYSTEM</button>
          <Link href="/dashboard" style={{ flex: 1, textDecoration: "none" }}>
            <button className="secondary" style={{ width: "100%" }}>DASHBOARD</button>
          </Link>
          <button onClick={() => window.location.href = "/login"} className="secondary">EXIT</button>
        </div>

        {/* Dynamic Editor */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "20px" }}>
          <div style={{ fontSize: "10px", opacity: 0.5, marginBottom: "20px", letterSpacing: "1px" }} className="mono">
            {selectedElement ? `EDITING_${selectedElement.type.toUpperCase()}_${selectedElement.id.slice(-4)}` : "SYSTEM_CONFIGURATION"}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                <span>RANGE_SCALE</span>
                <span className="mono">{currentConfig.radius}M</span>
              </div>
              <input type="range" min="50" max="15000" step="50" value={currentConfig.radius} onChange={(e) => updateSelected({ radius: Number(e.target.value) })} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                <span>BEAM_WIDTH</span>
                <span className="mono">{currentConfig.angle}°</span>
              </div>
              <input type="range" min="10" max="360" step="10" value={currentConfig.angle} onChange={(e) => updateSelected({ angle: Number(e.target.value) })} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                <span>ORIENTATION</span>
                <span className="mono">{currentConfig.azimuth}°</span>
              </div>
              <input type="range" min="0" max="360" step="1" value={currentConfig.azimuth} onChange={(e) => updateSelected({ azimuth: Number(e.target.value) })} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px" }}>CHROMA_KEY</span>
              <input type="color" value={currentConfig.color} onChange={(e) => updateSelected({ color: e.target.value })} style={{ width: "30px", height: "30px", background: "none", border: "1px solid rgba(255,255,255,0.2)" }} />
            </div>

            {selectedElement && (selectedElement.type === 'signal' || selectedElement.type === 'marker') && (
              <button onClick={() => {
                if (selectedElement.type === 'signal') setSignals(prev => prev.filter(s => s.id !== selectedElement.id));
                else if (selectedElement.type === 'marker') setMarkers(prev => ({ ...prev, features: prev.features.filter(f => f.id !== selectedElement.id) }));
                setSelectedElement(null);
              }} style={{ marginTop: "10px", width: "100%", background: "rgba(255, 68, 68, 0.1)", border: "1px solid #ff444466", color: "#ff4444", fontSize: "11px" }}>
                ELIMINAR_ELEMENTO
              </button>
            )}
          </div>
        </div>

        {/* Toolset */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <button onClick={() => setActiveTool("marker")} className={activeTool === "marker" ? "" : "secondary"} style={{ fontSize: "11px" }}>POINT</button>
          <button onClick={() => setActiveTool("pulse")} className={activeTool === "pulse" ? "" : "secondary"} style={{ fontSize: "11px" }}>PULSE</button>
          <button onClick={() => setActiveTool("sector")} className={activeTool === "sector" ? "" : "secondary"} style={{ fontSize: "11px", gridColumn: "span 2" }}>SECTOR_BEAM</button>
        </div>

        {/* Environment Control */}
        <div style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "20px" }}>
          <div style={{ fontSize: "10px", opacity: 0.5, marginBottom: "15px", letterSpacing: "1px" }} className="mono">ENVIRONMENTAL_DATA</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button onClick={() => setIsometricMode(!isometricMode)} className="secondary" style={{ width: "100%", fontSize: "10px" }}>
              ISOMETRIC_MODE: {isometricMode ? "ON" : "OFF"}
            </button>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", opacity: 0.6 }} className="mono">
              <span>LAT: 8.5822</span>
              <span>LNG: -71.1505</span>
            </div>
          </div>
        </div>
      </aside>

      <main ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
