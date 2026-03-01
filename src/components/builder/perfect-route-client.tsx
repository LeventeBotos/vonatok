"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import type {
  RailLegPlan,
  RailSpeedProfilePoint,
  RailStopPlan,
} from "@/lib/rail-infrastructure";
import type { PerfectRouteDraft } from "@/lib/perfect-route-draft";
import { getPerfectRouteDraftStorageKey } from "@/lib/perfect-route-draft";
import { getCompositionMetrics, type TravelTimeSummary } from "@/utils/train-calculations";
import { TrainRouteMap } from "@/components/train-route-map";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface TimetableApiResponse {
  summary: TravelTimeSummary | null;
  coordinates: [number, number][];
  legPlans: RailLegPlan[];
  stopPlans: RailStopPlan[];
  speedProfile: RailSpeedProfilePoint[];
}

interface ScheduleStopRow {
  index: number;
  stationName: string;
  selectedPlatform: string;
  arrivalTime: Date | null;
  departureTime: Date | null;
  snapDistanceMeters: number | null;
}

export default function PerfectRouteClient() {
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft");
  const [draft, setDraft] = useState<PerfectRouteDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(true);

  const [summary, setSummary] = useState<TravelTimeSummary | null>(null);
  const [routeLine, setRouteLine] = useState<[number, number][]>([]);
  const [legPlans, setLegPlans] = useState<RailLegPlan[]>([]);
  const [stopPlans, setStopPlans] = useState<RailStopPlan[]>([]);
  const [speedProfile, setSpeedProfile] = useState<RailSpeedProfilePoint[]>([]);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [calculationLoading, setCalculationLoading] = useState(false);
  const [platformByStop, setPlatformByStop] = useState<string[]>([]);
  const [dwellByStopMinutes, setDwellByStopMinutes] = useState<number[]>([]);
  const [departureTimeLocal, setDepartureTimeLocal] = useState(() =>
    defaultDepartureTimeLocal()
  );

  const route = draft?.route ?? [];
  const locomotive = draft?.locomotive ?? null;
  const coaches = draft?.coaches ?? [];
  const compositionMetrics = useMemo(
    () => getCompositionMetrics(locomotive, coaches),
    [locomotive, coaches]
  );

  useEffect(() => {
    if (!draftId) {
      setDraftError("No route draft reference was provided.");
      setLoadingDraft(false);
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    const storageKey = getPerfectRouteDraftStorageKey(draftId);
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      setDraftError("Route draft not found. Start from the builder page.");
      setLoadingDraft(false);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as PerfectRouteDraft;
      if (!Array.isArray(parsed.route) || parsed.route.length < 2) {
        setDraftError("Route draft is incomplete. Please rebuild the route.");
        setLoadingDraft(false);
        return;
      }
      setDraft(parsed);
      setDraftError(null);
    } catch (error) {
      console.error("Failed to parse perfect route draft", error);
      setDraftError("Route draft is invalid. Please rebuild the route.");
    } finally {
      setLoadingDraft(false);
    }
  }, [draftId]);

  const calculateInfrastructureRoute = useCallback(async () => {
    if (!draft) return;

    setCalculationLoading(true);
    setCalculationError(null);
    try {
      const response = await fetch("/api/rail/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stops: draft.route.map((station) => ({
            name: station.name,
            latitude: station.latitude,
            longitude: station.longitude,
          })),
          maxTrainSpeedKph: compositionMetrics.maxAllowedSpeedKph || undefined,
          dwellMinutes: 2,
        }),
      });

      if (!response.ok) {
        let details = `Timetable request failed: ${response.status}`;
        try {
          const errorBody = (await response.json()) as { error?: string };
          if (errorBody.error) {
            details = errorBody.error;
          }
        } catch {
          // keep fallback
        }
        throw new Error(details);
      }

      const payload = (await response.json()) as TimetableApiResponse;
      setSummary(payload.summary);
      setRouteLine(payload.coordinates.length >= 2 ? payload.coordinates : []);
      setLegPlans(payload.legPlans ?? []);
      setStopPlans(payload.stopPlans ?? []);
      setSpeedProfile(payload.speedProfile ?? []);

      setPlatformByStop((current) =>
        buildPlatformSelection(payload.stopPlans ?? [], current)
      );

      setDwellByStopMinutes((current) => {
        if (current.length === draft.route.length) {
          return current;
        }
        return draft.route.map((_, index) =>
          index === 0 || index === draft.route.length - 1 ? 0 : 2
        );
      });
    } catch (error) {
      console.error("Failed to calculate infrastructure route", error);
      setSummary(null);
      setRouteLine([]);
      setLegPlans([]);
      setStopPlans([]);
      setSpeedProfile([]);
      setCalculationError(
        error instanceof Error
          ? error.message
          : "Could not calculate an exact infrastructure route for this draft."
      );
    } finally {
      setCalculationLoading(false);
    }
  }, [compositionMetrics.maxAllowedSpeedKph, draft]);

  useEffect(() => {
    if (!draft) return;
    void calculateInfrastructureRoute();
  }, [calculateInfrastructureRoute, draft]);

  const scheduleRows = useMemo(() => {
    if (route.length === 0) return [] as ScheduleStopRow[];
    if (legPlans.length !== Math.max(route.length - 1, 0)) {
      return route.map((station, index) => ({
        index,
        stationName: station.name,
        selectedPlatform: platformByStop[index] ?? "",
        arrivalTime: null,
        departureTime: null,
        snapDistanceMeters: stopPlans[index]?.snapDistanceMeters ?? null,
      }));
    }

    const departureDate = parseLocalDateTime(departureTimeLocal);
    if (!departureDate) {
      return route.map((station, index) => ({
        index,
        stationName: station.name,
        selectedPlatform: platformByStop[index] ?? "",
        arrivalTime: null,
        departureTime: null,
        snapDistanceMeters: stopPlans[index]?.snapDistanceMeters ?? null,
      }));
    }

    const rows: ScheduleStopRow[] = [];
    let currentTimeMs = departureDate.getTime();
    rows.push({
      index: 0,
      stationName: route[0].name,
      selectedPlatform: platformByStop[0] ?? "",
      arrivalTime: null,
      departureTime: new Date(currentTimeMs),
      snapDistanceMeters: stopPlans[0]?.snapDistanceMeters ?? null,
    });

    for (let i = 0; i < legPlans.length; i += 1) {
      currentTimeMs += Math.round(legPlans[i].runningTimeSeconds * 1000);
      const arrival = new Date(currentTimeMs);
      const isLast = i + 1 === route.length - 1;
      if (!isLast) {
        const dwellMinutes = clampDwellMinutes(dwellByStopMinutes[i + 1] ?? 2);
        currentTimeMs += dwellMinutes * 60 * 1000;
      }
      rows.push({
        index: i + 1,
        stationName: route[i + 1].name,
        selectedPlatform: platformByStop[i + 1] ?? "",
        arrivalTime: arrival,
        departureTime: isLast ? null : new Date(currentTimeMs),
        snapDistanceMeters: stopPlans[i + 1]?.snapDistanceMeters ?? null,
      });
    }

    return rows;
  }, [departureTimeLocal, dwellByStopMinutes, legPlans, platformByStop, route, stopPlans]);

  const operationalDurationMinutes = useMemo(() => {
    if (legPlans.length === 0) return null;
    const runningSeconds = legPlans.reduce((sum, leg) => sum + leg.runningTimeSeconds, 0);
    const dwellSeconds = dwellByStopMinutes.reduce((sum, dwell, index) => {
      if (index === 0 || index === dwellByStopMinutes.length - 1) return sum;
      return sum + clampDwellMinutes(dwell) * 60;
    }, 0);
    return (runningSeconds + dwellSeconds) / 60;
  }, [dwellByStopMinutes, legPlans]);

  if (loadingDraft) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Loading route draft...</p>
      </div>
    );
  }

  if (draftError || !draft) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTitle>Cannot open perfect route planner</AlertTitle>
          <AlertDescription>{draftError ?? "Unknown draft error."}</AlertDescription>
        </Alert>
        <Button asChild variant="secondary">
          <Link href="/builder">
            <ArrowLeft className="h-4 w-4" /> Back to Builder
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/builder">
              <ArrowLeft className="h-4 w-4" /> Back to Builder
            </Link>
          </Button>
          <Badge variant="secondary">Perfect Route Planner</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Infrastructure Route Optimization</h1>
        <p className="max-w-3xl text-muted-foreground">
          Refine station operations, platform assignment, and timetable details on top of the calculated track geometry.
        </p>
      </section>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Locomotive</p>
            <p className="text-sm font-semibold">{locomotive?.name ?? "N/A"}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coaches</p>
            <p className="text-sm font-semibold">{coaches.length}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stops</p>
            <p className="text-sm font-semibold">{route.length}</p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <TrainRouteMap
          stations={route}
          selectedStations={route}
          routeLine={routeLine.length >= 2 ? routeLine : undefined}
          interactive={false}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Operational Inputs</CardTitle>
            <CardDescription>
              Choose departure time, platform assignment, and dwell times per stop.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="departure-time">Departure time</Label>
                <Input
                  id="departure-time"
                  type="datetime-local"
                  value={departureTimeLocal}
                  onChange={(event) => setDepartureTimeLocal(event.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void calculateInfrastructureRoute()}
                  disabled={calculationLoading}
                >
                  <RefreshCcw className="h-4 w-4" />
                  {calculationLoading ? "Calculating..." : "Recalculate From Infrastructure"}
                </Button>
              </div>
            </div>

            {calculationError && (
              <Alert>
                <AlertTitle>Calculation failed</AlertTitle>
                <AlertDescription>{calculationError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              {route.map((station, index) => {
                const stopPlan = stopPlans[index];
                const candidatePlatforms = dedupePlatforms(stopPlan?.platformCandidates ?? []);
                const selectedPlatform = platformByStop[index] ?? "";
                const dwellValue = dwellByStopMinutes[index] ?? (index === 0 || index === route.length - 1 ? 0 : 2);
                const isEndpoint = index === 0 || index === route.length - 1;

                return (
                  <div key={`${station.id}-${index}`} className="rounded-lg border bg-card p-3">
                    <div className="mb-3">
                      <p className="text-sm font-semibold">
                        {index + 1}. {station.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {typeof stopPlan?.snapDistanceMeters === "number"
                          ? `Snapped to rail graph at ${Math.round(stopPlan.snapDistanceMeters)} m`
                          : "No station snap data"}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Platform</Label>
                        {candidatePlatforms.length > 0 ? (
                          <Select
                            value={selectedPlatform || "__none"}
                            onValueChange={(value) => {
                              const next = [...platformByStop];
                              next[index] = value === "__none" ? "" : value;
                              setPlatformByStop(next);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose platform" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">No platform selected</SelectItem>
                              {candidatePlatforms.map((platform) => (
                                <SelectItem key={`${station.id}-${index}-${platform}`} value={platform}>
                                  {formatPlatformLabel(platform)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            placeholder="No platform candidates from map data"
                            value={selectedPlatform}
                            onChange={(event) => {
                              const next = [...platformByStop];
                              next[index] = event.target.value;
                              setPlatformByStop(next);
                            }}
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Dwell (minutes)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={30}
                          step={1}
                          value={dwellValue}
                          disabled={isEndpoint}
                          onChange={(event) => {
                            const parsed = Number.parseInt(event.target.value, 10);
                            const next = [...dwellByStopMinutes];
                            next[index] = Number.isFinite(parsed) ? clampDwellMinutes(parsed) : 0;
                            setDwellByStopMinutes(next);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Calculated Times</CardTitle>
              <CardDescription>
                Infrastructure timings with your operational platform/dwell choices.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <MetricRow label="Distance" value={summary ? `${summary.totalDistanceKm.toFixed(2)} km` : "N/A"} />
              <MetricRow
                label="Base duration"
                value={summary ? formatDuration(summary.estimatedDurationMinutes) : "N/A"}
              />
              <MetricRow
                label="Operational duration"
                value={
                  typeof operationalDurationMinutes === "number"
                    ? formatDuration(operationalDurationMinutes)
                    : "N/A"
                }
              />
              <MetricRow
                label="Average speed"
                value={summary ? `${summary.averageSpeedKph.toFixed(1)} km/h` : "N/A"}
              />
              <MetricRow
                label="Max composition speed"
                value={
                  compositionMetrics.maxAllowedSpeedKph > 0
                    ? `${compositionMetrics.maxAllowedSpeedKph} km/h`
                    : "N/A"
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Speed Graph</CardTitle>
              <CardDescription>
                Calculated speed envelope along the planned route distance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SpeedProfileChart points={speedProfile} legPlans={legPlans} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planned Stop Times</CardTitle>
          <CardDescription>
            Arrival and departure times based on leg runtime and your dwell settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {scheduleRows.map((row) => (
              <div key={`${row.stationName}-${row.index}`} className="rounded-lg border bg-card p-3 text-sm">
                <p className="font-medium">
                  {row.index + 1}. {row.stationName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Platform: {formatPlatformLabel(row.selectedPlatform)} · Arrival: {formatTime(row.arrivalTime)} · Departure: {formatTime(row.departureTime)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Track Leg Details</CardTitle>
          <CardDescription>
            Exact segment distance, switch traversal, and line identifiers from OpenRailwayMap data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {legPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No leg details available yet.
            </p>
          ) : (
            legPlans.map((leg, index) => (
              <div key={`${leg.fromName}-${leg.toName}-${index}`} className="rounded-lg border bg-card p-3">
                <p className="text-sm font-semibold">
                  {index + 1}. {leg.fromName} → {leg.toName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(leg.distanceMeters / 1000).toFixed(2)} km · {Math.round(leg.runningTimeSeconds / 60)} min · {leg.switchCount} switches
                </p>
                <p className="text-xs text-muted-foreground">
                  Station snap: {Math.round(leg.fromSnapDistanceMeters)} m / {Math.round(leg.toSnapDistanceMeters)} m
                </p>
                {leg.lines.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Lines: {leg.lines.map(formatLineReference).join(" | ")}
                  </p>
                )}
                {leg.switches.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Switch nodes: {leg.switches.map((sw) => formatSwitch(sw)).join(", ")}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SpeedProfileChart({
  points,
  legPlans,
}: {
  points: RailSpeedProfilePoint[];
  legPlans: RailLegPlan[];
}) {
  const width = 720;
  const height = 220;
  const innerPadding = 24;

  const prepared = useMemo(() => {
    if (!points || points.length < 2) return null;
    const maxDistance = Math.max(
      points[points.length - 1].distanceMeters,
      1
    );
    const maxSpeed = Math.max(
      ...points.map((point) => point.speedKph),
      1
    );
    const plotWidth = width - innerPadding * 2;
    const plotHeight = height - innerPadding * 2;

    const xForDistance = (distanceMeters: number) =>
      innerPadding + (distanceMeters / maxDistance) * plotWidth;
    const yForSpeed = (speedKph: number) =>
      innerPadding + (1 - speedKph / maxSpeed) * plotHeight;

    const polyline = points
      .map((point) => {
        const x = xForDistance(point.distanceMeters);
        const y = yForSpeed(point.speedKph);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    const areaPolyline =
      `${innerPadding},${height - innerPadding} ` +
      polyline +
      ` ${xForDistance(maxDistance).toFixed(1)},${height - innerPadding}`;

    let cumulative = 0;
    const stopMarkers: number[] = [];
    for (const leg of legPlans) {
      cumulative += leg.distanceMeters;
      stopMarkers.push(cumulative);
    }

    const yTicks = 4;
    const yGrid = Array.from({ length: yTicks + 1 }, (_, index) => {
      const speed = (maxSpeed / yTicks) * index;
      return {
        speed,
        y: yForSpeed(speed),
      };
    });

    return {
      maxDistance,
      maxSpeed,
      polyline,
      areaPolyline,
      xForDistance,
      stopMarkers,
      yGrid,
    };
  }, [legPlans, points]);

  if (!prepared) {
    return (
      <p className="text-sm text-muted-foreground">
        No speed profile available yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full rounded-md border bg-background"
        role="img"
        aria-label="Speed profile graph"
      >
        {prepared.yGrid.map((tick) => (
          <g key={`y-${tick.speed.toFixed(1)}`}>
            <line
              x1={innerPadding}
              y1={tick.y}
              x2={width - innerPadding}
              y2={tick.y}
              stroke="currentColor"
              strokeOpacity="0.08"
            />
            <text
              x={innerPadding - 6}
              y={tick.y + 4}
              textAnchor="end"
              fontSize="10"
              fill="currentColor"
              opacity="0.65"
            >
              {Math.round(tick.speed)}
            </text>
          </g>
        ))}
        <line
          x1={innerPadding}
          y1={height - innerPadding}
          x2={width - innerPadding}
          y2={height - innerPadding}
          stroke="currentColor"
          strokeOpacity="0.2"
        />
        <line
          x1={innerPadding}
          y1={innerPadding}
          x2={innerPadding}
          y2={height - innerPadding}
          stroke="currentColor"
          strokeOpacity="0.2"
        />
        <polyline
          fill="currentColor"
          opacity="0.08"
          points={prepared.areaPolyline}
        />
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          points={prepared.polyline}
        />
        {prepared.stopMarkers.map((distance, index) => (
          <line
            key={`stop-${index}-${distance.toFixed(1)}`}
            x1={prepared.xForDistance(distance)}
            y1={innerPadding}
            x2={prepared.xForDistance(distance)}
            y2={height - innerPadding}
            stroke="currentColor"
            strokeOpacity="0.14"
            strokeDasharray="2 3"
          />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0 km</span>
        <span>{(prepared.maxDistance / 1000).toFixed(1)} km</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Peak speed in profile: {prepared.maxSpeed.toFixed(1)} km/h. Dotted vertical lines mark stop boundaries.
      </p>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function buildPlatformSelection(
  stopPlans: RailStopPlan[],
  current: string[]
): string[] {
  return stopPlans.map((stop, index) => {
    if (current[index]) {
      return current[index];
    }
    return stop.likelyPlatform ?? "";
  });
}

function dedupePlatforms(platforms: string[]): string[] {
  const deduped = new Set<string>();
  for (const platform of platforms) {
    const trimmed = platform.trim();
    if (trimmed.length > 0) {
      deduped.add(trimmed);
    }
  }
  return Array.from(deduped.values());
}

function clampDwellMinutes(value: number): number {
  return Math.max(0, Math.min(30, Math.round(value)));
}

function parseLocalDateTime(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed;
}

function formatTime(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours <= 0) return `${mins} min`;
  return `${hours} h ${mins} min`;
}

function defaultDepartureTimeLocal(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;
}

function formatLineReference(line: RailLegPlan["lines"][number]): string {
  const base = line.ref ?? line.name ?? `way ${line.wayId}`;
  const track = line.trackRef ? `track ${line.trackRef}` : null;
  return track ? `${base} (${track})` : base;
}

function formatSwitch(switchNode: RailLegPlan["switches"][number]): string {
  return switchNode.ref ?? switchNode.name ?? `#${switchNode.nodeId}`;
}

function formatPlatformLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "not selected";
  return `Track ${trimmed}`;
}
