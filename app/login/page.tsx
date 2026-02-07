"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        window.location.href = "/";
    };

    return (
        <div style={{
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(circle at 20% 30%, rgba(127, 102, 255, 0.08) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(9, 80, 195, 0.08) 0%, transparent 40%), var(--bg-deep)",
            padding: "20px"
        }}>
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card"
                style={{ padding: "50px", width: "100%", maxWidth: "450px", display: "flex", flexDirection: "column", gap: "35px" }}
            >
                <div style={{ textAlign: "center" }}>
                    <h1 style={{ fontSize: "32px", fontWeight: "900", letterSpacing: "-0.04em" }}>GALILEO_NODE</h1>
                    <div style={{ fontSize: "10px", color: "var(--accent-purple)", marginTop: "8px", fontWeight: "bold" }} className="mono">AUTHENTICATION_PROTOCOL_V4</div>
                </div>

                <form style={{ display: "flex", flexDirection: "column", gap: "25px" }} onSubmit={handleSubmit}>
                    <div className="flex-col gap-sm">
                        <label style={{ fontSize: "10px", color: "var(--text-dim)" }} className="mono">UPLINK_IDENTITY</label>
                        <input
                            type="email"
                            placeholder="operator@galileo.sys"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", padding: "16px", borderRadius: "12px", color: "#fff", outline: "none", transition: "var(--transition-smooth)" }}
                            required
                        />
                    </div>

                    <div className="flex-col gap-sm">
                        <label style={{ fontSize: "10px", color: "var(--text-dim)" }} className="mono">SECURE_PASSCODE</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", padding: "16px", borderRadius: "12px", color: "#fff", outline: "none", transition: "var(--transition-smooth)" }}
                            required
                        />
                    </div>

                    <button type="submit" style={{ marginTop: "10px", height: "55px" }}>INITIALIZE_SESSION</button>
                </form>

                <div style={{ textAlign: "center", fontSize: "12px", color: "var(--text-dim)" }}>
                    AWAITING ACCESS? <Link href="/signup" style={{ color: "var(--accent-purple)", textDecoration: "none", fontWeight: "bold" }}>REQUEST_ENROLLMENT</Link>
                </div>
            </motion.div>
        </div>
    );
}
