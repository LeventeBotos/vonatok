import type { Coach, Locomotive, Station } from "@/models";

export interface CompositionMetrics {
  totalLengthMeters: number;
  totalWeightTons: number;
  maxAllowedSpeedKph: number;
}

export interface CompositionValidation {
  warnings: string[];
  errors: string[];
}

export interface PlatformWarning {
  stationId: string;
  stationName: string;
  platformLengthMeters: number;
  requiredLengthMeters: number;
}

export interface TravelTimeSummary {
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  averageSpeedKph: number;
  stopCount: number;
}

export interface TravelTimeOptions {
  dwellMinutes?: number;
  accelerationMetersPerSecond2?: number;
  decelerationMetersPerSecond2?: number;
  efficiencyFactor?: number;
}

export function getCompositionMetrics(
  locomotive: Locomotive | null,
  coaches: Coach[]
): CompositionMetrics {
  const totalLengthMeters =
    (locomotive?.lengthMeters ?? 0) +
    coaches.reduce((sum, coach) => sum + coach.lengthMeters, 0);

  const totalWeightTons =
    (locomotive?.weightTons ?? 0) +
    coaches.reduce((sum, coach) => sum + coach.weightTons, 0);

  const speeds = [locomotive?.maxSpeedKph, ...coaches.map((coach) => coach.maxSpeedKph)]
    .filter((value): value is number => typeof value === "number" && !Number.isNaN(value));

  const maxAllowedSpeedKph = speeds.length > 0 ? Math.min(...speeds) : 0;

  return {
    totalLengthMeters,
    totalWeightTons,
    maxAllowedSpeedKph,
  };
}

export function validateComposition(
  locomotive: Locomotive | null,
  coaches: Coach[]
): CompositionValidation {
  const { totalLengthMeters, maxAllowedSpeedKph } = getCompositionMetrics(
    locomotive,
    coaches
  );

  const warnings: string[] = [];
  const errors: string[] = [];

  if (totalLengthMeters > 700) {
    warnings.push(
      `Train length ${totalLengthMeters.toFixed(0)} m exceeds the 700 m recommended limit.`
    );
  }

  if (locomotive) {
    for (const coach of coaches) {
      if (coach.couplingType !== locomotive.couplingType) {
        warnings.push(
          `${coach.name} uses ${coach.couplingType} coupling which differs from locomotive ${locomotive.couplingType}.`
        );
      }
      if (!coach.compatibleTraction.includes(locomotive.traction)) {
        warnings.push(
          `${coach.name} is not certified for ${locomotive.traction} traction.`
        );
      }
    }
  }

  if (maxAllowedSpeedKph < 100 && (locomotive || coaches.length > 0)) {
    warnings.push(
      `Composition limited to ${maxAllowedSpeedKph} km/h which may be slow for InterCity service.`
    );
  }

  return { warnings, errors };
}

export function evaluatePlatformConstraints(
  route: Station[],
  totalLengthMeters: number
): PlatformWarning[] {
  return route
    .filter((station) => station.platformLengthMeters < totalLengthMeters)
    .map((station) => ({
      stationId: station.id,
      stationName: station.name,
      platformLengthMeters: station.platformLengthMeters,
      requiredLengthMeters: totalLengthMeters,
    }));
}

export function haversineDistanceKm(a: Station, b: Station): number {
  const R = 6371; // Earth radius km
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);

  const aa = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

export function estimateTravelTime(
  route: Station[],
  locomotive: Locomotive | null,
  coaches: Coach[],
  options: TravelTimeOptions = {}
): TravelTimeSummary | null {
  if (route.length < 2) return null;

  const { maxAllowedSpeedKph } = getCompositionMetrics(locomotive, coaches);
  const cruiseSpeedKph = maxAllowedSpeedKph || 80;
  const dwellMinutes = options.dwellMinutes ?? 2;
  const efficiency = options.efficiencyFactor ?? 0.85; // coverage for speed restrictions

  let totalDistanceKm = 0;
  let runningMinutes = 0;

  for (let i = 0; i < route.length - 1; i += 1) {
    const segmentKm = haversineDistanceKm(route[i], route[i + 1]);
    totalDistanceKm += segmentKm;

    const effectiveSpeed = Math.max(40, cruiseSpeedKph * efficiency);
    const segmentHours = segmentKm / effectiveSpeed;
    runningMinutes += segmentHours * 60;
  }

  const totalDwellMinutes = dwellMinutes * Math.max(route.length - 1, 0);
  const estimatedDurationMinutes = runningMinutes + totalDwellMinutes;
  const averageSpeedKph =
    estimatedDurationMinutes > 0 ? (totalDistanceKm / (estimatedDurationMinutes / 60)) : 0;

  return {
    totalDistanceKm,
    estimatedDurationMinutes,
    averageSpeedKph,
    stopCount: Math.max(route.length - 2, 0),
  };
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}
