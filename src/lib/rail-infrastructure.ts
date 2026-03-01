export interface RailStopInput {
  name?: string;
  latitude: number;
  longitude: number;
}

export interface RailTimetableOptions {
  maxTrainSpeedKph?: number;
  dwellMinutes?: number;
  accelerationMps2?: number;
  decelerationMps2?: number;
  lateralComfortMps2?: number;
}

export interface RailTimetableResult {
  coordinates: [number, number][];
  totalDistanceMeters: number;
  runningTimeSeconds: number;
  durationSeconds: number;
  legPlans: RailLegPlan[];
  stopPlans: RailStopPlan[];
  speedProfile: RailSpeedProfilePoint[];
}

export interface RailStationLookupResult {
  name: string;
  latitude: number;
  longitude: number;
  displayName: string;
  city?: string;
  country?: string;
}

export interface RailLegPlan {
  fromName: string;
  toName: string;
  distanceMeters: number;
  runningTimeSeconds: number;
  switchCount: number;
  switches: RailSwitchPassage[];
  lines: RailLineReference[];
  fromSnapDistanceMeters: number;
  toSnapDistanceMeters: number;
}

export interface RailStopPlan {
  stopName: string;
  platformCandidates: string[];
  likelyPlatform: string | null;
  snappedNodeId: number | null;
  snapDistanceMeters: number | null;
  snappedCoordinates: [number, number] | null;
}

export interface RailStationCatalogItem {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
}

export interface RailLineReference {
  wayId: number;
  ref?: string;
  name?: string;
  usage?: string;
  electrified?: string;
  gauge?: string;
  trackRef?: string;
}

export interface RailSwitchPassage {
  nodeId: number;
  latitude: number;
  longitude: number;
  ref?: string;
  name?: string;
}

export interface RailSpeedProfilePoint {
  distanceMeters: number;
  speedKph: number;
  legIndex: number;
}

interface RailGraph {
  nodeCoords: Map<number, [number, number]>;
  adjacency: Map<number, RailEdge[]>;
  nodeTags: Map<number, Record<string, string>>;
}

interface RailEdge {
  to: number;
  lengthMeters: number;
  maxSpeedMps: number;
  preferencePenaltySeconds: number;
  wayId: number;
  lineRef?: string;
  lineName?: string;
  usage?: string;
  electrified?: string;
  gauge?: string;
  trackRef?: string;
}

interface PathResult {
  nodeIds: number[];
  points: [number, number][];
  segments: PathSegment[];
  startSnapDistanceMeters: number;
  endSnapDistanceMeters: number;
  travelTimeSeconds: number;
}

interface PathSegment {
  lengthMeters: number;
  maxSpeedMps: number;
  wayId: number;
  lineRef?: string;
  lineName?: string;
  usage?: string;
  electrified?: string;
  gauge?: string;
  trackRef?: string;
}

