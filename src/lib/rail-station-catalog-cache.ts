import type { RailStationCatalogItem } from "@/lib/rail-infrastructure";
import {
  getRailStationsInAustria,
  getRailStationsInHungary,
} from "@/lib/rail-infrastructure";
import { castResult, sql } from "@/lib/db";

export type StationCatalogCountryCode = "HU" | "AT";

interface StationCatalogOptions {
  forceRefresh?: boolean;
}

interface StationRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  city: string | null;
  country: string | null;
}

interface CountryCountRow {
  country_code: string;
  count: number | string;
}

const STATION_TABLE_NAME = "rail_station_catalog";
const CATALOG_SOURCE = "openrailwaymap-mainline";
const SUPPORTED_COUNTRIES: StationCatalogCountryCode[] = ["HU", "AT"];
const UPSERT_BATCH_SIZE = 300;

const COUNTRY_FETCHERS: Record<
  StationCatalogCountryCode,
  () => Promise<RailStationCatalogItem[]>
> = {
  HU: getRailStationsInHungary,
  AT: getRailStationsInAustria,
};

let ensureTablePromise: Promise<void> | null = null;
const syncInFlight = new Map<StationCatalogCountryCode, Promise<void>>();

export async function getStationCatalogForCountries(
  countries: StationCatalogCountryCode[],
  options: StationCatalogOptions = {}
): Promise<RailStationCatalogItem[]> {
  const normalizedCountries = normalizeCountries(countries);
  await ensureStationTable();

  if (options.forceRefresh) {
    await Promise.all(normalizedCountries.map((country) => syncCountry(country)));
  } else {
    const presentCountries = await getCountriesWithData(normalizedCountries);
    const missingCountries = normalizedCountries.filter(
      (country) => !presentCountries.has(country)
    );
    if (missingCountries.length > 0) {
      await Promise.all(missingCountries.map((country) => syncCountry(country)));
    }
  }

  return readStoredStations(normalizedCountries);
}

export function parseStationCatalogCountries(
  raw: string | null
): StationCatalogCountryCode[] {
  if (!raw) return SUPPORTED_COUNTRIES;

  const requested = raw
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry): entry is StationCatalogCountryCode =>
      SUPPORTED_COUNTRIES.includes(entry as StationCatalogCountryCode)
    );

  return normalizeCountries(requested);
}

async function syncCountry(country: StationCatalogCountryCode): Promise<void> {
  const existingSync = syncInFlight.get(country);
  if (existingSync) {
    return existingSync;
  }

  const syncPromise = (async () => {
    const stations = await COUNTRY_FETCHERS[country]();
    if (stations.length === 0) {
      throw new Error(`No stations fetched for ${country}`);
    }
    await saveCountryStations(country, stations);
  })().finally(() => {
    syncInFlight.delete(country);
  });

  syncInFlight.set(country, syncPromise);
  return syncPromise;
}

async function ensureStationTable(): Promise<void> {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ${STATION_TABLE_NAME} (
          station_uid TEXT PRIMARY KEY,
          country_code TEXT NOT NULL,
          station_id TEXT NOT NULL,
          name TEXT NOT NULL,
          latitude DOUBLE PRECISION NOT NULL,
          longitude DOUBLE PRECISION NOT NULL,
          city TEXT,
          country TEXT,
          source TEXT NOT NULL,
          last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql(createTableQuery);

      const indexCountryQuery = `
        CREATE INDEX IF NOT EXISTS idx_rail_station_catalog_country_code
        ON ${STATION_TABLE_NAME} (country_code)
      `;
      await sql(indexCountryQuery);

      const indexNameQuery = `
        CREATE INDEX IF NOT EXISTS idx_rail_station_catalog_name
        ON ${STATION_TABLE_NAME} (name)
      `;
      await sql(indexNameQuery);
    })().catch((error) => {
      ensureTablePromise = null;
      throw error;
    });
  }

  return ensureTablePromise;
}

