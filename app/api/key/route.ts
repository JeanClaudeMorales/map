import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // Ensure this runs at runtime, not build time

export async function GET() {
    // Use bracket notation to prevent build-time inlining by Next.js
    const key = process.env["NEXT_PUBLIC_MAPTILER_KEY"] || process.env["MAPTILER_KEY"];

    // Debug logging
    const hasNextPublic = !!process.env["NEXT_PUBLIC_MAPTILER_KEY"];
    const hasMaptiler = !!process.env["MAPTILER_KEY"];
    console.log(`API Key Check: NEXT_PUBLIC_=${hasNextPublic}, MAPTILER_=${hasMaptiler}`);


    if (!key) {
        // Search for any keys that look similar (debugging)
        const relevantKeys = Object.keys(process.env).filter(k => k.includes("MAP") || k.includes("KEY")).join(", ");

        return NextResponse.json({
            error: `API Key missing. NODE_ENV=${process.env.NODE_ENV}. Found keys: [${relevantKeys}]. Status: NEXT_PUBLIC=${hasNextPublic}, MAPTILER=${hasMaptiler}`
        }, { status: 500 });
    }

    return NextResponse.json({ key });
}