interface OverpassWay {
  type: "way";
  id: number;
  nodes?: number[];
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassNode {
  type: "node";
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

interface OverpassRelation {
  type: "relation";
  id: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: Array<OverpassWay | OverpassNode | OverpassRelation>;
}

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const EARTH_RADIUS_METERS = 6_371_000;
const MAX_STATION_SNAP_DISTANCE_METERS = 6_000;
const ROUTE_SEGMENT_BBOX_PADS = [0.06, 0.12, 0.2];
const ROUTE_WIDE_BBOX_PAD = 0.25;
const OVERPASS_REQUEST_TIMEOUT_MS = 10_000;
const OVERPASS_GRAPH_TIMEOUT_MS = 18_000;
const OVERPASS_CATALOG_TIMEOUT_MS = 30_000;
const OVERPASS_PLATFORM_TIMEOUT_MS = 12_000;
const ROUTING_MAX_RUNTIME_MS = 40_000;
const RAIL_GRAPH_CACHE_TTL_MS = 5 * 60 * 1000;
const RAIL_GRAPH_CACHE_MAX_ENTRIES = 80;
const PLATFORM_CACHE_TTL_MS = 10 * 60 * 1000;
const PLATFORM_CACHE_MAX_ENTRIES = 300;
const STATION_BBOXES = {
  HU: {
    south: 45.7,
    west: 16.0,
    north: 48.8,
    east: 23.0,
  },
  AT: {
    south: 46.2,
    west: 9.5,
    north: 49.1,
    east: 17.3,
  },
};
type StationCatalogCountryCode = keyof typeof STATION_BBOXES;

const stationCatalogCachePromises = new Map<
  StationCatalogCountryCode,
  Promise<RailStationCatalogItem[]>
>();
const sharedRailGraphCache = new Map<
  string,
  { expiresAt: number; graph: RailGraph }
>();
const sharedPlatformCache = new Map<
  string,
  { expiresAt: number; candidates: PlatformCandidate[] }
>();

export async function calculateRailTimetableFromInfrastructure(
  stops: RailStopInput[],
  options: RailTimetableOptions = {}
): Promise<RailTimetableResult | null> {
  if (stops.length < 2) {
    return null;
  }

  const maxTrainSpeedMps = kphToMps(options.maxTrainSpeedKph ?? 160);
  const accelerationMps2 = clamp(options.accelerationMps2 ?? 0.42, 0.15, 1.2);
  const decelerationMps2 = clamp(options.decelerationMps2 ?? 0.55, 0.2, 1.5);
  const lateralComfortMps2 = clamp(options.lateralComfortMps2 ?? 0.72, 0.3, 1.5);
  const dwellSeconds = Math.max(0, options.dwellMinutes ?? 2) * 60;
  const graphCache = new Map<string, RailGraph>();

  const coordinates: [number, number][] = [];
  const speedProfile: RailSpeedProfilePoint[] = [];
  let totalDistanceMeters = 0;
  let runningTimeSeconds = 0;
  const legPlans: RailLegPlan[] = [];
  const stopAnchors: Array<{
    nodeId: number;
    distanceMeters: number;
    coordinates: [number, number];
  } | null> = new Array(stops.length).fill(null);
  const startedAtMs = Date.now();
  let routeWideGraph: RailGraph | null = null;
  const routeSpan = bboxAround(stops, 0);
  const latSpan = routeSpan.north - routeSpan.south;
  const lonSpan = routeSpan.east - routeSpan.west;
  if (latSpan <= 1.8 && lonSpan <= 1.8) {
    try {
      const routeWideBbox = bboxAround(stops, ROUTE_WIDE_BBOX_PAD);
      routeWideGraph = await getRailGraphCached(routeWideBbox, graphCache);
    } catch {
      routeWideGraph = null;
    }
  }

  for (let i = 0; i < stops.length - 1; i += 1) {
    if (Date.now() - startedAtMs > ROUTING_MAX_RUNTIME_MS) {
      throw new Error("Infrastructure routing timed out internally.");
    }
    const from = stops[i];
    const to = stops[i + 1];
    let graph: RailGraph | null = null;
    let path: PathResult | null = null;

    if (
      routeWideGraph &&
      routeWideGraph.nodeCoords.size > 0 &&
      routeWideGraph.adjacency.size > 0
    ) {
      const candidatePath = shortestPathByTime(
        routeWideGraph,
        [from.latitude, from.longitude],
        [to.latitude, to.longitude]
      );
      if (
        candidatePath &&
        candidatePath.points.length >= 2 &&
        candidatePath.segments.length > 0
      ) {
        graph = routeWideGraph;
        path = candidatePath;
      }
    }

    if (!graph || !path) {
      for (const pad of ROUTE_SEGMENT_BBOX_PADS) {
        if (Date.now() - startedAtMs > ROUTING_MAX_RUNTIME_MS) {
          throw new Error("Infrastructure routing timed out internally.");
        }
        const segmentBbox = bboxAround([from, to], pad);
        const candidateGraph = await getRailGraphCached(segmentBbox, graphCache);
        if (
          candidateGraph.nodeCoords.size === 0 ||
          candidateGraph.adjacency.size === 0
        ) {
          continue;
        }

        const candidatePath = shortestPathByTime(
          candidateGraph,
          [from.latitude, from.longitude],
          [to.latitude, to.longitude]
        );
        if (
          !candidatePath ||
          candidatePath.points.length < 2 ||
          candidatePath.segments.length === 0
        ) {
          continue;
        }

        graph = candidateGraph;
        path = candidatePath;
        break;
      }
    }

    if (!graph || !path || path.points.length < 2 || path.segments.length === 0) {
      return null;
    }

    const speedComputation = runTimeForSegments(
      path.segments,
      path.points,
      maxTrainSpeedMps,
      accelerationMps2,
      decelerationMps2,
      lateralComfortMps2
    );
    const legRuntimeSeconds = speedComputation.totalSeconds;
    const legDistanceMeters = path.segments.reduce(
      (sum, segment) => sum + segment.lengthMeters,
      0
    );
    const switches = extractSwitchPassages(path.nodeIds, graph);
    const switchCount = switches.length;
    const lines = summarizeLineReferences(path.segments);
    const startNodeId = path.nodeIds[0];
    const endNodeId = path.nodeIds[path.nodeIds.length - 1];
    const startCoordinates = graph.nodeCoords.get(startNodeId);
    const endCoordinates = graph.nodeCoords.get(endNodeId);
    if (startCoordinates) {
      assignStopAnchor(stopAnchors, i, {
        nodeId: startNodeId,
        distanceMeters: path.startSnapDistanceMeters,
        coordinates: startCoordinates,
      });
    }
    if (endCoordinates) {
      assignStopAnchor(stopAnchors, i + 1, {
        nodeId: endNodeId,
        distanceMeters: path.endSnapDistanceMeters,
        coordinates: endCoordinates,
      });
    }

    runningTimeSeconds += legRuntimeSeconds;
    appendSpeedProfilePoints(
      speedProfile,
      speedComputation.nodeSpeeds,
      path.segments,
      totalDistanceMeters,
      i
    );
    totalDistanceMeters += legDistanceMeters;
    for (const point of path.points) {
      appendPolylinePoint(coordinates, point);
    }

    legPlans.push({
      fromName: from.name ?? `Stop ${i + 1}`,
      toName: to.name ?? `Stop ${i + 2}`,
      distanceMeters: legDistanceMeters,
      runningTimeSeconds: legRuntimeSeconds,
      switchCount,
      switches,
      lines,
      fromSnapDistanceMeters: path.startSnapDistanceMeters,
      toSnapDistanceMeters: path.endSnapDistanceMeters,
    });
  }

  if (coordinates.length < 2 || totalDistanceMeters <= 0) {
    return null;
  }

  const intermediateStops = Math.max(stops.length - 2, 0);
  const durationSeconds = runningTimeSeconds + intermediateStops * dwellSeconds;
  const stopPlans = await Promise.all(
    stops.map(async (stop, index) => {
      const stopName = stop.name ?? `Stop ${index + 1}`;
      const anchor = stopAnchors[index];
      const probe: [number, number] = anchor?.coordinates ?? [
        stop.latitude,
        stop.longitude,
      ];
      const platforms = await findPlatformsNearStop(probe);
      return {
        stopName,
        platformCandidates: platforms.map((entry) => entry.label),
        likelyPlatform: platforms[0]?.label ?? null,
        snappedNodeId: anchor?.nodeId ?? null,
        snapDistanceMeters: anchor?.distanceMeters ?? null,
        snappedCoordinates: anchor?.coordinates ?? null,
      } satisfies RailStopPlan;
    })
  );

  return {
    coordinates,
    totalDistanceMeters,
    runningTimeSeconds,
    durationSeconds,
    legPlans,
    stopPlans,
    speedProfile,
  };
}

export async function findRailStationByName(
  queryName: string
): Promise<RailStationLookupResult | null> {
  const trimmed = queryName.trim();
  if (!trimmed) return null;
  const escaped = escapeOverpassRegex(trimmed);

  const query = `
    [out:json][timeout:25];
    (
      node["railway"~"^(station|halt)$"]["name"~"^${escaped}$",i];
      way["railway"~"^(station|halt)$"]["name"~"^${escaped}$",i];
      relation["railway"~"^(station|halt)$"]["name"~"^${escaped}$",i];
      node["public_transport"="station"]["name"~"^${escaped}$",i];
      way["public_transport"="station"]["name"~"^${escaped}$",i];
      relation["public_transport"="station"]["name"~"^${escaped}$",i];
    );
    out center tags 8;
  `;

  const response = await overpass(query, OVERPASS_CATALOG_TIMEOUT_MS);
  const candidates = (response.elements ?? [])
    .map((element) => overpassStationToLookup(element))
    .filter((item): item is RailStationLookupResult => item !== null);

  if (candidates.length === 0) return null;

  const exact = candidates.find(
    (item) => item.name.toLowerCase() === trimmed.toLowerCase()
  );
  return exact ?? candidates[0];
}

export async function findRailStationByNameNear(
  queryName: string,
  target: [number, number],
  radiusMeters = 4_000
): Promise<RailStationLookupResult | null> {
  const trimmed = queryName.trim();
  if (!trimmed) return null;
  const escaped = escapeOverpassRegex(trimmed);
  const [lat, lon] = target;
  const radius = clamp(radiusMeters, 200, 15_000);

  const query = `
    [out:json][timeout:25];
    (
      node(around:${radius},${lat},${lon})["railway"~"^(station|halt)$"]["name"~"^${escaped}$",i];
      way(around:${radius},${lat},${lon})["railway"~"^(station|halt)$"]["name"~"^${escaped}$",i];
      relation(around:${radius},${lat},${lon})["railway"~"^(station|halt)$"]["name"~"^${escaped}$",i];
      node(around:${radius},${lat},${lon})["public_transport"="station"]["name"~"^${escaped}$",i];
      way(around:${radius},${lat},${lon})["public_transport"="station"]["name"~"^${escaped}$",i];
      relation(around:${radius},${lat},${lon})["public_transport"="station"]["name"~"^${escaped}$",i];
    );
    out center tags 24;
  `;

  const response = await overpass(query, OVERPASS_GRAPH_TIMEOUT_MS);
  const candidates = (response.elements ?? [])
    .map((element) => overpassStationToLookup(element))
    .filter((item): item is RailStationLookupResult => item !== null)
    .sort(
      (a, b) =>
        haversineMeters([a.latitude, a.longitude], target) -
        haversineMeters([b.latitude, b.longitude], target)
    );

  if (candidates.length > 0) {
    return candidates[0];
  }

  return findRailStationByName(queryName);
}

export async function findRailStationsByText(
  queryText: string,
  limit = 8
): Promise<RailStationLookupResult[]> {
  const trimmed = queryText.trim();
  if (!trimmed) return [];
  const escaped = escapeOverpassRegex(trimmed);

  const query = `
    [out:json][timeout:25];
    (
      node["railway"~"^(station|halt)$"]["name"~"${escaped}",i];
      way["railway"~"^(station|halt)$"]["name"~"${escaped}",i];
      relation["railway"~"^(station|halt)$"]["name"~"${escaped}",i];
      node["public_transport"="station"]["name"~"${escaped}",i];
      way["public_transport"="station"]["name"~"${escaped}",i];
      relation["public_transport"="station"]["name"~"${escaped}",i];
    );
    out center tags 64;
  `;

  const response = await overpass(query);
  const raw = (response.elements ?? [])
    .map((element) => overpassStationToLookup(element))
    .filter((item): item is RailStationLookupResult => item !== null);

  const deduped = new Map<string, RailStationLookupResult>();
  for (const entry of raw) {
    const key = `${entry.name}|${entry.latitude.toFixed(5)}|${entry.longitude.toFixed(5)}`;
    if (!deduped.has(key)) {
      deduped.set(key, entry);
    }
  }

  const normalizedNeedle = trimmed.toLowerCase();
  return Array.from(deduped.values())
    .sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aExact = aName === normalizedNeedle ? 0 : aName.startsWith(normalizedNeedle) ? 1 : 2;
      const bExact = bName === normalizedNeedle ? 0 : bName.startsWith(normalizedNeedle) ? 1 : 2;
      if (aExact !== bExact) return aExact - bExact;
      return aName.localeCompare(bName);
    })
    .slice(0, Math.max(1, limit));
}

