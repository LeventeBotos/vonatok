import { NextResponse } from "next/server";
import { findRailStationsByText } from "@/lib/rail-infrastructure";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() ?? "";
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "8", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 20) : 8;

  if (!query) {
    return NextResponse.json({ stations: [] as unknown[] });
  }

  try {
    const stations = await findRailStationsByText(query, limit);
    return NextResponse.json({ stations });
  } catch (error) {
    console.error("Rail station search failed", error);
    return NextResponse.json(
      { error: "Unable to search stations from OpenRailwayMap data" },
      { status: 502 }
    );
  }
}
