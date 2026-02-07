"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

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
        fetch("/data/parroquias_libertador_14.geojson")
            .then(res => res.json())
            .then(data => {
                setParroquias(data.features || []);
                setLoading(false);
            });

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

    const render3DParish = () => {
        if (!selectedParish) return null;

        let coords: [number, number][] = [];
        const geom = selectedParish.geometry;
        if (geom.type === "Polygon") coords = geom.coordinates[0];
        else if (geom.type === "MultiPolygon") coords = geom.coordinates[0][0];

        if (!coords || coords.length === 0) return <div className="mono">NO_GEOMETRY</div>;

        const lats = coords.map(c => c[1]);
        const lngs = coords.map(c => c[0]);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        const scale = 360 / Math.max(maxLng - minLng, maxLat - minLat || 0.0000001);

        const project = (lng: number, lat: number, z: number = 0) => {
            const x = (lng - minLng) * scale;
            const y = (maxLat - lat) * scale;
            return {
                px: (x - y) * 0.866 + 250,
                py: (x + y) * 0.5 + 100 - z
            };
        };

        const height = 50;
        const pointsTop = coords.map(c => project(c[0], c[1], height));
        const pointsBase = coords.map(c => project(c[0], c[1], 0));

        const pathTop = pointsTop.map(p => `${p.px},${p.py}`).join(" ");
        const pathBase = pointsBase.map(p => `${p.px},${p.py}`).join(" ");

        return (
            <motion.svg
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                viewBox="0 0 500 450"
                style={{ width: "100%", height: "100%", filter: "drop-shadow(0 40px 60px rgba(127,102,255,0.15))" }}
            >
                <defs>
                    <linearGradient id="wallGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgba(127,102,255,0.3)" />
                        <stop offset="100%" stopColor="rgba(127,102,255,0.02)" />
                    </linearGradient>
                    <linearGradient id="topGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(110,90,255,0.2)" />
                        <stop offset="100%" stopColor="rgba(150,130,255,0.1)" />
                    </linearGradient>
                </defs>
                <polygon points={pathBase} fill="rgba(0,0,0,0.4)" filter="blur(4px)" />
                {pointsBase.map((p, i) => {
                    if (i === pointsBase.length - 1) return null;
                    const n = i + 1;
                    const side = `${p.px},${p.py} ${pointsBase[n].px},${pointsBase[n].py} ${pointsTop[n].px},${pointsTop[n].py} ${pointsTop[i].px},${pointsTop[i].py}`;
                    return <polygon key={i} points={side} fill="url(#wallGrad)" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />;
                })}
                <polygon points={pathTop} fill="url(#topGrad)" stroke="var(--accent-purple)" strokeWidth="1.5" />
            </motion.svg>
        );
    };

    return (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", height: "100vh", background: "var(--bg-deep)", color: "var(--text-main)" }}>
            <aside className="glass-card" style={{ margin: "20px", padding: "30px", display: "flex", flexDirection: "column", gap: "30px", borderRadius: "20px" }}>
                <div>
                    <Link href="/" style={{ color: "var(--accent-purple)", textDecoration: "none", fontSize: "10px", fontWeight: "bold" }} className="mono">← RET_ATLAS_CORE</Link>
                    <h1 style={{ fontSize: "24px", marginTop: "12px" }}>GALILEO_DB</h1>
                    <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "4px" }} className="mono">SPACIAL_ANALYTICS_V2.5</div>
                </div>
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {loading ? <div className="mono">LOADING...</div> : parroquias.map(p => {
                        const id = String(p.id ?? p.properties?.id);
                        const active = selectedParishId === id;
                        return (
                            <motion.button
                                whileHover={{ x: 5 }}
                                key={id}
                                onClick={() => setSelectedParishId(id)}
                                className={active ? "" : "secondary"}
                                style={{ textAlign: "left", fontSize: "11px", padding: "12px 16px", borderColor: active ? "var(--accent-purple)" : "transparent" }}
                            >
                                {p.properties?.name_full?.toUpperCase() || `ENTITY_${id}`}
                            </motion.button>
                        );
                    })}
                </div>
            </aside>

            <main style={{ padding: "20px", display: "grid", gridTemplateRows: "1fr auto", gap: "20px", overflow: "hidden" }}>
                <AnimatePresence mode="wait">
                    {selectedParishId ? (
                        <motion.div key={selectedParishId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "20px" }}>
                            <div className="glass-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                                <div style={{ position: "absolute", top: "30px", left: "30px" }}>
                                    <h2 style={{ fontSize: "14px", color: "var(--accent-purple)" }} className="mono">ISOMETRIC_GEOMETRY</h2>
                                    <div style={{ fontSize: "32px", fontWeight: "900", letterSpacing: "-0.05em" }}>{selectedParish?.properties?.name_full?.toUpperCase()}</div>
                                </div>
                                <div style={{ width: "80%", height: "80%" }}>
                                    {render3DParish()}
                                </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                <div className="glass-card" style={{ padding: "30px", flex: 1 }}>
                                    <div style={{ fontSize: "10px", color: "var(--text-dim)", marginBottom: "25px" }} className="mono">ENTITY_PARAMETER_BYPASS</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                        <div className="flex-col gap-sm">
                                            <label className="mono" style={{ fontSize: "10px" }}>ACTIVE_POPULATION</label>
                                            <input type="number" value={currentStats?.poblacion || 0} onChange={(e) => updateStat("poblacion", Number(e.target.value))} />
                                        </div>
                                        <div className="flex-col gap-sm">
                                            <label className="mono" style={{ fontSize: "10px" }}>SURFACE_AREA_KM2</label>
                                            <input type="number" value={currentStats?.area || 0} onChange={(e) => updateStat("area", Number(e.target.value))} />
                                        </div>
                                        <div className="flex-col gap-sm">
                                            <label className="mono" style={{ fontSize: "10px" }}>GEO_METADATA</label>
                                            <textarea
                                                value={currentStats?.metadata || ""}
                                                onChange={(e) => updateStat("metadata", e.target.value)}
                                                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "#fff", padding: "16px", borderRadius: "12px", height: "120px", outline: "none" }}
                                            />
                                        </div>
                                        <button onClick={handleSave} style={{ alignSelf: "flex-start", marginTop: "10px" }}>SYNC_DATA</button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="glass-card mono" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "var(--text-dim)" }}>
                            AWAITING_INPUT_SELECTION_FROM_GALILEO_DB
                        </div>
                    )}
                </AnimatePresence>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px" }}>
                    {[
                        { label: "AVG_DENSITY", value: currentStats?.area ? (currentStats.poblacion / currentStats.area).toFixed(2) : "0.00", unit: "P/KM2", color: "var(--accent-purple)" },
                        { label: "NODE_LOAD", value: "24.5", unit: "GB/S", color: "var(--accent-blue)" },
                        { label: "SYS_HEALTH", value: "OPTIMAL", unit: "STABLE", color: "var(--accent-green)" },
                        { label: "UPLINK_RATIO", value: "1.42", unit: "MS", color: "var(--accent-blue)" }
                    ].map((s, i) => (
                        <div key={i} className="glass-card" style={{ padding: "20px" }}>
                            <div style={{ fontSize: "9px", color: "var(--text-dim)" }} className="mono">{s.label}</div>
                            <div style={{ fontSize: "20px", fontWeight: "900", margin: "8px 0", color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: "9px", opacity: 0.5 }} className="mono">{s.unit}</div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
