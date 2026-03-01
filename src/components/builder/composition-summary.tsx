"use client";

import type {
  Coach,
  Locomotive,
} from "@/models";
import type { RailLegPlan, RailStopPlan } from "@/lib/rail-infrastructure";
import {
  CompositionMetrics,
  CompositionValidation,
  PlatformWarning,
  TravelTimeSummary,
} from "@/utils/train-calculations";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export interface CompositionSummaryProps {
  locomotive: Locomotive | null;
  coaches: Coach[];
  metrics: CompositionMetrics;
  validation: CompositionValidation;
  platformWarnings: PlatformWarning[];
  travelTime: TravelTimeSummary | null;
  travelTimeLoading?: boolean;
  travelTimeError?: string | null;
  legPlans?: RailLegPlan[];
  stopPlans?: RailStopPlan[];
}

export function CompositionSummary({
  locomotive,
  coaches,
  metrics,
  validation,
  platformWarnings,
  travelTime,
  travelTimeLoading = false,
  travelTimeError = null,
  legPlans = [],
  stopPlans = [],
}: CompositionSummaryProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Composition Summary</CardTitle>
        <CardDescription>
          Check the technical constraints, route compatibility, and journey estimates for this consist.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2">
          <MetricBlock label="Total length" value={`${metrics.totalLengthMeters.toFixed(1)} m`} />
          <MetricBlock label="Max allowed speed" value={metrics.maxAllowedSpeedKph ? `${metrics.maxAllowedSpeedKph} km/h` : "–"} />
          <MetricBlock label="Total weight" value={metrics.totalWeightTons ? `${metrics.totalWeightTons.toFixed(1)} t` : "–"} />
          <MetricBlock label="Coaches" value={coaches.length.toString()} />
        </section>

        <Divider />

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Technical checks
          </h3>
          {validation.warnings.length === 0 && validation.errors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No issues detected.</p>
          ) : (
            <div className="space-y-2">
              {validation.errors.map((message) => (
                <Alert key={message} variant="destructive">
                  <AlertTitle>Issue</AlertTitle>
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              ))}
              {validation.warnings.map((message) => (
                <Alert key={message}>
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </section>

        <Divider />

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Platform compatibility
          </h3>
          {platformWarnings.length === 0 ? (
            <p className="text-sm text-muted-foreground">All selected stations can accommodate this train.</p>
          ) : (
            <div className="space-y-2">
              {platformWarnings.map((warning) => (
                <Alert key={warning.stationId}>
                  <AlertTitle>{warning.stationName}</AlertTitle>
                  <AlertDescription>
                    Platform length {warning.platformLengthMeters} m is shorter than train length {warning.requiredLengthMeters.toFixed(0)} m.
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </section>

        <Divider />

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Journey estimate
          </h3>
          {travelTimeLoading ? (
            <p className="text-sm text-muted-foreground">
              Calculating timetable from OpenRailwayMap infrastructure...
            </p>
          ) : travelTimeError ? (
            <Alert>
              <AlertTitle>Infrastructure timetable unavailable</AlertTitle>
              <AlertDescription>{travelTimeError}</AlertDescription>
            </Alert>
          ) : travelTime ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricBlock
                label="Distance"
                value={`${travelTime.totalDistanceKm.toFixed(1)} km`}
              />
              <MetricBlock
                label="Estimated duration"
                value={formatDuration(travelTime.estimatedDurationMinutes)}
              />
              <MetricBlock
                label="Average speed"
                value={travelTime.averageSpeedKph.toFixed(1) + " km/h"}
              />
              <MetricBlock label="Intermediate stops" value={travelTime.stopCount.toString()} />
              <MetricBlock
                label="Data source"
                value={formatDataSource(travelTime)}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select at least an origin and destination station to calculate travel time.
            </p>
          )}
        </section>

        <Divider />

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Infrastructure route plan
          </h3>
          {legPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add and calculate a route to show track-level legs, switch counts, and platform guidance.
            </p>
          ) : (
            <div className="space-y-3">
              {legPlans.map((leg, index) => (
                <div key={`${leg.fromName}-${leg.toName}-${index}`} className="rounded-lg border bg-card p-3 text-sm">
                  <p className="font-medium">
                    {index + 1}. {leg.fromName} → {leg.toName}
                  </p>
                  <p className="text-muted-foreground">
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
              ))}

              <div className="rounded-lg border bg-card p-3 text-sm">
                <p className="font-medium mb-2">Platform guidance</p>
                <div className="space-y-1">
                  {stopPlans.map((stop) => (
                    <p key={stop.stopName} className="text-muted-foreground">
                      {stop.stopName}: {stop.likelyPlatform ? `likely platform ${stop.likelyPlatform}` : "no platform data"}
                      {typeof stop.snapDistanceMeters === "number"
                        ? ` · snapped ${Math.round(stop.snapDistanceMeters)} m`
                        : ""}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <Divider />

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Summary
          </h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>
              Locomotive: {locomotive ? (
                <Badge variant="outline" className="ml-1">{locomotive.name}</Badge>
              ) : (
                <span className="ml-1">none selected</span>
              )}
            </li>
            <li>
              Coaches: {coaches.length > 0 ? coaches.map((coach, index) => (
                <Badge key={`${coach.id}-${index}`} variant="secondary" className="mr-1 mt-1">
                  {coach.name}
                </Badge>
              )) : <span className="ml-1">none selected</span>}
            </li>
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  if (hours <= 0) return `${remainingMinutes} min`;
  return `${hours} h ${remainingMinutes} min`;
}

function Divider() {
  return <div className="h-px w-full bg-border" />;
}

function formatDataSource(summary: TravelTimeSummary): string {
  if (summary.dataSource === "openrailwaymap") {
    return summary.brakingCurveApplied ? "OpenRailwayMap + braking" : "OpenRailwayMap";
  }
  return "Heuristic estimate";
}

function formatLineReference(line: RailLegPlan["lines"][number]): string {
  const base = line.ref ?? line.name ?? `way ${line.wayId}`;
  const track = line.trackRef ? `track ${line.trackRef}` : null;
  return track ? `${base} (${track})` : base;
}

function formatSwitch(switchNode: RailLegPlan["switches"][number]): string {
  return switchNode.ref ?? switchNode.name ?? `#${switchNode.nodeId}`;
}
