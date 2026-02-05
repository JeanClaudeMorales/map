"use client";

import maplibregl, { Map, Popup } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

type FC = GeoJSON.FeatureCollection<GeoJSON.Geometry>;

const PARISH_SRC_ID = "parroquias";
const PARISH_FILL_ID = "parroquias-fill";
const PARISH_LINE_ID = "parroquias-line";

const MARKERS_SRC_ID = "markers";
const MARKERS_LAYER_ID = "markers-layer";

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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const saved = loadMarkers();
    setMarkers(saved);

    const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    if (!key) {
      alert("Falta NEXT_PUBLIC_MAPTILER_KEY en .env.local");
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: `https://api.maptiler.com/maps/dataviz/style.json?key=${key}`,
      center: [-71.1505, 8.582],
      zoom: 12.6,
    });

    mapRef.current = map;
    popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    let hoveredId: string | number | null = null;

    map.on("load", async () => {
      // Parroquias (14 por ahora)
      const res = await fetch("/data/parroquias_libertador_14.geojson");
      const parroquias = (await res.json()) as FC;

      map.addSource(PARISH_SRC_ID, {
        type: "geojson",
        data: parroquias,
        promoteId: "id", // usa properties.id como feature id
      } as any);

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

      // Markers
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

      // Hover parroquia
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
        popupRef.current!
          .setLngLat(e.lngLat)
          .setHTML(`<div style="font-family:system-ui;font-size:12px">${name}</div>`)
          .addTo(map);
      });

      map.on("mouseleave", PARISH_FILL_ID, () => {
        map.getCanvas().style.cursor = "";
        popupRef.current?.remove();
        if (hoveredId !== null) {
          map.setFeatureState({ source: PARISH_SRC_ID, id: hoveredId }, { hover: false });
        }
        hoveredId = null;
      });

      // Click parroquia -> panel
      map.on("click", PARISH_FILL_ID, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        setSelectedParish({
          id: (f.properties as any)?.id ?? (f.id as any),
          name: (f.properties as any)?.name ?? "",
          name_full: (f.properties as any)?.name_full ?? (f.properties as any)?.name ?? "",
        });
      });

      // Click mapa -> crear marker
      map.on("click", (e) => {
        const feature: GeoJSON.Feature<GeoJSON.Point> = {
          type: "Feature",
          geometry: { type: "Point", coordinates: [e.lngLat.lng, e.lngLat.lat] },
          properties: {
            id: `m_${Date.now()}`,
            title: "Marker",
            created_at: new Date().toISOString(),
            parish_id: selectedParish?.id ?? null,
          },
        };

        setMarkers((prev) => {
          const next = { ...prev, features: [...prev.features, feature] };
          saveMarkers(next);
          const src = map.getSource(MARKERS_SRC_ID) as maplibregl.GeoJSONSource;
          src.setData(next);
          return next;
        });
      });
    });

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [selectedParish?.id]);

  function clearMarkers() {
    const empty: GeoJSON.FeatureCollection<GeoJSON.Point> = { type: "FeatureCollection", features: [] };
    setMarkers(empty);
    saveMarkers(empty);
    const map = mapRef.current;
    if (map && map.getSource(MARKERS_SRC_ID)) {
      (map.getSource(MARKERS_SRC_ID) as maplibregl.GeoJSONSource).setData(empty);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", height: "100vh" }}>
      <aside style={{ padding: 14, borderRight: "1px solid rgba(255,255,255,0.08)" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Libertador / Mérida</h2>
        <p style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
          Hover para ver nombres. Click para seleccionar parroquia. Click en el mapa para crear marcadores.
        </p>

        <div style={{ marginTop: 12, padding: 10, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 }}>
          <div style={{ fontSize: 13, opacity: 0.8 }}>Parroquia seleccionada</div>
          <div style={{ marginTop: 6, fontSize: 14 }}>{selectedParish?.name_full ?? "—"}</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>ID: {selectedParish?.id ?? "—"}</div>
        </div>

        <div style={{ marginTop: 12, padding: 10, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, opacity: 0.8 }}>Marcadores</div>
            <button onClick={clearMarkers}>Limpiar</button>
          </div>
          <div style={{ marginTop: 8, fontSize: 13 }}>Total: {markers.features.length}</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            Tip: selecciona una parroquia antes de crear markers para guardar parish_id.
          </div>
        </div>

        <div style={{ marginTop: 12, opacity: 0.7, fontSize: 12 }}>
          Próximo: radios de cobertura + líneas, y luego PostGIS. Domingo Peña se agrega después como Feature extra.
        </div>
      </aside>

      <main ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
