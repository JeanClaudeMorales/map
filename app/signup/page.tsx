"use client";

import Link from "next/link";
import { useState } from "react";

export default function SignupPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    return (
        <div style={{
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(circle at center, #111 0%, #000 100%)",
            padding: "20px"
        }}>
            {/* Branding */}
            <div style={{ textAlign: "center", marginBottom: "60px" }}>
                <h1 style={{ fontSize: "32px", margin: 0, letterSpacing: "4px", textTransform: "uppercase" }}>
                    PROYECTO GALILEO
                </h1>
                <div style={{ fontSize: "12px", opacity: 0.5, letterSpacing: "2px", marginTop: "8px" }} className="mono">
                    SYSTEMS ARCHITECTURE BY JEAN CLAUDE
                </div>
            </div>

            {/* Auth Card */}
            <div style={{
                width: "100%",
                maxWidth: "400px",
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                padding: "40px"
            }}>
                <h2 style={{ fontSize: "14px", marginBottom: "30px", opacity: 0.8, letterSpacing: "1px" }} className="mono">
                    SYSTEM REGISTRATION
                </h2>

                <form onSubmit={(e) => { e.preventDefault(); window.location.href = "/login"; }} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <label style={{ fontSize: "10px", opacity: 0.5, letterSpacing: "1px" }} className="mono">FULL NAME</label>
                        <input
                            type="text"
                            placeholder="YOUR NAME"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <label style={{ fontSize: "10px", opacity: 0.5, letterSpacing: "1px" }} className="mono">EMAIL ADDRESS</label>
                        <input
                            type="email"
                            placeholder="IDENTIFIER"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <label style={{ fontSize: "10px", opacity: 0.5, letterSpacing: "1px" }} className="mono">PASSWORD</label>
                        <input
                            type="password"
                            placeholder="NEW ACCESS KEY"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" style={{ marginTop: "20px" }}>
                        REQUEST ACCESS
                    </button>
                </form>

                <div style={{ marginTop: "30px", textAlign: "center", fontSize: "11px", opacity: 0.6 }} className="mono">
                    ALREADY REGISTERED? <Link href="/login" style={{ color: "#fff", textDecoration: "underline", marginLeft: "10px" }}>INITIALIZE SESSION</Link>
                </div>
            </div>

            {/* Footer Decoration */}
            <div style={{ position: "absolute", bottom: "40px", fontSize: "10px", opacity: 0.3, letterSpacing: "2px" }} className="mono">
                EST. 2026 // GALILEO CORE v2.0
            </div>
        </div>
    );
}
