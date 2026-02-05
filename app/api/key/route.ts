import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // Ensure this runs at runtime, not build time

export async function GET() {
    const key = process.env.NEXT_PUBLIC_MAPTILER_KEY || process.env.MAPTILER_KEY;

    if (!key) {
        return NextResponse.json({ error: "API Key not configured" }, { status: 500 });
    }

    return NextResponse.json({ key });
}
