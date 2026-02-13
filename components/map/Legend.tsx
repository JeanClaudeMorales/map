import { motion } from "framer-motion";

export const Legend = () => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card mono"
            style={{
                position: "absolute",
                bottom: "20px",
                left: "400px", // To the right of the sidebar
                zIndex: 10,
                padding: "15px",
                fontSize: "10px",
                color: "var(--text-dim)",
                display: "flex",
                gap: "20px",
                alignItems: "center",
                pointerEvents: "none" // Allow clicking through if needed, but maybe not if we want to interact
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "12px", height: "12px", background: "rgba(127,102,255,0.3)", border: "1px solid #7F66FF" }}></div>
                <span>PARISH_ZONE</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#7F66FF", border: "2px solid #fff" }}></div>
                <span>TACTICAL_POINT</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "0", height: "0", borderTop: "10px solid rgba(127,102,255,0.5)", borderLeft: "6px solid transparent", borderRight: "6px solid transparent" }}></div>
                <span>SIGNAL_SECTOR</span>
            </div>
        </motion.div>
    );
};
