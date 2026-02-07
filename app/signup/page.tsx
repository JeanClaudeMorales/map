"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function SignupPage() {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        alert("REQUEST_SUBMITTED");
        window.location.href = "/login";
    };

    return (
        <div style={{
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(circle at 80% 30%, rgba(4, 159, 108, 0.08) 0%, transparent 40%), radial-gradient(circle at 20% 70%, rgba(127, 102, 255, 0.08) 0%, transparent 40%), var(--bg-deep)",
            padding: "20px"
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card"
                style={{ padding: "50px", width: "100%", maxWidth: "450px", display: "flex", flexDirection: "column", gap: "35px" }}
            >
                <div style={{ textAlign: "center" }}>
                    <h1 style={{ fontSize: "32px", fontWeight: "900", letterSpacing: "-0.04em" }}>JOIN_GALILEO</h1>
                    <div style={{ fontSize: "10px", color: "var(--accent-green)", marginTop: "8px", fontWeight: "bold" }} className="mono">OPERATOR_ENROLLMENT_UPLINK</div>
                </div>

                <form style={{ display: "flex", flexDirection: "column", gap: "25px" }} onSubmit={handleSubmit}>
                    <div className="flex-col gap-sm">
                        <label style={{ fontSize: "10px", color: "var(--text-dim)" }} className="mono">OPERATOR_NAME</label>
                        <input
                            type="text"
                            placeholder="Commander Shepard"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", padding: "16px", borderRadius: "12px", color: "#fff", outline: "none", transition: "var(--transition-smooth)" }}
                            required
                        />
                    </div>

                    <div className="flex-col gap-sm">
                        <label style={{ fontSize: "10px", color: "var(--text-dim)" }} className="mono">UPLINK_IDENTITY_EMAIL</label>
                        <input
                            type="email"
                            placeholder="commander@galactic.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", padding: "16px", borderRadius: "12px", color: "#fff", outline: "none", transition: "var(--transition-smooth)" }}
                            required
                        />
                    </div>

                    <button type="submit" style={{ marginTop: "10px", height: "55px", background: "var(--accent-green)" }}>REQUEST_NODE_ACCESS</button>
                </form>

                <div style={{ textAlign: "center", fontSize: "12px", color: "var(--text-dim)" }}>
                    ALREADY ENROLLED? <Link href="/login" style={{ color: "var(--accent-green)", textDecoration: "none", fontWeight: "bold" }}>RETURN_TO_LOGIN</Link>
                </div>
            </motion.div>
        </div>
    );
}
