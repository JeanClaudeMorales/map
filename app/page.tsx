"use client";

import maplibregl, { Map, Popup, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import * as turf from "@turf/turf";

type FC = GeoJSON.FeatureCollection<GeoJSON.Geometry>;

// --- Constants ---
const PARISH_SRC_ID = "parroquias";
const PARISH_FILL_ID = "parroquias-fill";
const PARISH_LINE_ID = "parroquias-line";

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
    azimuth: 0, // degrees (North)
    color: "#00e5ff", // hex
  });

  // Parish Styles State
  const [parishStyles, setParishStyles] = useState({
    visible: true,
    opacity: 0.15,
    color: "#ffffff",
    onlyOutline: false,
  });

  // Animation Refs
  const animationFrameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const saved = loadMarkers();
    setMarkers(saved);

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
              layout: { visibility: "visible" },
              paint: {
                "fill-color": parishStyles.color,
                "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.3, parishStyles.opacity],
              },
            });
            map.addLayer({
              id: PARISH_LINE_ID,
              type: "line",
              source: PARISH_SRC_ID,
              paint: {
                "line-color": "#ffffff",
                "line-opacity": 0.8,
                "line-width": 1,
              },
            });
          } catch (e) {
            console.error("Failed to load parroquias", e);
          }

          // --- Markers ---
          map.addSource(MARKERS_SRC_ID, { type: "geojson", data: saved });
          map.addLayer({
            id: MARKERS_LAYER_ID,
            type: "circle",
            source: MARKERS_SRC_ID,
            paint: {
              "circle-radius": 5,
              "circle-color": "#00e5ff",
              "circle-opacity": 0.8,
            },
          });

          // --- Signals Coverage ---
          map.addSource(SIGNALS_SRC_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({
            id: SIGNALS_LAYER_ID,
            type: "fill",
            source: SIGNALS_SRC_ID,
            paint: {
              "fill-color": ["get", "color"],
              "fill-opacity": 0.3,
            },
          });

          // --- Signals Center Points ---
          map.addLayer({
            id: SIGNALS_CENTER_ID,
            type: "circle",
            source: SIGNALS_SRC_ID,
            filter: ["==", "$type", "Point"],
            paint: {
              "circle-radius": 3,
              "circle-color": ["get", "color"],
              "circle-opacity": 1,
              "circle-stroke-color": "#000",
              "circle-stroke-width": 1,
            },
          });

          // --- Signals Wave (Radar) ---
          map.addSource(SIGNALS_WAVE_SRC_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({
            id: SIGNALS_WAVE_ID,
            type: "fill",
            source: SIGNALS_WAVE_SRC_ID,
            paint: {
              "fill-color": ["get", "color"],
              "fill-opacity": 0.2, // Will be animated
            },
          });

          // --- Interaction ---
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
  }, []);

  // Sync Parish Styles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    map.setLayoutProperty(PARISH_FILL_ID, "visibility", parishStyles.visible ? "visible" : "none");
    map.setLayoutProperty(PARISH_LINE_ID, "visibility", parishStyles.visible ? "visible" : "none");

    const opacity = parishStyles.onlyOutline ? 0 : parishStyles.opacity;
    map.setPaintProperty(PARISH_FILL_ID, "fill-opacity", [
      "case",
      ["boolean", ["feature-state", "hover"], false],
      0.3,
      opacity,
    ]);
    map.setPaintProperty(PARISH_FILL_ID, "fill-color", parishStyles.color);
  }, [parishStyles]);

  // Handle Signal Creation
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (activeTool === "none") return;
      const { lng, lat } = e.lngLat;
      const id = `s_${Date.now()}`;
      const radiusKm = config.radius / 1000;

      const newSignal: Signal = {
        id,
        type: activeTool,
        lngLat: [lng, lat],
        radius: radiusKm,
        azimuth: config.azimuth,
        beamwidth: activeTool === "pulse" ? 360 : config.angle,
        color: config.color,
      };

      setSignals((prev) => {
        const next = [...prev, newSignal];
        updateSignalsSource(map, next);
        return next;
      });
      setActiveTool("none");
    };

    map.on("click", onClick);
    return () => { map.off("click", onClick); };
  }, [activeTool, config]);

  // Update Main Signals Source
  function updateSignalsSource(map: Map, signalsList: Signal[]) {
    // 1. Coverage Polygons (Static)
    const sectors = signalsList.map((s) => {
      const b1 = s.azimuth! - (s.beamwidth! / 2);
      const b2 = s.azimuth! + (s.beamwidth! / 2);
      return turf.sector(s.lngLat, s.radius!, b1, b2, {
        properties: { id: s.id, color: s.color },
      });
    });

    // 2. Center Points
    const centers = signalsList.map((s) => turf.point(s.lngLat, { id: s.id, color: s.color }));

    (map.getSource(SIGNALS_SRC_ID) as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: [...sectors, ...centers],
    });
  }

  // Radar Animation Loop
  useEffect(() => {
    const animate = () => {
      const map = mapRef.current;
      if (!map || signals.length === 0) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const timestamp = Date.now();
      const cycle = 3000; // 3 seconds per radar sweep
      const progress = (timestamp % cycle) / cycle; // 0 to 1

      // Expanding Wave Geometries
      const waves = signals.map((s) => {
        const waveRadius = Math.max(0.001, s.radius! * progress);
        const b1 = s.azimuth! - (s.beamwidth! / 2);
        const b2 = s.azimuth! + (s.beamwidth! / 2);

        let geometry;
        if (s.beamwidth === 360) {
          geometry = turf.circle(s.lngLat, waveRadius, { steps: 64 });
        } else {
          geometry = turf.sector(s.lngLat, waveRadius, b1, b2);
        }

        return {
          ...geometry,
          properties: { id: s.id, color: s.color },
        };
      });

      // Update Wave Source
      (map.getSource(SIGNALS_WAVE_SRC_ID) as maplibregl.GeoJSONSource)?.setData({
        type: "FeatureCollection",
        features: waves as any,
      });

      // Update Wave Opacity (Fades out as it expands)
      const waveOpacity = 0.5 * (1 - progress);
      if (map.getLayer(SIGNALS_WAVE_ID)) {
        map.setPaintProperty(SIGNALS_WAVE_ID, 'fill-opacity', waveOpacity);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameRef.current!);
  }, [signals]);

  function clearMarkers() {
    setMarkers({ type: "FeatureCollection", features: [] });
    saveMarkers({ type: "FeatureCollection", features: [] });
    (mapRef.current?.getSource(MARKERS_SRC_ID) as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: [] });
    setSignals([]);
    (mapRef.current?.getSource(SIGNALS_SRC_ID) as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: [] });
    (mapRef.current?.getSource(SIGNALS_WAVE_SRC_ID) as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: [] });
  }

  const toggleTool = (tool: "pulse" | "sector") => {
    if (activeTool === tool) setActiveTool("none");
    else {
      setActiveTool(tool);
      if (tool === "pulse") setConfig(c => ({ ...c, angle: 360 }));
      else if (tool === "sector") setConfig(c => ({ ...c, angle: 60 }));
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", height: "100vh" }}>
      <aside style={{ padding: 14, borderRight: "1px solid rgba(255,255,255,0.08)", overflowY: "auto", background: "#050b12" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Libertador / Mérida</h2>
        <p style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>Sistema de Gestión de Redes</p>

        {/* Signals Configuration */}
        <div style={{ marginTop: 20, padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Configuración de Señal</div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ fontSize: 13 }}>Radio</label>
              <span style={{ fontSize: 13, opacity: 0.7 }}>{config.radius} m</span>
            </div>
            <input type="range" min="50" max="10000" step="50" value={config.radius} onChange={(e) => setConfig({ ...config, radius: Number(e.target.value) })} style={{ width: "100%" }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ fontSize: 13 }}>Apertura</label>
              <span style={{ fontSize: 13, opacity: 0.7 }}>{config.angle}°</span>
            </div>
            <input type="range" min="10" max="360" step="10" value={config.angle} onChange={(e) => setConfig({ ...config, angle: Number(e.target.value) })} style={{ width: "100%" }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ fontSize: 13 }}>Azimut (Orientación)</label>
              <span style={{ fontSize: 13, opacity: 0.7 }}>{config.azimuth}°</span>
            </div>
            <input type="range" min="0" max="360" step="5" value={config.azimuth} onChange={(e) => setConfig({ ...config, azimuth: Number(e.target.value) })} style={{ width: "100%" }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontSize: 13 }}>Color</label>
            <input type="color" value={config.color} onChange={(e) => setConfig({ ...config, color: e.target.value })} style={{ border: "none", width: 24, height: 24, padding: 0, background: "none", cursor: "pointer" }} />
          </div>
        </div>

        {/* Signal Tools */}
        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <button onClick={() => toggleTool("pulse")} style={{ flex: 1, background: activeTool === "pulse" ? config.color : undefined, color: activeTool === "pulse" ? "#000" : undefined, borderColor: activeTool === "pulse" ? config.color : undefined }}>
            Pulso / Omni
          </button>
          <button onClick={() => toggleTool("sector")} style={{ flex: 1, background: activeTool === "sector" ? config.color : undefined, color: activeTool === "sector" ? "#000" : undefined, borderColor: activeTool === "sector" ? config.color : undefined }}>
            Sector
          </button>
        </div>

        {/* Parish Styling */}
        <div style={{ marginTop: 24, padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Estilos de Parroquias</div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <label style={{ fontSize: 13 }}>Visibilidad</label>
            <input type="checkbox" checked={parishStyles.visible} onChange={(e) => setParishStyles({ ...parishStyles, visible: e.target.checked })} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ fontSize: 13 }}>Opacidad Relleno</label>
              <span style={{ fontSize: 13, opacity: 0.7 }}>{Math.round(parishStyles.opacity * 100)}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" value={parishStyles.opacity} onChange={(e) => setParishStyles({ ...parishStyles, opacity: Number(e.target.value) })} style={{ width: "100%" }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <label style={{ fontSize: 13 }}>Color Relleno</label>
            <input type="color" value={parishStyles.color} onChange={(e) => setParishStyles({ ...parishStyles, color: e.target.value })} style={{ border: "none", width: 24, height: 24, padding: 0, background: "none", cursor: "pointer" }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontSize: 13 }}>Sólo Delimitación</label>
            <input type="checkbox" checked={parishStyles.onlyOutline} onChange={(e) => setParishStyles({ ...parishStyles, onlyOutline: e.target.checked })} />
          </div>
        </div>

        <button onClick={clearMarkers} style={{ marginTop: 24, width: "100%", borderColor: "#ff4444", color: "#ff4444", opacity: 0.8 }}>Limpiar Todo</button>
      </aside>

      <main ref={containerRef} style={{ width: "100%", height: "100%", background: "#0e0e0e" }} />
    </div>
  );
}
