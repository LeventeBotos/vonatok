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

interface RouteGeometryResult {
  coordinates: [number, number][];
  distanceMeters: number | null;
  durationSeconds: number | null;
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

  const routeGeometry = await buildRouteGeometry(geocode.stations);
  const routePolyline = routeGeometry.coordinates.map(
    ([lat, lon]) => [lat, lon] as [number, number]
  );

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

  const routeDistanceKm = routeGeometry.distanceMeters
    ? routeGeometry.distanceMeters / 1000
    : computeFallbackDistance(geocode.stations);

  const routeDistanceDisplay = routeDistanceKm
    ? `${routeDistanceKm.toFixed(1)} km`
    : "N/A";

  const durationMinutes = routeGeometry.durationSeconds
    ? routeGeometry.durationSeconds / 60
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
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(
          `${stop} railway station`
        )}`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "vonatok-app/1.0 (train-builder@example.com)",
          },
        }
      );

      if (!response.ok) {
        return { stop, data: null };
      }

      const payload = (await response.json()) as NominatimResponse[];
      const first = payload[0];
      if (!first) {
        return { stop, data: null };
      }

      const latitude = Number.parseFloat(first.lat);
      const longitude = Number.parseFloat(first.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return { stop, data: null };
      }

      const city =
        first.address?.city ??
        first.address?.town ??
        first.address?.village ??
        first.address?.municipality ??
        first.address?.county ??
        undefined;

      return {
        stop,
        data: {
          name: first.name ?? stop,
          originalName: stop,
          latitude,
          longitude,
          displayName: first.display_name,
          city,
          country: first.address?.country ?? undefined,
        } satisfies GeocodedStop,
      };
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

async function buildRouteGeometry(
  stations: GeocodedStop[]
): Promise<RouteGeometryResult> {
  if (stations.length < 2) {
    return {
      coordinates: stations.map(
        (stop) => [stop.latitude, stop.longitude] as [number, number]
      ),
      distanceMeters: null,
      durationSeconds: null,
    };
  }

  const coordinates = stations
    .map((stop) => `${stop.longitude},${stop.latitude}`)
    .join(";");

  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "vonatok-app/1.0 (train-builder@example.com)",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`OSRM request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as OSRMResponse;
    const route = payload.routes?.[0];
    if (!route) {
      throw new Error("No route geometry returned");
    }

    const geometry = route.geometry?.coordinates ?? [];
    const polyline = geometry.map(
      ([lon, lat]) => [lat, lon] as [number, number]
    );

    return {
      coordinates: polyline,
      distanceMeters: route.distance ?? null,
      durationSeconds: route.duration ?? null,
    };
  } catch (error) {
    console.error("Failed to fetch OSRM route", error);
    return {
      coordinates: stations.map(
        (stop) => [stop.latitude, stop.longitude] as [number, number]
      ),
      distanceMeters: null,
      durationSeconds: null,
    };
  }
}

function computeFallbackDistance(stations: GeocodedStop[]): number | null {
  if (stations.length < 2) {
    return null;
  }

  let total = 0;
  for (let i = 0; i < stations.length - 1; i += 1) {
    total += haversine(stations[i], stations[i + 1]);
  }
  return total;
}

function haversine(a: GeocodedStop, b: GeocodedStop): number {
  const R = 6371; // km
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const calc =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(calc), Math.sqrt(1 - calc));
  return R * c;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs <= 0) return `${mins} min`;
  return `${hrs} h ${mins} min`;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    country?: string;
  };
}

interface OSRMResponse {
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: {
      coordinates?: [number, number][];
    };
  }>;
}
// import { notFound } from "next/navigation";
// import {
//   getTrainById,
//   getCoachesByIds,
//   getLocomotiveById,
// } from "@/lib/actions";
// import { Header } from "@/components/header";
// import { CoachDisplay } from "@/components/coach-display";
// import { LocomotiveDisplay } from "@/components/locomotive-display";
// import { Badge } from "@/components/ui/badge";
// import { ArrowLeft } from "lucide-react";
// import Link from "next/link";

// // No need to define 'TrainDetailPageProps' explicitly anymore
// export default async function TrainDetailPage({
//   params,
// }: {
//   params: { id: string };
// }) {
//   const trainId = Number.parseInt(params.id);

//   if (isNaN(trainId)) {
//     return notFound();
//   }

//   const train = await getTrainById(trainId);

//   if (!train) {
//     return notFound();
//   }

//   const coaches = await getCoachesByIds(train.kocsiidk || []);
//   const locomotive = await getLocomotiveById(train.mozdonyid);

//   return (
//     <div className="min-h-screen flex flex-col">
//       <Header />
//       <main className="flex-1 container mx-auto py-8 px-4">
//         <Link
//           href="/"
//           className="flex items-center text-primary mb-6 hover:underline"
//         >
//           <ArrowLeft size={16} className="mr-2" />
//           Back to Train List
//         </Link>

//         <h1 className="text-3xl font-bold mb-2">{train.megallok[0]}</h1>
//         <p className="text-muted-foreground mb-8">Train ID: {train.vonatid}</p>

//         <div className="mb-8">
//           <h2 className="text-xl font-semibold mb-4">Stops</h2>
//           <div className="flex flex-wrap gap-2">
//             {train.megallok.map((stop, index) => (
//               <Badge
//                 key={index}
//                 variant="outline"
//                 className="text-base py-1 px-3"
//               >
//                 {index > 0 && "→ "}
//                 {stop}
//               </Badge>
//             ))}
//           </div>
//         </div>

//         <div className="flex w-full overflow-x-auto flex-row gap-0 py-10 items-end">
//           {locomotive && (
//             <img src={locomotive.imageurl || ""} alt={locomotive.mozdonyid} />
//           )}
//           {coaches.map((coach, index: number) => (
//             <img
//               key={`${index}.kocsi - ${coach.kocsiid}`}
//               src={coach.imageurl || ""}
//               alt={coach.kocsiid}
//             />
//           ))}
//         </div>
//         {locomotive && (
//           <div className="mb-8">
//             <h2 className="text-xl font-semibold mb-4">Locomotive</h2>
//             <div className="max-w-md">
//               <LocomotiveDisplay locomotive={locomotive} />
//             </div>
//           </div>
//         )}

//         <div className="mb-8">
//           <h2 className="text-xl font-semibold mb-4">Coaches</h2>
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//             {coaches.map((coach, index) => (
//               <CoachDisplay
//                 key={`${index}.kocsi - ${coach.kocsiid} továbbiakban`}
//                 coach={coach}
//               />
//             ))}
//           </div>
//         </div>
//       </main>
//       <footer className="bg-muted py-4 text-center text-sm">
//         <div className="container mx-auto">
//           &copy; {new Date().getFullYear()} Train Data Website
//         </div>
//       </footer>
//     </div>
//   );
// }
