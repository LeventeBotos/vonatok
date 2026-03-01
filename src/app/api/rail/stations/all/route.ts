import { NextResponse } from "next/server";
import {
  getStationCatalogForCountries,
  parseStationCatalogCountries,
} from "@/lib/rail-station-catalog-cache";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const countries = parseStationCatalogCountries(
      url.searchParams.get("countries")
    );
    const forceRefresh = url.searchParams.get("refresh") === "1";
    const stations = await getStationCatalogForCountries(countries, {
      forceRefresh,
    });

    return NextResponse.json({
      stations,
      meta: {
        countries,
        storage: "db-full-country-catalog",
        forceRefresh,
      },
    });
  } catch (error) {
    console.error("Failed to load rail station catalog", error);
    return NextResponse.json(
      { error: "Unable to load OpenRailwayMap station catalog" },
      { status: 502 }
    );
  }
}
