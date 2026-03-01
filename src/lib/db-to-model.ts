import type { Coach as DbCoach, Locomotive as DbLocomotive } from "@/lib/db";
import type { Coach, CoachType, Locomotive, TractionType } from "@/models";

const DEFAULT_COACH_LENGTH_METERS = 26.4;
const DEFAULT_COACH_WEIGHT_TONS = 48;
const DEFAULT_LOCO_LENGTH_METERS = 19.3;
const DEFAULT_LOCO_WEIGHT_TONS = 84;

export function mapDbLocomotiveToModel(db: DbLocomotive): Locomotive {
  const traction = inferTraction(db.nev, db.gyarto);

  return {
    id: db.mozdonyid,
    name: db.nev || db.mozdonyid,
    manufacturer: db.gyarto || "Unknown",
    introductionYear: 2000,
    traction,
    couplingType: "UIC",
    maxSpeedKph: normalizePositiveNumber(db.sebesseg, 120),
    powerKw: inferPowerKw(db.nev, db.sebesseg),
    tractiveEffortKn: inferTractiveEffortKn(db.sebesseg),
    weightTons: DEFAULT_LOCO_WEIGHT_TONS,
    lengthMeters: DEFAULT_LOCO_LENGTH_METERS,
    axleConfig: "Bo'Bo'",
    imageUrl: db.imageurl || undefined,
    notes: "Mapped from mozdonyok database record.",
  };
}

export function mapDbCoachToModel(db: DbCoach): Coach {
  const seatingCapacity = parseSeatCount(db.ulohelyek);
  const bikeSpaces = normalizePositiveNumber(db.biciklihelyek, 0);
  const type = inferCoachType(db.kocsiosztaly, db.utaster);

  return {
    id: db.kocsiid,
    name: db.kocsiid,
    type,
    manufacturer: "Unknown",
    introductionYear: 2000,
    maxSpeedKph: normalizePositiveNumber(db.sebesseg, 120),
    lengthMeters: DEFAULT_COACH_LENGTH_METERS,
    weightTons: DEFAULT_COACH_WEIGHT_TONS,
    seatingCapacity,
    couplingType: "UIC",
    compatibleTraction: ["electric", "diesel", "hybrid"],
    amenities: {
      airConditioned: Boolean(db.klima),
      wifi: false,
      accessibility: "standard",
      powerOutlets: false,
      bikeSpaces,
      restroom: "standard",
    },
    imageUrl: db.imageurl || undefined,
    notes: `Mapped from kocsik database record (${db.utaster || "unknown interior"}).`,
  };
}

function parseSeatCount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const matches = raw.match(/\d+/g);
  if (!matches || matches.length === 0) return 0;
  return matches.reduce((sum, entry) => sum + Number.parseInt(entry, 10), 0);
}

function inferCoachType(classInfo: string | null | undefined, interior: string | null | undefined): CoachType {
  const haystack = `${classInfo ?? ""} ${interior ?? ""}`.toLowerCase();
  if (haystack.includes("háló") || haystack.includes("sleep")) return "sleeper";
  if (haystack.includes("étkező") || haystack.includes("restaurant") || haystack.includes("buffet")) return "restaurant";
  if (haystack.includes("bisztró") || haystack.includes("bistro")) return "bistro";
  if (haystack.includes("1+") || haystack.includes("first") || haystack.includes("1")) return "first-class";
  return "second-class";
}

function inferTraction(name: string | null | undefined, manufacturer: string | null | undefined): TractionType {
  const haystack = `${name ?? ""} ${manufacturer ?? ""}`.toLowerCase();
  if (haystack.includes("diesel")) return "diesel";
  if (haystack.includes("steam")) return "steam";
  if (haystack.includes("hybrid")) return "hybrid";
  return "electric";
}

function inferPowerKw(name: string | null | undefined, topSpeed: number | null | undefined): number {
  const haystack = (name ?? "").toLowerCase();
  if (haystack.includes("taurus")) return 6400;
  if (haystack.includes("vectron")) return 6400;
  if (haystack.includes("traxx")) return 5600;
  return normalizePositiveNumber(topSpeed, 120) >= 200 ? 6000 : 4000;
}

function inferTractiveEffortKn(topSpeed: number | null | undefined): number {
  const speed = normalizePositiveNumber(topSpeed, 120);
  if (speed >= 220) return 300;
  if (speed >= 160) return 260;
  return 220;
}

function normalizePositiveNumber(value: number | null | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}