export async function getRailStationsInHungary(): Promise<RailStationCatalogItem[]> {
  return getRailStationsByCountry("HU");
}

export async function getRailStationsInAustria(): Promise<RailStationCatalogItem[]> {
  return getRailStationsByCountry("AT");
}

async function getRailStationsByCountry(
  countryCode: StationCatalogCountryCode
): Promise<RailStationCatalogItem[]> {
  const cached = stationCatalogCachePromises.get(countryCode);
  if (cached) return cached;

  const loader = loadRailStationsInBbox(STATION_BBOXES[countryCode]).catch((error) => {
    stationCatalogCachePromises.delete(countryCode);
    throw error;
  });
  stationCatalogCachePromises.set(countryCode, loader);
  return loader;
}

async function loadRailStationsInBbox(bbox: {
  south: number;
  west: number;
  north: number;
  east: number;
}): Promise<RailStationCatalogItem[]> {
  const query = `
    [out:json][timeout:90];
    (
      node["railway"="station"]["station"!~"^(subway|light_rail|tram|monorail|funicular)$"]["usage"!~"^(branch|industrial|military|tourism|mine)$"]["service"!~"^(yard|siding|spur|crossover|passing_loop)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["railway"="station"]["station"!~"^(subway|light_rail|tram|monorail|funicular)$"]["usage"!~"^(branch|industrial|military|tourism|mine)$"]["service"!~"^(yard|siding|spur|crossover|passing_loop)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      relation["railway"="station"]["station"!~"^(subway|light_rail|tram|monorail|funicular)$"]["usage"!~"^(branch|industrial|military|tourism|mine)$"]["service"!~"^(yard|siding|spur|crossover|passing_loop)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    );
    out center tags;
  `;

  const response = await overpass(query);
  const stations = (response.elements ?? [])
    .filter((element) => isMainLineRailwayStation(element))
    .map((element) => overpassStationToLookup(element))
    .filter((item): item is RailStationLookupResult => item !== null);

  const deduped = new Map<string, RailStationCatalogItem>();
  for (const station of stations) {
    const id = `${station.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${station.latitude.toFixed(5)}-${station.longitude.toFixed(5)}`;
    if (!deduped.has(id)) {
      deduped.set(id, {
        id,
        name: station.name,
        latitude: station.latitude,
        longitude: station.longitude,
        city: station.city,
        country: station.country,
      });
    }
  }

  return Array.from(deduped.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function isMainLineRailwayStation(
  element: OverpassWay | OverpassNode | OverpassRelation
): boolean {
  const tags = element.tags ?? {};
  if (tags.railway !== "station") {
    return false;
  }

  const stationType = (tags.station ?? "").toLowerCase();
  if (
    stationType === "subway" ||
    stationType === "light_rail" ||
    stationType === "tram" ||
    stationType === "monorail" ||
    stationType === "funicular"
  ) {
    return false;
  }

  const usage = (tags.usage ?? "").toLowerCase();
  if (
    usage === "branch" ||
    usage === "industrial" ||
    usage === "military" ||
    usage === "tourism" ||
    usage === "mine"
  ) {
    return false;
  }

  const service = (tags.service ?? "").toLowerCase();
  if (
    service === "yard" ||
    service === "siding" ||
    service === "spur" ||
    service === "crossover" ||
    service === "passing_loop"
  ) {
    return false;
  }

  return true;
}

function runTimeForSegments(
  segments: PathSegment[],
  points: [number, number][],
  maxTrainSpeedMps: number,
  accelerationMps2: number,
  decelerationMps2: number,
  lateralComfortMps2: number
): { totalSeconds: number; nodeSpeeds: number[] } {
  const nodeSpeedLimits = buildNodeSpeedLimits(
    segments,
    points,
    maxTrainSpeedMps,
    lateralComfortMps2
  );
  const nodeSpeeds = enforceBrakingEnvelope(
    nodeSpeedLimits,
    segments,
    accelerationMps2,
    decelerationMps2
  );

  let totalSeconds = 0;
  for (let i = 0; i < segments.length; i += 1) {
    totalSeconds += computeSegmentRuntimeSeconds(
      segments[i].lengthMeters,
      nodeSpeeds[i],
      nodeSpeeds[i + 1],
      Math.min(segments[i].maxSpeedMps, maxTrainSpeedMps),
      accelerationMps2,
      decelerationMps2
    );
  }

  return {
    totalSeconds,
    nodeSpeeds,
  };
}

function buildNodeSpeedLimits(
  segments: PathSegment[],
  points: [number, number][],
  maxTrainSpeedMps: number,
  lateralComfortMps2: number
): number[] {
  const nodeLimits = new Array<number>(segments.length + 1).fill(maxTrainSpeedMps);
  nodeLimits[0] = 0;
  nodeLimits[nodeLimits.length - 1] = 0;

  for (let i = 0; i < segments.length; i += 1) {
    const capped = Math.min(maxTrainSpeedMps, segments[i].maxSpeedMps);
    nodeLimits[i] = Math.min(nodeLimits[i], capped);
    nodeLimits[i + 1] = Math.min(nodeLimits[i + 1], capped);
  }

  for (let i = 1; i < points.length - 1; i += 1) {
    const curveLimit = curveSpeedLimitMps(
      points[i - 1],
      points[i],
      points[i + 1],
      lateralComfortMps2
    );
    nodeLimits[i] = Math.min(nodeLimits[i], curveLimit);
  }

  return nodeLimits;
}

function enforceBrakingEnvelope(
  nodeSpeedLimits: number[],
  segments: PathSegment[],
  accelerationMps2: number,
  decelerationMps2: number
): number[] {
  const speeds = [...nodeSpeedLimits];

  // The forward/backward passes enforce physically reachable speed changes
  // and form the braking curve envelope between consecutive stops.
  for (let pass = 0; pass < 3; pass += 1) {
    for (let i = 0; i < segments.length; i += 1) {
      const reachable = Math.sqrt(
        Math.max(0, speeds[i] * speeds[i] + 2 * accelerationMps2 * segments[i].lengthMeters)
      );
      speeds[i + 1] = Math.min(speeds[i + 1], reachable);
    }

    for (let i = segments.length - 1; i >= 0; i -= 1) {
      const reachable = Math.sqrt(
        Math.max(0, speeds[i + 1] * speeds[i + 1] + 2 * decelerationMps2 * segments[i].lengthMeters)
      );
      speeds[i] = Math.min(speeds[i], reachable);
    }
  }

  speeds[0] = 0;
  speeds[speeds.length - 1] = 0;
  return speeds;
}

function computeSegmentRuntimeSeconds(
  lengthMeters: number,
  startSpeedMps: number,
  endSpeedMps: number,
  speedCapMps: number,
  accelerationMps2: number,
  decelerationMps2: number
): number {
  if (lengthMeters <= 0) return 0;

  const vCap = Math.max(speedCapMps, 0.1);
  const v0 = clamp(startSpeedMps, 0, vCap);
  const v1 = clamp(endSpeedMps, 0, vCap);

  const peakSqNumerator =
    2 * accelerationMps2 * decelerationMps2 * lengthMeters +
    decelerationMps2 * v0 * v0 +
    accelerationMps2 * v1 * v1;
  const peakSqDenominator = accelerationMps2 + decelerationMps2;
  const unconstrainedPeak = Math.sqrt(Math.max(0, peakSqNumerator / peakSqDenominator));
  const vPeak = Math.min(vCap, Math.max(v0, v1, unconstrainedPeak));

  const dAcc = Math.max(0, (vPeak * vPeak - v0 * v0) / (2 * accelerationMps2));
  const dDec = Math.max(0, (vPeak * vPeak - v1 * v1) / (2 * decelerationMps2));
  const dCruise = Math.max(0, lengthMeters - dAcc - dDec);

  const tAcc = Math.max(0, (vPeak - v0) / accelerationMps2);
  const tDec = Math.max(0, (vPeak - v1) / decelerationMps2);
  const tCruise = dCruise / Math.max(vPeak, 0.1);

  const total = tAcc + tDec + tCruise;
  if (!Number.isFinite(total) || total <= 0) {
    const fallbackSpeed = Math.max((v0 + v1) / 2, 0.5);
    return lengthMeters / fallbackSpeed;
  }
  return total;
}

function curveSpeedLimitMps(
  prev: [number, number],
  curr: [number, number],
  next: [number, number],
  lateralComfortMps2: number
): number {
  const a = haversineMeters(prev, curr);
  const b = haversineMeters(curr, next);
  const c = haversineMeters(prev, next);
  if (a < 20 || b < 20) return Number.POSITIVE_INFINITY;

  const theta = turnAngleRadians(prev, curr, next);
  if (theta < 0.17) return Number.POSITIVE_INFINITY;

  const areaTwice = triangleDoubleAreaMeters(prev, curr, next);
  if (areaTwice <= 1e-6) return Number.POSITIVE_INFINITY;

  const radius = (a * b * c) / (2 * areaTwice);
  if (!Number.isFinite(radius) || radius <= 0) return Number.POSITIVE_INFINITY;

  return Math.sqrt(lateralComfortMps2 * radius);
}

function turnAngleRadians(
  prev: [number, number],
  curr: [number, number],
  next: [number, number]
): number {
  const [ax, ay] = projectedDeltaMeters(curr, prev);
  const [bx, by] = projectedDeltaMeters(curr, next);
  const aLen = Math.hypot(ax, ay);
  const bLen = Math.hypot(bx, by);
  if (aLen === 0 || bLen === 0) return 0;
  const dot = (ax * bx + ay * by) / (aLen * bLen);
  const clamped = clamp(dot, -1, 1);
  return Math.acos(clamped);
}

function triangleDoubleAreaMeters(
  a: [number, number],
  b: [number, number],
  c: [number, number]
): number {
  const [abx, aby] = projectedDeltaMeters(a, b);
  const [acx, acy] = projectedDeltaMeters(a, c);
  return Math.abs(abx * acy - aby * acx);
}

function projectedDeltaMeters(
  origin: [number, number],
  target: [number, number]
): [number, number] {
  const lat1 = toRadians(origin[0]);
  const lat2 = toRadians(target[0]);
  const lon1 = toRadians(origin[1]);
  const lon2 = toRadians(target[1]);
  const x = (lon2 - lon1) * Math.cos((lat1 + lat2) / 2) * EARTH_RADIUS_METERS;
  const y = (lat2 - lat1) * EARTH_RADIUS_METERS;
  return [x, y];
}

function appendPolylinePoint(out: [number, number][], point: [number, number]) {
  const previous = out[out.length - 1];
  if (!previous) {
    out.push(point);
    return;
  }
  if (
    Math.abs(previous[0] - point[0]) < 1e-7 &&
    Math.abs(previous[1] - point[1]) < 1e-7
  ) {
    return;
  }
  out.push(point);
}

function appendSpeedProfilePoints(
  out: RailSpeedProfilePoint[],
  nodeSpeedsMps: number[],
  segments: PathSegment[],
  distanceOffsetMeters: number,
  legIndex: number
) {
  let distance = distanceOffsetMeters;
  for (let i = 0; i < nodeSpeedsMps.length; i += 1) {
    const point: RailSpeedProfilePoint = {
      distanceMeters: distance,
      speedKph: nodeSpeedsMps[i] * 3.6,
      legIndex,
    };
    const previous = out[out.length - 1];
    if (
      !previous ||
      Math.abs(previous.distanceMeters - point.distanceMeters) > 0.01 ||
      Math.abs(previous.speedKph - point.speedKph) > 0.2
    ) {
      out.push(point);
    }
    if (i < segments.length) {
      distance += segments[i].lengthMeters;
    }
  }
}

async function fetchRailGraph(bbox: {
  south: number;
  west: number;
  north: number;
  east: number;
}): Promise<RailGraph> {
  const query = `
    [out:json][timeout:40];
    (
      way["railway"="rail"]["service"!~"yard|siding|spur|crossover|passing_loop"]["usage"!~"industrial|military|tourism|mine"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    );
    (._;>;);
    out body;
  `;
  const response = await overpass(query, OVERPASS_GRAPH_TIMEOUT_MS);
  return extractRailGraph(response);
}

async function getRailGraphCached(
  bbox: { south: number; west: number; north: number; east: number },
  localCache: Map<string, RailGraph>
): Promise<RailGraph> {
  const key = railGraphCacheKey(bbox);
  const local = localCache.get(key);
  if (local) return local;

  const now = Date.now();
  const shared = sharedRailGraphCache.get(key);
  if (shared && shared.expiresAt > now) {
    localCache.set(key, shared.graph);
    return shared.graph;
  }

  const graph = await fetchRailGraph(bbox);
  localCache.set(key, graph);
  sharedRailGraphCache.set(key, {
    graph,
    expiresAt: now + RAIL_GRAPH_CACHE_TTL_MS,
  });
  pruneSharedRailGraphCache(now);
  return graph;
}

function railGraphCacheKey(bbox: {
  south: number;
  west: number;
  north: number;
  east: number;
}): string {
  return [
    bbox.south.toFixed(3),
    bbox.west.toFixed(3),
    bbox.north.toFixed(3),
    bbox.east.toFixed(3),
  ].join("|");
}

function pruneSharedRailGraphCache(now: number) {
  for (const [key, entry] of sharedRailGraphCache) {
    if (entry.expiresAt <= now) {
      sharedRailGraphCache.delete(key);
    }
  }

  while (sharedRailGraphCache.size > RAIL_GRAPH_CACHE_MAX_ENTRIES) {
    const firstKey = sharedRailGraphCache.keys().next().value;
    if (!firstKey) break;
    sharedRailGraphCache.delete(firstKey);
  }
}

async function overpass(
  query: string,
  timeoutMs = OVERPASS_REQUEST_TIMEOUT_MS
): Promise<OverpassResponse> {
  let lastError: unknown = null;

  for (const endpoint of OVERPASS_URLS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Accept: "application/json",
          "User-Agent": "vonatok-app/1.0 (train-builder@example.com)",
        },
        signal: controller.signal,
        body: new URLSearchParams({ data: query }).toString(),
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Overpass request failed with status ${response.status}`);
      }
      const contentType = response.headers.get("content-type") ?? "";
      const raw = await response.text();
      if (contentType.toLowerCase().includes("json")) {
        try {
          return JSON.parse(raw) as OverpassResponse;
        } catch {
          const snippet = raw.slice(0, 180).replace(/\s+/g, " ").trim();
          throw new Error(
            `Overpass returned invalid JSON (${endpoint}): ${snippet}`
          );
        }
      }
      const snippet = raw.slice(0, 180).replace(/\s+/g, " ").trim();
      throw new Error(
        `Overpass returned non-JSON response (${endpoint}): ${snippet}`
      );
    } catch (error) {
      clearTimeout(timeoutId);
      if (isAbortError(error)) {
        lastError = new Error(
          `Overpass request timed out after ${timeoutMs} ms (${endpoint})`
        );
      } else {
        lastError = error;
      }
    }
  }

  throw lastError ?? new Error("All Overpass endpoints failed");
}

interface PlatformCandidate {
  label: string;
  distanceMeters: number;
  labelPriority: number;
}

async function findPlatformsNearStop(
  stop: [number, number]
): Promise<PlatformCandidate[]> {
  const [lat, lon] = stop;
  const cacheKey = platformCacheKey(stop);
  const now = Date.now();
  const cached = sharedPlatformCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.candidates;
  }

  const query = `
    [out:json][timeout:30];
    (
      node(around:350,${lat},${lon})["railway"="platform"];
      way(around:350,${lat},${lon})["railway"="platform"];
      relation(around:350,${lat},${lon})["railway"="platform"];
      node(around:350,${lat},${lon})["public_transport"="platform"];
      way(around:350,${lat},${lon})["public_transport"="platform"];
      relation(around:350,${lat},${lon})["public_transport"="platform"];
    );
    out center tags 24;
  `;

  try {
    const response = await overpass(query, OVERPASS_PLATFORM_TIMEOUT_MS);
    const candidates = (response.elements ?? [])
      .map((element) => overpassPlatformToCandidate(element, stop))
      .filter((item): item is PlatformCandidate => item !== null)
      .sort((a, b) => {
        if (a.labelPriority !== b.labelPriority) {
          return b.labelPriority - a.labelPriority;
        }
        return a.distanceMeters - b.distanceMeters;
      });

    const deduped = new Map<string, PlatformCandidate>();
    for (const candidate of candidates) {
      if (!deduped.has(candidate.label)) {
        deduped.set(candidate.label, candidate);
      }
    }
    const result = Array.from(deduped.values()).slice(0, 8);
    sharedPlatformCache.set(cacheKey, {
      expiresAt: now + PLATFORM_CACHE_TTL_MS,
      candidates: result,
    });
    pruneSharedPlatformCache(now);
    return result;
  } catch {
    return [];
  }
}

function platformCacheKey(stop: [number, number]): string {
  return `${stop[0].toFixed(4)}|${stop[1].toFixed(4)}`;
}

function pruneSharedPlatformCache(now: number) {
  for (const [key, entry] of sharedPlatformCache) {
    if (entry.expiresAt <= now) {
      sharedPlatformCache.delete(key);
    }
  }
  while (sharedPlatformCache.size > PLATFORM_CACHE_MAX_ENTRIES) {
    const firstKey = sharedPlatformCache.keys().next().value;
    if (!firstKey) break;
    sharedPlatformCache.delete(firstKey);
  }
}

function overpassStationToLookup(
  element: OverpassWay | OverpassNode | OverpassRelation
): RailStationLookupResult | null {
  const tags = element.tags ?? {};
  const name = tags.name;
  if (!name) return null;

  let latitude: number | undefined;
  let longitude: number | undefined;

  if (element.type === "node") {
    latitude = element.lat;
    longitude = element.lon;
  } else {
    latitude = element.center?.lat;
    longitude = element.center?.lon;
  }

  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  const city =
    tags.city ??
    tags.town ??
    tags.village ??
    tags.municipality ??
    tags["addr:city"] ??
    undefined;
  const country = tags["addr:country"] ?? tags.country ?? undefined;

  return {
    name,
    latitude,
    longitude,
    displayName: `${name}${city ? `, ${city}` : ""}${country ? `, ${country}` : ""}`,
    city,
    country,
  };
}

function overpassPlatformToCandidate(
  element: OverpassWay | OverpassNode | OverpassRelation,
  stop: [number, number]
): PlatformCandidate | null {
  const tags = element.tags ?? {};

  let latitude: number | undefined;
  let longitude: number | undefined;
  if (element.type === "node") {
    latitude = element.lat;
    longitude = element.lon;
  } else {
    latitude = element.center?.lat;
    longitude = element.center?.lon;
  }

  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  const normalizedLabel = normalizePlatformLabel(tags);
  if (!normalizedLabel) return null;

  return {
    label: normalizedLabel.label,
    distanceMeters: haversineMeters([latitude, longitude], stop),
    labelPriority: normalizedLabel.priority,
  };
}

function normalizePlatformLabel(
  tags: Record<string, string>
): { label: string; priority: number } | null {
  const direct =
    firstNonEmpty(
      tags.ref,
      tags.local_ref,
      tags.platform,
      tags.platform_ref,
      tags["railway:platform_ref"],
      tags["railway:track_ref"],
      tags.track_ref
    ) ?? null;
  if (direct) {
    const canonical = canonicalPlatformIdentifier(direct);
    if (canonical) {
      return { label: canonical, priority: 3 };
    }
  }

  const text = firstNonEmpty(tags.name, tags.description) ?? null;
  if (!text) return null;

  const parsed = parsePlatformFromText(text);
  if (parsed) {
    return { label: parsed, priority: 2 };
  }

  return null;
}

function parsePlatformFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const keywordFirst = trimmed.match(
    /(platform|peron|v[aá]g[aá]ny|track)\s*([0-9]+[a-z]?|[ivx]+)/i
  );
  if (keywordFirst) {
    return canonicalPlatformIdentifier(keywordFirst[2]);
  }

  const numberFirst = trimmed.match(
    /([0-9]+[a-z]?|[ivx]+)[.\s-]*(platform|peron|v[aá]g[aá]ny|track)/i
  );
  if (numberFirst) {
    return canonicalPlatformIdentifier(numberFirst[1]);
  }

  return null;
}

function canonicalPlatformIdentifier(raw: string): string | null {
  const normalized = raw.trim().replace(/\s+/g, "").toUpperCase();
  if (!normalized) return null;
  const cleaned = normalized.replace(/^PLATFORM/, "").replace(/^PERON/, "");
  if (!/^[0-9IVX]+[A-Z]?$/.test(cleaned)) {
    return null;
  }
  const match = cleaned.match(/^([0-9IVX]+)([A-Z]?)$/);
  if (!match) return null;
  const primary = match[1];
  const suffix = match[2] ?? "";
  const numericPrimary = /^\d+$/.test(primary)
    ? primary
    : romanToInt(primary)?.toString();
  if (!numericPrimary) return null;
  return `${numericPrimary}${suffix}`;
}

function romanToInt(value: string): number | null {
  const roman = value.toUpperCase();
  if (!/^[IVXLCDM]+$/.test(roman)) return null;
  const map: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };
  let total = 0;
  let i = 0;
  while (i < roman.length) {
    const current = map[roman[i]];
    const next = map[roman[i + 1]] ?? 0;
    if (next > current) {
      total += next - current;
      i += 2;
    } else {
      total += current;
      i += 1;
    }
  }
  return total > 0 ? total : null;
}

function escapeOverpassRegex(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\./g, "\\.")
    .replace(/\*/g, "\\*")
    .replace(/\+/g, "\\+")
    .replace(/\?/g, "\\?")
    .replace(/\^/g, "\\^")
    .replace(/\$/g, "\\$")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\|/g, "\\|");
}

function extractRailGraph(resp: OverpassResponse): RailGraph {
  const nodeCoords = new Map<number, [number, number]>();
  const nodeTags = new Map<number, Record<string, string>>();
  const ways: Array<{ id: number; nodes: number[]; tags: Record<string, string> }> = [];

  for (const element of resp.elements ?? []) {
    if (
      element.type === "node" &&
      typeof element.lat === "number" &&
      typeof element.lon === "number"
    ) {
      nodeCoords.set(element.id, [element.lat, element.lon]);
      nodeTags.set(element.id, element.tags ?? {});
      continue;
    }

    if (element.type === "way" && Array.isArray(element.nodes) && element.nodes.length >= 2) {
      ways.push({ id: element.id, nodes: element.nodes, tags: element.tags ?? {} });
    }
  }

  const adjacency = new Map<number, RailEdge[]>();

  for (const way of ways) {
    const speedMps = kphToMps(inferWaySpeedKph(way.tags));
    const wayLineInfo = buildWayLineInfo(way.id, way.tags);
    const direction = parseWayDirectionPreference(way.tags);
    for (let i = 0; i < way.nodes.length - 1; i += 1) {
      const fromId = way.nodes[i];
      const toId = way.nodes[i + 1];
      const from = nodeCoords.get(fromId);
      const to = nodeCoords.get(toId);
      if (!from || !to) continue;
      const lengthMeters = haversineMeters(from, to);
      if (lengthMeters <= 0) continue;

      if (direction.allowForward) {
        addEdge(adjacency, fromId, {
          to: toId,
          lengthMeters,
          maxSpeedMps: speedMps,
          preferencePenaltySeconds: directionPenaltySeconds(
            direction.preferred,
            "forward",
            lengthMeters
          ),
          ...wayLineInfo,
        });
      }
      if (direction.allowBackward) {
        addEdge(adjacency, toId, {
          to: fromId,
          lengthMeters,
          maxSpeedMps: speedMps,
          preferencePenaltySeconds: directionPenaltySeconds(
            direction.preferred,
            "backward",
            lengthMeters
          ),
          ...wayLineInfo,
        });
      }
    }
  }

  return { nodeCoords, adjacency, nodeTags };
}

function addEdge(adjacency: Map<number, RailEdge[]>, from: number, edge: RailEdge) {
  if (!adjacency.has(from)) {
    adjacency.set(from, []);
  }
  adjacency.get(from)!.push(edge);
}

function inferWaySpeedKph(tags: Record<string, string>): number {
  const speedCandidates = [
    tags.maxspeed,
    tags["maxspeed:forward"],
    tags["maxspeed:backward"],
  ]
    .map(parseMaxspeedKph)
    .filter((value): value is number => value !== null);

  if (speedCandidates.length > 0) {
    return clamp(Math.min(...speedCandidates), 20, 320);
  }

  if (tags.highspeed === "yes") return 250;
  if (tags.usage === "main") return 160;
  if (tags.usage === "branch") return 95;
  if (typeof tags.service === "string" && tags.service.length > 0) return 40;
  return 120;
}

function buildWayLineInfo(wayId: number, tags: Record<string, string>) {
  return {
    wayId,
    lineRef: firstNonEmpty(tags.ref, tags["route_ref"], tags["railway:line"], tags.line),
    lineName: firstNonEmpty(tags.name, tags["official_name"]),
    usage: firstNonEmpty(tags.usage),
    electrified: firstNonEmpty(tags.electrified),
    gauge: firstNonEmpty(tags.gauge),
    trackRef: firstNonEmpty(
      tags["railway:track_ref"],
      tags.track_ref,
      tags.local_ref
    ),
  };
}

function parseWayDirectionPreference(tags: Record<string, string>): {
  allowForward: boolean;
  allowBackward: boolean;
  preferred: "forward" | "backward" | "both";
} {
  const oneway = (tags.oneway ?? "").toLowerCase();
  let allowForward = true;
  let allowBackward = true;
  if (
    oneway === "yes" ||
    oneway === "1" ||
    oneway === "true"
  ) {
    allowBackward = false;
  } else if (oneway === "-1") {
    allowForward = false;
  }

  const preferredRaw = (
    tags["railway:preferred_direction"] ??
    tags.preferred_direction ??
    tags.direction ??
    ""
  ).toLowerCase();
  let preferred: "forward" | "backward" | "both" = "both";
  if (preferredRaw === "forward") preferred = "forward";
  if (preferredRaw === "backward") preferred = "backward";

  const hasForwardMaxspeed = Boolean(firstNonEmpty(tags["maxspeed:forward"]));
  const hasBackwardMaxspeed = Boolean(firstNonEmpty(tags["maxspeed:backward"]));
  if (preferred === "both") {
    if (hasForwardMaxspeed && !hasBackwardMaxspeed) preferred = "forward";
    if (hasBackwardMaxspeed && !hasForwardMaxspeed) preferred = "backward";
  }

  return { allowForward, allowBackward, preferred };
}

function directionPenaltySeconds(
  preferred: "forward" | "backward" | "both",
  actual: "forward" | "backward",
  lengthMeters: number
): number {
  if (preferred === "both" || preferred === actual) {
    return 0;
  }
  // Stronger soft penalty (~8.3 sec/km) to better favor mapped running side/direction.
  return Math.min(90, lengthMeters / 120);
}

function parseMaxspeedKph(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length === 0 ||
    normalized === "none" ||
    normalized === "signals" ||
    normalized === "variable" ||
    normalized === "national"
  ) {
    return null;
  }

  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;

  let parsed = Number.parseFloat(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  if (normalized.includes("mph")) {
    parsed *= 1.60934;
  } else if (normalized.includes("kn")) {
    parsed *= 1.852;
  }

  return parsed;
}

function shortestPathByTime(
  graph: RailGraph,
  from: [number, number],
  to: [number, number]
): PathResult | null {
  const startCandidates = nearestNodeCandidates(
    graph,
    from,
    MAX_STATION_SNAP_DISTANCE_METERS,
    4
  );
  const endCandidates = nearestNodeCandidates(
    graph,
    to,
    MAX_STATION_SNAP_DISTANCE_METERS,
    4
  );
  if (startCandidates.length === 0 || endCandidates.length === 0) {
    return null;
  }

  const combos: Array<{ start: NodeCandidate; end: NodeCandidate; snapPenalty: number }> = [];
  for (const start of startCandidates) {
    for (const end of endCandidates) {
      combos.push({
        start,
        end,
        snapPenalty: start.distanceMeters + end.distanceMeters,
      });
    }
  }
  combos.sort((a, b) => a.snapPenalty - b.snapPenalty);

  let best: PathResult | null = null;
  for (const combo of combos) {
    const candidate = shortestPathBetweenNodes(
      graph,
      combo.start,
      combo.end
    );
    if (!candidate) continue;
    if (!best || candidate.travelTimeSeconds < best.travelTimeSeconds) {
      best = candidate;
    }
  }

  return best;
}

interface NodeCandidate {
  id: number;
  distanceMeters: number;
}

interface HeapItem {
  node: number;
  cost: number;
}

function shortestPathBetweenNodes(
  graph: RailGraph,
  start: NodeCandidate,
  end: NodeCandidate
): PathResult | null {
  const dist = new Map<number, number>();
  const prev = new Map<number, { node: number; edge: RailEdge }>();
  const heap: HeapItem[] = [];
  const visited = new Set<number>();

  dist.set(start.id, 0);
  pushMinHeap(heap, { node: start.id, cost: 0 });

  while (heap.length > 0) {
    const current = popMinHeap(heap);
    if (!current) break;
    if (visited.has(current.node)) continue;
    visited.add(current.node);

    if (current.node === end.id) {
      break;
    }

    const baseCost = dist.get(current.node);
    if (!Number.isFinite(baseCost)) continue;

    for (const edge of graph.adjacency.get(current.node) ?? []) {
      if (visited.has(edge.to)) continue;
      const edgeSpeed = Math.max(edge.maxSpeedMps, 0.1);
      const travelCost = edge.lengthMeters / edgeSpeed;
      const nextCost = baseCost! + travelCost + edge.preferencePenaltySeconds;
      if (nextCost < (dist.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        dist.set(edge.to, nextCost);
        prev.set(edge.to, { node: current.node, edge });
        pushMinHeap(heap, { node: edge.to, cost: nextCost });
      }
    }
  }

  if (!prev.has(end.id) && start.id !== end.id) {
    return null;
  }

  const nodeIds: number[] = [];
  const segments: PathSegment[] = [];
  let cursor = end.id;
  nodeIds.push(cursor);

  while (cursor !== start.id) {
    const step = prev.get(cursor);
    if (!step) return null;
    segments.push({
      lengthMeters: step.edge.lengthMeters,
      maxSpeedMps: step.edge.maxSpeedMps,
      wayId: step.edge.wayId,
      lineRef: step.edge.lineRef,
      lineName: step.edge.lineName,
      usage: step.edge.usage,
      electrified: step.edge.electrified,
      gauge: step.edge.gauge,
      trackRef: step.edge.trackRef,
    });
    cursor = step.node;
    nodeIds.push(cursor);
  }

  nodeIds.reverse();
  segments.reverse();

  const points = nodeIds
    .map((id) => graph.nodeCoords.get(id))
    .filter((point): point is [number, number] => point !== undefined);
  if (points.length < 2 || segments.length !== points.length - 1) {
    return null;
  }

  return {
    nodeIds,
    points,
    segments,
    startSnapDistanceMeters: start.distanceMeters,
    endSnapDistanceMeters: end.distanceMeters,
    travelTimeSeconds: dist.get(end.id) ?? Number.POSITIVE_INFINITY,
  };
}

function nearestNodeCandidates(
  graph: RailGraph,
  target: [number, number],
  maxDistanceMeters: number,
  limit: number
): NodeCandidate[] {
  const all: NodeCandidate[] = [];
  for (const [id, coord] of graph.nodeCoords) {
    const distanceMeters = haversineMeters(coord, target);
    if (distanceMeters <= maxDistanceMeters) {
      all.push({ id, distanceMeters });
    }
  }

  all.sort((a, b) => a.distanceMeters - b.distanceMeters);
  if (all.length === 0) return [];

  const connected = all.filter(
    (candidate) => (graph.adjacency.get(candidate.id)?.length ?? 0) >= 2
  );
  const preferred = connected.length > 0 ? connected : all;
  return preferred.slice(0, Math.max(1, limit));
}

function pushMinHeap(heap: HeapItem[], item: HeapItem) {
  heap.push(item);
  let index = heap.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (heap[parent].cost <= heap[index].cost) break;
    const tmp = heap[parent];
    heap[parent] = heap[index];
    heap[index] = tmp;
    index = parent;
  }
}

function popMinHeap(heap: HeapItem[]): HeapItem | null {
  if (heap.length === 0) return null;
  const root = heap[0];
  const tail = heap.pop()!;
  if (heap.length > 0) {
    heap[0] = tail;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = index * 2 + 2;
      let smallest = index;

      if (left < heap.length && heap[left].cost < heap[smallest].cost) {
        smallest = left;
      }
      if (right < heap.length && heap[right].cost < heap[smallest].cost) {
        smallest = right;
      }
      if (smallest === index) break;

      const tmp = heap[index];
      heap[index] = heap[smallest];
      heap[smallest] = tmp;
      index = smallest;
    }
  }
  return root;
}

function assignStopAnchor(
  anchors: Array<{ nodeId: number; distanceMeters: number; coordinates: [number, number] } | null>,
  index: number,
  next: { nodeId: number; distanceMeters: number; coordinates: [number, number] }
) {
  const current = anchors[index];
  if (!current || next.distanceMeters < current.distanceMeters) {
    anchors[index] = next;
  }
}

function extractSwitchPassages(
  nodeIds: number[],
  graph: RailGraph
): RailSwitchPassage[] {
  const out: RailSwitchPassage[] = [];
  const seen = new Set<number>();

  for (const nodeId of nodeIds) {
    if (seen.has(nodeId)) continue;
    const tags = graph.nodeTags.get(nodeId);
    if (tags?.railway !== "switch") continue;
    const coords = graph.nodeCoords.get(nodeId);
    if (!coords) continue;

    out.push({
      nodeId,
      latitude: coords[0],
      longitude: coords[1],
      ref: firstNonEmpty(tags.ref, tags.local_ref),
      name: firstNonEmpty(tags.name),
    });
    seen.add(nodeId);
  }

  return out;
}

function summarizeLineReferences(segments: PathSegment[]): RailLineReference[] {
  const deduped = new Map<number, RailLineReference>();
  for (const segment of segments) {
    if (!deduped.has(segment.wayId)) {
      deduped.set(segment.wayId, {
        wayId: segment.wayId,
        ref: segment.lineRef,
        name: segment.lineName,
        usage: segment.usage,
        electrified: segment.electrified,
        gauge: segment.gauge,
        trackRef: segment.trackRef,
      });
    }
  }
  return Array.from(deduped.values());
}

function bboxAround(stops: RailStopInput[], padDeg: number) {
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;

  for (const stop of stops) {
    minLat = Math.min(minLat, stop.latitude);
    maxLat = Math.max(maxLat, stop.latitude);
    minLon = Math.min(minLon, stop.longitude);
    maxLon = Math.max(maxLon, stop.longitude);
  }

  return {
    south: minLat - padDeg,
    west: minLon - padDeg,
    north: maxLat + padDeg,
    east: maxLon + padDeg,
  };
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  const lat1 = toRadians(a[0]);
  const lat2 = toRadians(b[0]);
  const dLat = toRadians(b[0] - a[0]);
  const dLon = toRadians(b[1] - a[1]);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_METERS * c;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function kphToMps(speedKph: number): number {
  return Math.max(speedKph, 0) / 3.6;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return undefined;
}

function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException) {
    return error.name === "AbortError";
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
