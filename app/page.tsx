"use client";

import maplibregl, { Map, Popup } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import * as turf from "@turf/turf";

type FC = GeoJSON.FeatureCollection<GeoJSON.Geometry>;
type PointFC = GeoJSON.FeatureCollection<GeoJSON.Point>;

// --- Constants ---
const PARISH_SRC_ID = "parroquias";
const PARISH_FILL_ID = "parroquias-fill";
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
  onlyOutline: boolean;
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

  const [config, setConfig] = useState({
    radius: 500,
    angle: 360,
    azimuth: 0,
    color: "#00e5ff",
  });

  const [globalParishStyles, setGlobalParishStyles] = useState<ParishStyles>({
    visible: true,
    opacity: 0.15,
    color: "#ffffff",
    onlyOutline: false,
  });

  const animationFrameRef = useRef<number | undefined>(undefined);

  // Refs for map listeners to avoid closure bugs
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

          // --- Markers ---
          map.addSource(MARKERS_SRC_ID, { type: "geojson", data: markers });
          map.addLayer({
            id: MARKERS_LAYER_ID,
            type: "circle",
            source: MARKERS_SRC_ID,
            paint: {
              "circle-radius": ["case", ["==", ["get", "selected"], true], 8, 5],
              "circle-color": "#00e5ff",
              "circle-stroke-color": "#fff",
              "circle-stroke-width": ["case", ["==", ["get", "selected"], true], 2, 0],
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
              "circle-radius": ["case", ["==", ["get", "selected"], true], 7, 4],
              "circle-color": ["get", "color"],
              "circle-stroke-color": ["case", ["==", ["get", "selected"], true], "#fff", "#000"],
              "circle-stroke-width": 2,
            },
          });

          map.addSource(SIGNALS_WAVE_SRC_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: SIGNALS_WAVE_ID, type: "fill", source: SIGNALS_WAVE_SRC_ID, paint: { "fill-color": ["get", "color"], "fill-opacity": 0.2 } });

          // Interactive Hover
          map.on("mousemove", PARISH_FILL_ID, (e) => {
            const f = e.features?.[0];
            if (!f) return;
            popupRef.current!.setLngLat(e.lngLat).setHTML(`<div style="font-size:12px">${f.properties?.name_full}</div>`).addTo(map);
          });
          map.on("mouseleave", PARISH_FILL_ID, () => { popupRef.current?.remove(); });
        });
      });

    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // Central Click Listener (Selection + Placement)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const tool = activeToolRef.current;

      // 1. Placement logic
      if (tool !== "none") {
        const id = `${tool}_${Date.now()}`;
        if (tool === "marker") {
          const newF: GeoJSON.Feature<GeoJSON.Point> = {
            type: "Feature",
            id,
            geometry: { type: "Point", coordinates: [e.lngLat.lng, e.lngLat.lat] },
            properties: { id, selected: false }
          };
          setMarkers(prev => ({ ...prev, features: [...prev.features, newF] }));
        } else {
          const newS: Signal = {
            id,
            type: tool,
            lngLat: [e.lngLat.lng, e.lngLat.lat],
            radius: config.radius / 1000,
            azimuth: config.azimuth,
            beamwidth: tool === "pulse" ? 360 : config.angle,
            color: config.color,
          };
          setSignals(prev => [...prev, newS]);
        }
        setActiveTool("none");
        setSelectedElement({ id, type: tool === "marker" ? "marker" : "signal" });
        return;
      }

      // 2. Selection logic
      const features = map.queryRenderedFeatures(e.point, { layers: [SIGNALS_CENTER_ID, MARKERS_LAYER_ID, PARISH_FILL_ID] });
      if (features.length === 0) {
        setSelectedElement(null);
        return;
      }

      const signal = features.find(f => f.layer.id === SIGNALS_CENTER_ID);
      const marker = features.find(f => f.layer.id === MARKERS_LAYER_ID);
      const parish = features.find(f => f.layer.id === PARISH_FILL_ID);

      if (signal) {
        setSelectedElement({ id: String(signal.properties?.id), type: "signal" });
      } else if (marker) {
        setSelectedElement({ id: String(marker.properties?.id), type: "marker" });
      } else if (parish) {
        setSelectedElement({ id: String(parish.id ?? parish.properties?.id), type: "parish" });
      }
    };

    map.on("click", handleClick);
    return () => { map.off("click", handleClick); };
  }, [config]); // config needed for placement fresh values

  // --- Syncing Sources ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Signals
    const sigSrc = map.getSource(SIGNALS_SRC_ID) as maplibregl.GeoJSONSource;
    if (sigSrc) {
      const sectors = signals.map(s => turf.sector(s.lngLat, s.radius || 0.5, (s.azimuth || 0) - ((s.beamwidth || 0) / 2), (s.azimuth || 0) + ((s.beamwidth || 0) / 2), { properties: { id: s.id, color: s.color, selected: selectedElement?.id === s.id } }));
      const centers = signals.map(s => turf.point(s.lngLat, { id: s.id, color: s.color, selected: selectedElement?.id === s.id }));
      sigSrc.setData({ type: "FeatureCollection", features: [...sectors, ...centers] });
    }

    // Markers
    const markSrc = map.getSource(MARKERS_SRC_ID) as maplibregl.GeoJSONSource;
    if (markSrc) {
      const bakedMarkers = { ...markers, features: markers.features.map(f => ({ ...f, properties: { ...f.properties, selected: selectedElement?.id === f.id } })) };
      markSrc.setData(bakedMarkers);
    }

    // Parishes
    const parSrc = map.getSource(PARISH_SRC_ID) as maplibregl.GeoJSONSource;
    if (parSrc) {
      fetch("/data/parroquias_libertador_14.geojson").then(r => r.json()).then((data: FC) => {
        data.features.forEach(f => {
          const id = String(f.id ?? f.properties?.id);
          const styles = { ...globalParishStyles, ...parishOverrides[id] };
          f.properties = { ...f.properties, id, color: styles.color, opacity: styles.visible ? (styles.onlyOutline ? 0 : styles.opacity) : 0 };
          map.setFeatureState({ source: PARISH_SRC_ID, id }, { selected: selectedElement?.id === id });
        });
        parSrc.setData(data);
      });
    }
  }, [signals, markers, parishOverrides, globalParishStyles, selectedElement]);

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
      if (map.getLayer(SIGNALS_WAVE_ID)) map.setPaintProperty(SIGNALS_WAVE_ID, 'fill-opacity', 0.4 * (1 - progress));
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameRef.current!);
  }, [signals]);

  // Save Function
  const handleSave = () => {
    localStorage.setItem("markers_fc", JSON.stringify(markers));
    localStorage.setItem("signals_list", JSON.stringify(signals));
    localStorage.setItem("parish_overrides", JSON.stringify(parishOverrides));
    alert("Mapa guardado exitosamente!");
  };

  const updateSelected = (updates: Partial<typeof config>) => {
    if (selectedElement?.type === 'signal') {
      setSignals(prev => prev.map(s => s.id === selectedElement.id ? { ...s, ...updates, radius: updates.radius !== undefined ? updates.radius / 1000 : s.radius, beamwidth: updates.angle !== undefined ? updates.angle : s.beamwidth } : s));
    } else setConfig({ ...config, ...updates });
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
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", height: "100vh" }}>
      <aside style={{ padding: 14, borderRight: "1px solid rgba(255,255,255,0.08)", overflowY: "auto", background: "#050b12" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Mapas Netlink</h2>

        <div style={{ marginTop: 15, display: "flex", gap: 8 }}>
          <button onClick={handleSave} style={{ flex: 1, background: "#00e5ff", color: "#000", fontWeight: "bold" }}>Guardar Mapa</button>
          <button onClick={() => { setMarkers({ type: "FeatureCollection", features: [] }); setSignals([]); setParishOverrides({}); }} style={{ flex: 1, borderColor: "#ff4444", color: "#ff4444" }}>Limpiar</button>
        </div>

        {selectedElement && (
          <div style={{ marginTop: 15, padding: 10, background: "#00e5ff1a", borderRadius: 8, border: "1px solid #00e5ff44" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12 }}>Editando: <b>{selectedElement.type.toUpperCase()}</b></span>
              <button onClick={() => setSelectedElement(null)} style={{ padding: '2px 8px', fontSize: 10 }}>Cerrar</button>
            </div>
            <button onClick={() => {
              if (selectedElement.type === 'signal') setSignals(prev => prev.filter(s => s.id !== selectedElement.id));
              else if (selectedElement.type === 'marker') setMarkers(prev => ({ ...prev, features: prev.features.filter(f => f.id !== selectedElement.id) }));
              setSelectedElement(null);
            }} style={{ marginTop: 8, width: '100%', fontSize: 11, color: '#ff4444' }}>Eliminar Elemento</button>
          </div>
        )}

        <div style={{ marginTop: 20, padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
          <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 16, fontWeight: 700 }}>CONFIGURACIÓN</div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}><label>Radio</label><span>{currentConfig.radius} m</span></div>
            <input type="range" min="50" max="15000" step="50" value={currentConfig.radius} onChange={(e) => updateSelected({ radius: Number(e.target.value) })} style={{ width: "100%" }} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}><label>Apertura</label><span>{currentConfig.angle}°</span></div>
            <input type="range" min="10" max="360" step="10" value={currentConfig.angle} onChange={(e) => updateSelected({ angle: Number(e.target.value) })} style={{ width: "100%" }} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}><label>Dirección</label><span>{currentConfig.azimuth}°</span></div>
            <input type="range" min="0" max="360" step="1" value={currentConfig.azimuth} onChange={(e) => updateSelected({ azimuth: Number(e.target.value) })} style={{ width: "100%" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontSize: 13 }}>Color</label>
            <input type="color" value={currentConfig.color} onChange={(e) => updateSelected({ color: e.target.value })} style={{ border: "none", width: 30, height: 30, background: 'none' }} />
          </div>
        </div>

        <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button onClick={() => setActiveTool("marker")} style={{ flex: "1 1 45%", background: activeTool === "marker" ? "#00e5ff" : '', color: activeTool === "marker" ? '#000' : '' }}>Punto</button>
          <button onClick={() => setActiveTool("pulse")} style={{ flex: "1 1 45%", background: activeTool === "pulse" ? "#00e5ff" : '', color: activeTool === "pulse" ? '#000' : '' }}>Pulso</button>
          <button onClick={() => setActiveTool("sector")} style={{ flex: "1 1 100%", background: activeTool === "sector" ? "#00e5ff" : '', color: activeTool === "sector" ? '#000' : '' }}>Sector</button>
        </div>

        <div style={{ marginTop: 24, padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
          <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 16, fontWeight: 700 }}>PARROQUIAS</div>
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
