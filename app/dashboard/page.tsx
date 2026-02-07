"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

interface ParishStats {
    poblacion: number;
    area: number;
    densidad: number;
    metadata: string;
}

export default function DashboardPage() {
    const [parroquias, setParroquias] = useState<any[]>([]);
    const [selectedParishId, setSelectedParishId] = useState<string | null>(null);
    const [stats, setStats] = useState<Record<string, ParishStats>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load Parroquias
        fetch("/data/parroquias_libertador_14.geojson")
            .then(res => res.json())
            .then(data => {
                setParroquias(data.features);
                setLoading(false);
            });

        // Load Stats from Storage
        const saved = localStorage.getItem("parroquia_stats_galileo");
        if (saved) setStats(JSON.parse(saved));
    }, []);

    const selectedParish = useMemo(() =>
        parroquias.find(p => String(p.id ?? p.properties?.id) === selectedParishId),
        [parroquias, selectedParishId]);

    const currentStats = selectedParishId ? stats[selectedParishId] || { poblacion: 0, area: 0, densidad: 0, metadata: "" } : null;

    const handleSave = () => {
        localStorage.setItem("parroquia_stats_galileo", JSON.stringify(stats));
        alert("SYSTEM_DATA_SYNCED");
    };

    const updateStat = (field: keyof ParishStats, value: any) => {
        if (!selectedParishId) return;
        setStats(prev => ({
            ...prev,
            [selectedParishId]: { ... (prev[selectedParishId] || { poblacion: 0, area: 0, densidad: 0, metadata: "" }), [field]: value }
        }));
    };

    // --- 3D SVG Projection ---
    const render3DParish = () => {
        if (!selectedParish) return null;

        // Extract coordinates (simplified for first polygon/ring)
        let coords: [number, number][] = [];
        const geom = selectedParish.geometry;
        if (geom.type === "Polygon") coords = geom.coordinates[0];
        else if (geom.type === "MultiPolygon") coords = geom.coordinates[0][0];

        if (coords.length === 0) return <div>NO_GEOMETRY_DATA</div>;

        // Normalize coordinates for the SVG viewbox
        const lats = coords.map(c => c[1]);
        const lngs = coords.map(c => c[0]);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        const scale = 300 / Math.max(maxLng - minLng, maxLat - minLat);

        // Isometric projection helper
        const project = (lng: number, lat: number, z: number = 0) => {
            const x = (lng - minLng) * scale;
            const y = (maxLat - lat) * scale;
            // Simple isometric skew
            return {
                px: (x - y) * 0.866 + 200,
                py: (x + y) * 0.5 + 100 - z
            };
        };

        const height = 40; // 3D extrusion height
        const pointsTop = coords.map(c => project(c[0], c[1], height));
        const pointsBase = coords.map(c => project(c[0], c[1], 0));

        const pathTop = pointsTop.map(p => `${p.px},${p.py}`).join(" ");
        const pathBase = pointsBase.map(p => `${p.px},${p.py}`).join(" ");

        return (
            <svg viewBox="0 0 500 400" style={{ width: "100%", height: "100%", filter: "drop-shadow(0 20px 30px rgba(0,229,255,0.1))" }}>
                {/* Shadow */}
                <polygon points={pathBase} fill="rgba(0,0,0,0.5)" />

                {/* Sides (Connecting Base to Top) */}
                {pointsBase.map((p, i) => {
                    if (i === pointsBase.length - 1) return null;
                    const nextIdx = i + 1;
                    const sidePoints = `${p.px},${p.py} ${pointsBase[nextIdx].px},${pointsBase[nextIdx].py} ${pointsTop[nextIdx].px},${pointsTop[nextIdx].py} ${pointsTop[i].px},${pointsTop[i].py}`;
                    return <polygon key={i} points={sidePoints} fill={`rgba(255,255,255,${0.05 + (i % 5) * 0.02})`} stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />;
                })}

                {/* Top Face */}
                <polygon points={pathTop} fill="rgba(255,255,255,0.05)" stroke="#fff" strokeWidth="1" />
            </svg>
        );
    };

    return (
        <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", height: "100vh", background: "#000", color: "#fff" }}>
            {/* Sidebar: Selection */}
            <aside style={{ padding: "30px", borderRight: "1px solid rgba(255,255,255,0.1)", overflowY: "auto" }}>
                <div style={{ marginBottom: "40px" }}>
                    <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "10px", opacity: 0.5 }} className="mono">← BACK_TO_ATLAS</Link>
                    <h1 style={{ fontSize: "20px", marginTop: "10px", letterSpacing: "2px" }}>GALILEO_DASHBOARD</h1>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ fontSize: "10px", opacity: 0.5, marginBottom: "10px" }} className="mono">SELECT_GEO_UNIT</div>
                    {loading ? <div>LOADING_RESOURCES...</div> : parroquias.map(p => {
                        const id = String(p.id ?? p.properties?.id);
                        return (
                            <button
                                key={id}
                                onClick={() => setSelectedParishId(id)}
                                className={selectedParishId === id ? "" : "secondary"}
                                style={{ textAlign: "left", fontSize: "11px", letterSpacing: "1px" }}
                            >
                                {p.properties?.name_full?.toUpperCase() || `PARROQUIA_${id}`}
                            </button>
                        );
                    })}
                </div>
            </aside>

            {/* Main Content: 3D View & Data */}
            <main style={{ display: "grid", gridTemplateRows: "1fr 300px", padding: "40px", gap: "40px", overflow: "hidden" }}>
                {selectedParishId ? (
                    <>
                        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px" }}>
                            {/* 3D Visualization */}
                            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <div style={{ position: "absolute", top: "20px", left: "20px", fontSize: "10px", opacity: 0.5 }} className="mono">ISOMETRIC_3D_RENDER</div>
                                {render3DParish()}
                            </div>

                            {/* Parish Details Form */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
                                <div style={{ fontSize: "12px", opacity: 0.5 }} className="mono">SYSTEM_DATA_ENTRY</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        <label style={{ fontSize: "10px", opacity: 0.5 }} className="mono">POBLACIÓN_ACTIVA</label>
                                        <input type="number" value={currentStats?.poblacion || 0} onChange={(e) => updateStat("poblacion", Number(e.target.value))} />
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        <label style={{ fontSize: "10px", opacity: 0.5 }} className="mono">ÁREA_TOTAL (KM2)</label>
                                        <input type="number" value={currentStats?.area || 0} onChange={(e) => updateStat("area", Number(e.target.value))} />
                                    </div>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    <label style={{ fontSize: "10px", opacity: 0.5 }} className="mono">METADATA_EXTENDIDA</label>
                                    <textarea
                                        value={currentStats?.metadata || ""}
                                        onChange={(e) => updateStat("metadata", e.target.value)}
                                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "12px", fontFamily: "inherit", height: "100px", outline: "none" }}
                                    />
                                </div>
                                <button onClick={handleSave} style={{ alignSelf: "flex-start" }}>COMMIT_CHANGES</button>
                            </div>
                        </section>

                        {/* Bottom: Analysis Console */}
                        <section style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)", padding: "30px", overflowY: "auto" }}>
                            <div style={{ fontSize: "10px", opacity: 0.5, marginBottom: "20px" }} className="mono">ANALYTICS_CONSOLE</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "30px" }}>
                                <div style={{ borderLeft: "2px solid #fff", paddingLeft: "15px" }}>
                                    <div style={{ fontSize: "10px", opacity: 0.6 }} className="mono">EST_DENSITY</div>
                                    <div style={{ fontSize: "24px", fontWeight: "bold", marginTop: "5px" }}>
                                        {currentStats?.area ? (currentStats.poblacion / currentStats.area).toFixed(2) : "0.00"}
                                    </div>
                                    <div style={{ fontSize: "9px", opacity: 0.4 }}>P/KM2</div>
                                </div>
                                {/* Placeholder for more stats */}
                                <div style={{ borderLeft: "2px solid rgba(255,255,255,0.2)", paddingLeft: "15px" }}>
                                    <div style={{ fontSize: "10px", opacity: 0.6 }} className="mono">SIGNAL_INTERFERENCE</div>
                                    <div style={{ fontSize: "24px", fontWeight: "bold", marginTop: "5px", opacity: 0.3 }}>LOW</div>
                                </div>
                                <div style={{ borderLeft: "2px solid rgba(255,255,255,0.2)", paddingLeft: "15px" }}>
                                    <div style={{ fontSize: "10px", opacity: 0.6 }} className="mono">UPLINK_STABILITY</div>
                                    <div style={{ fontSize: "24px", fontWeight: "bold", marginTop: "5px", opacity: 0.3 }}>99.8%</div>
                                </div>
                            </div>
                        </section>
                    </>
                ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", border: "1px dashed rgba(255,255,255,0.1)" }}>
                        <div style={{ textAlign: "center", opacity: 0.4 }}>
                            <div style={{ fontSize: "40px", marginBottom: "20px" }}>⚡</div>
                            <div className="mono">AWAITING_GEOGRAPHIC_SELECTION</div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
