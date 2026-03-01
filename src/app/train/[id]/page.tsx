import { notFound } from "next/navigation";
import {
  getTrainById,
  getCoachesByIds,
  getLocomotiveById,
} from "@/lib/actions";
// import { Header } from "@/components/header";
import { CoachDisplay } from "@/components/coach-display";
import { LocomotiveDisplay } from "@/components/locomotive-display";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TrainRouteMap } from "@/components/train-route-map";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  calculateRailTimetableFromInfrastructure,
  findRailStationByName,
} from "@/lib/rail-infrastructure";

interface GeocodedStop {
  name: string;
  originalName: string;
  latitude: number;
  longitude: number;
  displayName: string;
  city?: string;
  country?: string;
}

interface GeocodeResult {
  stations: GeocodedStop[];
  unmatched: string[];
}

// Use the simplest approach for page component
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const trainId = Number.parseInt((await params).id);

  // Fetch the train using the string ID
  const train = await getTrainById(trainId);

  // If no train is found, trigger a 404
  if (!train) {
    return notFound();
  }

  // Fetch coaches and locomotive using IDs from the train object
  const [coaches, locomotive, geocode] = await Promise.all([
    getCoachesByIds(train.kocsiidk || []),
    getLocomotiveById(train.mozdonyid),
    geocodeStops(train.megallok),
  ]);

  const mapStations = geocode.stations.map((stop, index) => ({
    id: `${stop.originalName}-${index}`,
    name: stop.originalName,
    latitude: stop.latitude,
    longitude: stop.longitude,
    region: stop.city ?? "",
    city: stop.city ?? "",
    country: stop.country ?? "",
    platformLengthMeters: 0,
    tracks: 0,
    amenities: [],
  }));

  const geocodedLookup = new Map(
    geocode.stations.map(
      (stop) => [stop.originalName.toLowerCase(), stop] as const
    )
  );

  const totalSeats = coaches.reduce((sum, coach) => {
    const seats = Number.parseInt(coach.ulohelyek, 10);
    return sum + (Number.isFinite(seats) ? seats : 0);
  }, 0);

  const coachSpeedLimit = coaches.reduce(
    (min, coach) => Math.min(min, coach.sebesseg || Infinity),
    Infinity
  );
  const lineSpeed = Math.min(locomotive?.sebesseg ?? Infinity, coachSpeedLimit);
  const lineSpeedDisplay = Number.isFinite(lineSpeed)
    ? `${lineSpeed} km/h`
    : "N/A";

  const infrastructureTimetable =
    geocode.unmatched.length === 0
      ? await calculateRailTimetableFromInfrastructure(
          geocode.stations.map((station) => ({
            name: station.originalName,
            latitude: station.latitude,
            longitude: station.longitude,
          })),
          {
            maxTrainSpeedKph: Number.isFinite(lineSpeed) ? lineSpeed : undefined,
            dwellMinutes: 2,
          }
        )
      : null;

  const infrastructureUsed = Boolean(infrastructureTimetable);

  const routePolyline = infrastructureTimetable
    ? infrastructureTimetable.coordinates.map(
        ([lat, lon]) => [lat, lon] as [number, number]
      )
    : [];

  const routeDistanceKm = infrastructureTimetable
    ? infrastructureTimetable.totalDistanceMeters / 1000
    : null;

  const routeDistanceDisplay = routeDistanceKm
    ? `${routeDistanceKm.toFixed(1)} km`
    : "N/A";

  const durationMinutes = infrastructureTimetable
    ? infrastructureTimetable.durationSeconds / 60
    : null;

  const durationDisplay = durationMinutes
    ? formatDuration(durationMinutes)
    : "N/A";

  const averageSpeed =
    durationMinutes && routeDistanceKm
      ? routeDistanceKm / (durationMinutes / 60)
      : null;

  const averageSpeedDisplay = averageSpeed
    ? `${averageSpeed.toFixed(1)} km/h`
    : "N/A";
  const legPlans = infrastructureTimetable?.legPlans ?? [];
  const stopPlans = infrastructureTimetable?.stopPlans ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <main className="container mx-auto px-4 py-12 space-y-12">
        <Link
          href="/"
          className="inline-flex items-center text-primary hover:underline"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Train List
        </Link>

        <div className="flex flex-col gap-6 rounded-2xl border border-slate-200/70 bg-white/90 p-6 shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary" className="uppercase tracking-wide">
              Train profile
            </Badge>
            <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
              {train.nev || `Train ${train.vonatid}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              Train ID {train.vonatid} · {train.megallok.length} stops ·{" "}
              {coaches.length} coaches
            </p>
            <p className="text-sm text-muted-foreground">
              {train.megallok[0]} → {train.megallok[train.megallok.length - 1]}
            </p>
          </div>
        </div>

        <Card className="shadow-xl border-slate-200/70 bg-white/95">
          <CardHeader>
            <CardTitle>Operational statistics</CardTitle>
            <CardDescription>
              Performance and service capacity details calculated from this
              consist.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Max line speed" value={lineSpeedDisplay} />
              <StatCard
                label="Total seats"
                value={totalSeats.toLocaleString()}
              />
              <StatCard label="Route distance" value={routeDistanceDisplay} />
              <StatCard label="Estimated duration" value={durationDisplay} />
              <StatCard label="Average speed" value={averageSpeedDisplay} />
              <StatCard
                label="Locomotive"
                value={locomotive ? locomotive.nev : "Unknown"}
              />
              <StatCard label="Coach count" value={`${coaches.length}`} />
              <StatCard label="Stops" value={`${train.megallok.length}`} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-slate-200/70 bg-white/95">
          <CardHeader>
            <CardTitle>Track route plan</CardTitle>
            <CardDescription>
              OpenRailwayMap-based leg plan with switches and platform guidance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!infrastructureUsed ? (
              <p className="text-sm text-muted-foreground">
                Route plan unavailable because the infrastructure path could not be fully resolved.
              </p>
            ) : (
              <div className="space-y-3">
                {legPlans.map((leg, index) => (
                  <div key={`${leg.fromName}-${leg.toName}-${index}`} className="rounded-lg border bg-card p-3">
                    <p className="font-medium text-sm">
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
                ))}
                <div className="rounded-lg border bg-card p-3">
                  <p className="font-medium text-sm mb-2">Platform guidance</p>
                  <div className="space-y-1">
                    {stopPlans.map((stop) => (
                      <p key={stop.stopName} className="text-xs text-muted-foreground">
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
          </CardContent>
        </Card>

        <Card className="shadow-lg border-slate-200/70 bg-white/95">
          <CardHeader>
            <CardTitle>Stop itinerary</CardTitle>
            <CardDescription>
              A chronological overview of this service&apos;s stations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-6 border-l border-slate-200 pl-6">
              {train.megallok.map((stop, index) => {
                const matched =
                  geocodedLookup.get(stop.toLowerCase()) ||
                  geocode.stations.find(
                    (entry) => entry.name.toLowerCase() === stop.toLowerCase()
                  );
                return (
                  <li key={`${stop}-${index}`} className="relative">
                    <span className="absolute -left-[9px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary shadow"></span>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">{stop}</p>
                      <Badge variant="outline">Stop {index + 1}</Badge>
                    </div>
                    {matched && (
                      <p
                        className="text-xs text-muted-foreground"
                        title={matched.displayName}
                      >
                        {matched.city ? `${matched.city}, ` : ""}
                        {matched.country ?? ""}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-slate-200/70 bg-white/95">
          <CardHeader>
            <CardTitle>Route visualisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TrainRouteMap
              stations={mapStations}
              selectedStations={mapStations}
              routeLine={routePolyline}
              interactive={false}
            />

            {geocode.unmatched.length > 0 && (
              <Alert>
                <AlertTitle>Missing map data</AlertTitle>
                <AlertDescription>
                  The following stops could not be mapped automatically and are
                  not shown on the map: {geocode.unmatched.join(", ")}
                </AlertDescription>
              </Alert>
            )}
            {!infrastructureUsed && geocode.unmatched.length === 0 && (
              <Alert>
                <AlertTitle>Infrastructure timetable unavailable</AlertTitle>
                <AlertDescription>
                  OpenRailwayMap infrastructure routing could not be completed
                  for this train, so no route geometry is shown.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg border-slate-200/70 bg-white/95">
          <CardHeader>
            <CardTitle>Consist preview</CardTitle>
            <CardDescription>
              Current formation of the locomotive and coaches.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex w-full overflow-x-auto flex-row gap-0 items-end">
              {locomotive && (
                <img
                  src={locomotive.imageurl || ""}
                  alt={locomotive.mozdonyid}
                  title={`${locomotive.nev} • ${locomotive.sebesseg} km/h`}
                  className="h-28 object-contain"
                  crossOrigin="anonymous"
                />
              )}
              {coaches.map((coach, index) => (
                <img
                  key={`${index}.kocsi-${coach.kocsiid}`}
                  src={coach.imageurl || ""}
                  alt={coach.kocsiid}
                  title={`${coach.kocsiosztaly} • ${coach.utaster} • ${coach.sebesseg} km/h`}
                  className="h-24 object-contain"
                  crossOrigin="anonymous"
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {locomotive && (
          <Card className="shadow-lg border-slate-200/70 bg-white/95">
            <CardHeader>
              <CardTitle>Locomotive</CardTitle>
              <CardDescription>
                Technical overview for {locomotive.nev}.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-w-md">
              <LocomotiveDisplay locomotive={locomotive} />
            </CardContent>
          </Card>
        )}

        <Card className="shadow-lg border-slate-200/70 bg-white/95">
          <CardHeader>
            <CardTitle>Coach roster</CardTitle>
            <CardDescription>
              Individual coach cards with capacity and amenities.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {coaches.map((coach, index) => (
                <CoachDisplay
                  key={`${index}.kocsi-${coach.kocsiid}-details`}
                  coach={coach}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

async function geocodeStops(stops: string[]): Promise<GeocodeResult> {
  const results = await Promise.all(
    stops.map(async (stop) => {
      try {
        const station = await findRailStationByName(stop);
        if (!station) {
          return { stop, data: null };
        }

        return {
          stop,
          data: {
            name: station.name,
            originalName: stop,
            latitude: station.latitude,
            longitude: station.longitude,
            displayName: station.displayName,
            city: station.city,
            country: station.country,
          } satisfies GeocodedStop,
        };
      } catch (error) {
        console.error("Rail station lookup failed", error);
        return { stop, data: null };
      }
    })
  );

  const stations: GeocodedStop[] = [];
  const unmatched: string[] = [];

  for (const result of results) {
    if (result.data) {
      stations.push(result.data);
    } else {
      unmatched.push(result.stop);
    }
  }

  return { stations, unmatched };
}

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs <= 0) return `${mins} min`;
  return `${hrs} h ${mins} min`;
}

function formatLineReference(
  line: NonNullable<
    Awaited<ReturnType<typeof calculateRailTimetableFromInfrastructure>>
  >["legPlans"][number]["lines"][number]
): string {
  const base = line.ref ?? line.name ?? `way ${line.wayId}`;
  const track = line.trackRef ? `track ${line.trackRef}` : null;
  return track ? `${base} (${track})` : base;
}

function formatSwitch(
  switchNode: NonNullable<
    Awaited<ReturnType<typeof calculateRailTimetableFromInfrastructure>>
  >["legPlans"][number]["switches"][number]
): string {
  return switchNode.ref ?? switchNode.name ?? `#${switchNode.nodeId}`;
}
