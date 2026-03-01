import { NextResponse } from "next/server";
import { calculateRailTimetableFromInfrastructure } from "@/lib/rail-infrastructure";
import type { TravelTimeSummary } from "@/utils/train-calculations";
import type { RailLegPlan, RailStopPlan } from "@/lib/rail-infrastructure";

interface StopPayload {
  name?: string;
  latitude: number;
  longitude: number;
}

interface TimetableRequestBody {
  stops?: StopPayload[];
  maxTrainSpeedKph?: number;
  dwellMinutes?: number;
}

interface TimetableResponseBody {
  summary: TravelTimeSummary | null;
  coordinates: [number, number][];
  legPlans: RailLegPlan[];
  stopPlans: RailStopPlan[];
  speedProfile: Array<{
    distanceMeters: number;
    speedKph: number;
    legIndex: number;
  }>;
}

const TIMETABLE_CALC_TIMEOUT_MS = 45_000;

export async function POST(request: Request) {
  let body: TimetableRequestBody;

  try {
    body = (await request.json()) as TimetableRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const stops = (body.stops ?? []).filter(
    (stop): stop is StopPayload =>
      typeof stop.latitude === "number" &&
      Number.isFinite(stop.latitude) &&
      typeof stop.longitude === "number" &&
      Number.isFinite(stop.longitude)
  );

  if (stops.length < 2) {
    const empty: TimetableResponseBody = {
      summary: null,
      coordinates: [],
      legPlans: [],
      stopPlans: [],
      speedProfile: [],
    };
    return NextResponse.json(empty);
  }

  try {
    const normalizedStops = stops;

    const timetable = await withTimeout(
      calculateRailTimetableFromInfrastructure(normalizedStops, {
        maxTrainSpeedKph: body.maxTrainSpeedKph,
        dwellMinutes: body.dwellMinutes,
      }),
      TIMETABLE_CALC_TIMEOUT_MS,
      "Infrastructure timetable calculation timed out."
    );

    if (!timetable) {
      return NextResponse.json(
        {
          error:
            "OpenRailwayMap infrastructure routing failed for at least one segment.",
        },
        { status: 422 }
      );
    }

    const totalDistanceKm = timetable.totalDistanceMeters / 1000;
    const estimatedDurationMinutes = timetable.durationSeconds / 60;
    const averageSpeedKph =
      estimatedDurationMinutes > 0
        ? totalDistanceKm / (estimatedDurationMinutes / 60)
        : 0;

    const summary: TravelTimeSummary = {
      totalDistanceKm,
      estimatedDurationMinutes,
      averageSpeedKph,
      stopCount: Math.max(normalizedStops.length - 2, 0),
      dataSource: "openrailwaymap",
      brakingCurveApplied: true,
    };

    const responseBody: TimetableResponseBody = {
      summary,
      coordinates: timetable.coordinates,
      legPlans: timetable.legPlans,
      stopPlans: timetable.stopPlans,
      speedProfile: timetable.speedProfile,
    };

    return NextResponse.json(responseBody);
  } catch (error) {
    if (isTimeoutLikeError(error)) {
      const message =
        error instanceof Error
          ? error.message
          : "Infrastructure timetable calculation timed out.";
      return NextResponse.json({ error: message }, { status: 504 });
    }
    console.error("Failed to calculate rail timetable", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to calculate timetable from infrastructure",
      },
      { status: 502 }
    );
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isTimeoutLikeError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("timed out") || msg.includes("aborted")) {
      return true;
    }
  }
  if (typeof error === "object") {
    const maybe = error as { name?: unknown; code?: unknown; message?: unknown };
    if (maybe.name === "AbortError") return true;
    if (maybe.code === 20) return true;
    if (
      typeof maybe.message === "string" &&
      maybe.message.toLowerCase().includes("aborted")
    ) {
      return true;
    }
  }
  return false;
}
