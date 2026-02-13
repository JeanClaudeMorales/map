import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useState, useEffect } from "react";

// Types (reusing from page.tsx to keep consistency, ideally should be in types file)
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

interface Person {
    id: string; // cedula
    name: string;
    whatsapp: string;
    address: string;
    email: string;
    lngLat?: [number, number]; // linked location
}


interface SidebarProps {
    markers: any;
    setMarkers: any;
    signals: Signal[];
    setSignals: any;
    parishOverrides: Record<string, Partial<ParishStyles>>;
    setParishOverrides: any;
    selectedElement: { id: string; type: "signal" | "parish" | "marker" } | null;
    setSelectedElement: any;
    activeTool: "none" | "pulse" | "sector" | "marker";
    setActiveTool: any;
    isometricMode: boolean;
    setIsometricMode: any;
    config: any;
    setConfig: any;
    currentConfig: any;
    updateSelected: (u: Partial<any>) => void;
    globalParishStyles: ParishStyles;
    setGlobalParishStyles: any;
    people: Person[];
    setPeople: React.Dispatch<React.SetStateAction<Person[]>>;
    onFlyTo: (lngLat: [number, number]) => void;
}

export const Sidebar = ({
    markers, setMarkers,
    signals, setSignals,
    parishOverrides, setParishOverrides,
    selectedElement, setSelectedElement,
    activeTool, setActiveTool,
    isometricMode, setIsometricMode,
    config, setConfig,
    currentConfig, updateSelected,
    globalParishStyles, setGlobalParishStyles,
    people, setPeople,
    onFlyTo
}: SidebarProps) => {

    const [activeSection, setActiveSection] = useState<"tactical" | "parish" | "registry" | "explorer">("tactical");
    const [personForm, setPersonForm] = useState<Person>({ id: "", name: "", whatsapp: "", address: "", email: "" });

    // Filter lists for explorer
    const [explorerFilter, setExplorerFilter] = useState("");

    const handleRegister = () => {
        if (!personForm.id || !personForm.name) {
            alert("ID_AND_NAME_REQUIRED");
            return;
        }
        setPeople(prev => [...prev, { ...personForm }]);
        setPersonForm({ id: "", name: "", whatsapp: "", address: "", email: "" });
        alert("PERSON_REGISTERED");
    };

    const deletePerson = (id: string) => {
        if (confirm("CONFIRM_DELETE_PERSON?")) {
            setPeople(prev => prev.filter(p => p.id !== id));
        }
    };


    return (
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
                gap: "20px",
                boxShadow: "0 20px 50px rgba(0,0,0,0.8)"
            }}
        >
            <div>
                <h1 style={{ fontSize: "22px", margin: 0, color: "var(--white)" }}>GALILEO_CORE</h1>
                <div style={{ fontSize: "10px", color: "var(--accent-purple)", fontWeight: "bold", marginTop: "4px" }} className="mono">DESIGN BY JEAN CLAUDE</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <button onClick={() => {
                    // Trigger save in parent or just use effect syncing
                    alert("SYNC_COMPLETE (LOCAL)");
                }} style={{ gridColumn: "span 2" }}>COMMIT_CHANGES</button>
                <Link href="/dashboard" style={{ textDecoration: "none" }}><button className="secondary" style={{ width: "100%" }}>DASHBOARD</button></Link>
                <button onClick={() => window.location.href = "/login"} className="secondary">EXIT</button>
            </div>

            <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "15px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>

                {/* TABS */}
                <div style={{ display: "flex", gap: "5px", marginBottom: "5px", flexWrap: "wrap" }}>
                    <button onClick={() => setActiveSection("tactical")} className={activeSection === "tactical" ? "mono small" : "secondary mono small"} style={{ padding: "6px 10px", flex: 1 }}>TACTICAL</button>
                    <button onClick={() => setActiveSection("parish")} className={activeSection === "parish" ? "mono small" : "secondary mono small"} style={{ padding: "6px 10px", flex: 1 }}>PARISH</button>
                    <button onClick={() => setActiveSection("registry")} className={activeSection === "registry" ? "mono small" : "secondary mono small"} style={{ padding: "6px 10px", flex: 1 }}>REGISTRY</button>
                    <button onClick={() => setActiveSection("explorer")} className={activeSection === "explorer" ? "mono small" : "secondary mono small"} style={{ padding: "6px 10px", flex: 1 }}>EXPLORER</button>
                </div>

                <div style={{ fontSize: "10px", color: "var(--text-dim)" }} className="mono">
                    {selectedElement ? `EDITING_${selectedElement.type.toUpperCase()}_${selectedElement.id.slice(-4)}` : `${activeSection.toUpperCase()}_MOD_ACTIVE`}
                </div>

                <AnimatePresence mode="wait">

                    {/* TACTICAL TAB */}
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
                                        <span className="mono" style={{ color: "var(--accent-purple)" }}>{markers.features.find((f: any) => f.id === selectedElement.id)?.properties?.rotation || 0}°</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="360"
                                        step="5"
                                        value={markers.features.find((f: any) => f.id === selectedElement.id)?.properties?.rotation || 0}
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            setMarkers((prev: any) => ({
                                                ...prev,
                                                features: prev.features.map((f: any) => f.id === selectedElement.id ? { ...f, properties: { ...f.properties, rotation: val } } : f)
                                            }));
                                        }}
                                    />
                                </div>
                            )}

                            {selectedElement && (selectedElement.type === 'signal' || selectedElement.type === 'marker') && (
                                <button onClick={() => {
                                    if (selectedElement.type === 'signal') setSignals((prev: any) => prev.filter((s: any) => s.id !== selectedElement.id));
                                    else if (selectedElement.type === 'marker') setMarkers((prev: any) => ({ ...prev, features: prev.features.filter((f: any) => f.id !== selectedElement.id) }));
                                    setSelectedElement(null);
                                }} className="danger">ELIMINAR_ENTIDAD</button>
                            )}
                        </motion.div>
                    )}

                    {/* PARISH TAB */}
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
                                        <input type="range" min="0" max="500" step="10" value={parishOverrides[selectedElement.id]?.height ?? globalParishStyles.height} onChange={(e) => setParishOverrides((prev: any) => ({ ...prev, [selectedElement.id]: { ...prev[selectedElement.id], height: Number(e.target.value) } }))} />
                                    </div>

                                    <div className="flex-col gap-sm">
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                                            <span className="mono">OUTLINE_WIDTH</span>
                                            <span className="mono" style={{ color: "var(--accent-purple)" }}>{(parishOverrides[selectedElement.id]?.outlineWidth ?? globalParishStyles.outlineWidth)}px</span>
                                        </div>
                                        <input type="range" min="0" max="10" step="0.5" value={parishOverrides[selectedElement.id]?.outlineWidth ?? globalParishStyles.outlineWidth} onChange={(e) => setParishOverrides((prev: any) => ({ ...prev, [selectedElement.id]: { ...prev[selectedElement.id], outlineWidth: Number(e.target.value) } }))} />
                                    </div>

                                    <div className="flex-col gap-sm">
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                                            <span className="mono">LABEL_SIZE</span>
                                            <span className="mono" style={{ color: "var(--accent-purple)" }}>{(parishOverrides[selectedElement.id]?.labelSize ?? globalParishStyles.labelSize)}px</span>
                                        </div>
                                        <input type="range" min="0" max="30" step="1" value={parishOverrides[selectedElement.id]?.labelSize ?? globalParishStyles.labelSize} onChange={(e) => setParishOverrides((prev: any) => ({ ...prev, [selectedElement.id]: { ...prev[selectedElement.id], labelSize: Number(e.target.value) } }))} />
                                    </div>

                                    <div className="flex-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                                        <span className="mono" style={{ fontSize: "11px" }}>PARISH_COLOR</span>
                                        <input type="color" value={parishOverrides[selectedElement.id]?.color ?? globalParishStyles.color} onChange={(e) => setParishOverrides((prev: any) => ({ ...prev, [selectedElement.id]: { ...prev[selectedElement.id], color: e.target.value } }))} style={{ width: "32px", height: "32px", background: "none", border: "1px solid var(--border-light)", borderRadius: "8px", cursor: "pointer" }} />
                                    </div>

                                    <div className="flex-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                                        <span className="mono" style={{ fontSize: "11px" }}>OUTLINE_COLOR</span>
                                        <input type="color" value={parishOverrides[selectedElement.id]?.outlineColor ?? globalParishStyles.outlineColor} onChange={(e) => setParishOverrides((prev: any) => ({ ...prev, [selectedElement.id]: { ...prev[selectedElement.id], outlineColor: e.target.value } }))} style={{ width: "32px", height: "32px", background: "none", border: "1px solid var(--border-light)", borderRadius: "8px", cursor: "pointer" }} />
                                    </div>

                                    <div className="flex-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                                        <span className="mono" style={{ fontSize: "11px" }}>VISIBLE</span>
                                        <input type="checkbox" checked={parishOverrides[selectedElement.id]?.visible ?? globalParishStyles.visible} onChange={(e) => setParishOverrides((prev: any) => ({ ...prev, [selectedElement.id]: { ...prev[selectedElement.id], visible: e.target.checked } }))} />
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
                                    <input type="range" min="0" max="200" step="5" value={globalParishStyles.height} onChange={(e) => setGlobalParishStyles((prev: any) => ({ ...prev, height: Number(e.target.value) }))} />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* REGISTRY TAB */}
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
                            <button onClick={handleRegister} style={{ marginTop: "10px" }}>COMMIT_REGISTRY</button>

                            <div style={{ borderTop: "1px solid var(--border-light)", marginTop: "10px", paddingTop: "10px" }}>
                                <div className="mono" style={{ fontSize: "10px", color: "var(--text-dim)", marginBottom: "10px" }}>REGISTERED_ENTITIES ({people.length})</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                                    {people.map(p => (
                                        <div key={p.id} className="glass-card" style={{ padding: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontSize: "11px", fontWeight: "bold" }}>{p.name}</div>
                                                <div style={{ fontSize: "9px", color: "var(--text-dim)" }} className="mono">{p.id}</div>
                                            </div>
                                            <button onClick={() => deletePerson(p.id)} className="secondary small danger" style={{ padding: "4px 8px" }}>DEL</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* EXPLORER TAB */}
                    {activeSection === "explorer" && (
                        <motion.div
                            key="explorer"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            style={{ display: "flex", flexDirection: "column", gap: "15px" }}
                        >
                            <input
                                type="text"
                                placeholder="SEARCH_ENTITY..."
                                value={explorerFilter}
                                onChange={(e) => setExplorerFilter(e.target.value)}
                                style={{ fontSize: "10px", padding: "8px" }}
                            />

                            {/* POINTS */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                                <div className="mono" style={{ fontSize: "9px", color: "var(--accent-purple)" }}>TACTICAL_POINTS ({markers.features.length})</div>
                                {markers.features.filter((f: any) => f.id.includes(explorerFilter)).map((f: any) => (
                                    <div
                                        key={f.id}
                                        style={{
                                            padding: "8px",
                                            background: "rgba(255,255,255,0.05)",
                                            borderRadius: "6px",
                                            fontSize: "10px",
                                            cursor: "pointer",
                                            border: selectedElement?.id === f.id ? "1px solid var(--accent-purple)" : "1px solid transparent"
                                        }}
                                        onClick={() => {
                                            setSelectedElement({ id: f.id, type: "marker" });
                                            onFlyTo(f.geometry.coordinates);
                                        }}
                                    >
                                        <span className="mono">{f.id.slice(0, 15)}...</span>
                                    </div>
                                ))}
                            </div>
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
    );
};