async function getCountriesWithData(
  countries: StationCatalogCountryCode[]
): Promise<Set<StationCatalogCountryCode>> {
  if (countries.length === 0) {
    return new Set<StationCatalogCountryCode>();
  }

  const placeholders = countries.map((_, index) => `$${index + 1}`).join(", ");
  const query = `
    SELECT country_code, COUNT(*) AS count
    FROM ${STATION_TABLE_NAME}
    WHERE country_code IN (${placeholders})
    GROUP BY country_code
  `;
  const rows = castResult<CountryCountRow[]>(await sql(query, countries));

  const present = new Set<StationCatalogCountryCode>();
  for (const row of rows) {
    const country = row.country_code.toUpperCase() as StationCatalogCountryCode;
    const count =
      typeof row.count === "string" ? Number.parseInt(row.count, 10) : row.count;
    if (SUPPORTED_COUNTRIES.includes(country) && Number.isFinite(count) && count > 0) {
      present.add(country);
    }
  }

  return present;
}

async function readStoredStations(
  countries: StationCatalogCountryCode[]
): Promise<RailStationCatalogItem[]> {
  if (countries.length === 0) {
    return [];
  }

  const placeholders = countries.map((_, index) => `$${index + 1}`).join(", ");
  const query = `
    SELECT
      station_id AS id,
      name,
      latitude,
      longitude,
      city,
      country
    FROM ${STATION_TABLE_NAME}
    WHERE country_code IN (${placeholders})
    ORDER BY name ASC
  `;
  const rows = castResult<StationRow[]>(await sql(query, countries));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    city: row.city ?? undefined,
    country: row.country ?? undefined,
  }));
}

async function saveCountryStations(
  country: StationCatalogCountryCode,
  stations: RailStationCatalogItem[]
): Promise<void> {
  const syncTimestampIso = new Date().toISOString();

  for (let i = 0; i < stations.length; i += UPSERT_BATCH_SIZE) {
    const batch = stations.slice(i, i + UPSERT_BATCH_SIZE);
    const values: unknown[] = [];
    const tuples: string[] = [];

    for (const station of batch) {
      const stationUid = `${country}:${station.id}`;
      const offset = values.length;
      tuples.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}::timestamptz)`
      );
      values.push(
        stationUid,
        country,
        station.id,
        station.name,
        station.latitude,
        station.longitude,
        station.city ?? null,
        station.country ?? null,
        CATALOG_SOURCE,
        syncTimestampIso
      );
    }

    const query = `
      INSERT INTO ${STATION_TABLE_NAME} (
        station_uid,
        country_code,
        station_id,
        name,
        latitude,
        longitude,
        city,
        country,
        source,
        last_synced_at
      )
      VALUES ${tuples.join(", ")}
      ON CONFLICT (station_uid)
      DO UPDATE SET
        station_id = EXCLUDED.station_id,
        name = EXCLUDED.name,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        city = EXCLUDED.city,
        country = EXCLUDED.country,
        source = EXCLUDED.source,
        last_synced_at = EXCLUDED.last_synced_at
    `;
    await sql(query, values);
  }

  const cleanupQuery = `
    DELETE FROM ${STATION_TABLE_NAME}
    WHERE country_code = $1
      AND source = $2
      AND last_synced_at < $3::timestamptz
  `;
  await sql(cleanupQuery, [country, CATALOG_SOURCE, syncTimestampIso]);
}

function normalizeCountries(
  countries: StationCatalogCountryCode[]
): StationCatalogCountryCode[] {
  const set = new Set<StationCatalogCountryCode>();
  for (const country of countries) {
    if (SUPPORTED_COUNTRIES.includes(country)) {
      set.add(country);
    }
  }

  if (set.size === 0) {
    return [...SUPPORTED_COUNTRIES];
  }

  return Array.from(set.values());
}
