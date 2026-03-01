"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Coach, Locomotive, Station } from "@/models";
import type { RailLegPlan, RailStopPlan } from "@/lib/rail-infrastructure";
import { getPerfectRouteDraftStorageKey } from "@/lib/perfect-route-draft";
import { RollingStockPalette } from "@/components/builder/rolling-stock-palette";
import {
  CompositionCanvas,
  type SelectedCoachInstance,
} from "@/components/builder/composition-canvas";
import { CompositionSummary } from "@/components/builder/composition-summary";
import { RoutePlanner } from "@/components/builder/route-planner";
import { ExportActions } from "@/components/builder/export-actions";
import {
  evaluatePlatformConstraints,
  getCompositionMetrics,
  validateComposition,
} from "@/utils/train-calculations";
import { TrainRouteMap } from "@/components/train-route-map";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowRight } from "lucide-react";

interface DroppedPayload {
  kind: "locomotive" | "coach";
  id: string;
}

interface StationCatalogResponse {
  stations: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
  }>;
}

interface TrainBuilderClientProps {
  locomotives: Locomotive[];
  coaches: Coach[];
  dataLoadError?: string | null;
}

export default function TrainBuilderClient({
  locomotives,
  coaches,
  dataLoadError = null,
}: TrainBuilderClientProps) {
  const router = useRouter();
  const [selectedLocomotive, setSelectedLocomotive] =
    useState<Locomotive | null>(null);
  const [selectedCoaches, setSelectedCoaches] = useState<
    SelectedCoachInstance[]
  >([]);
  const [route, setRoute] = useState<Station[]>([]);
  const [stationCatalog, setStationCatalog] = useState<Station[]>([]);
  const [stationCatalogError, setStationCatalogError] = useState<string | null>(
    null,
  );
  const [stationCatalogLoading, setStationCatalogLoading] = useState(true);
  const [navigationError, setNavigationError] = useState<string | null>(null);

  const coachList = useMemo(
    () => selectedCoaches.map((item) => item.coach),
    [selectedCoaches],
  );

  const metrics = useMemo(
    () => getCompositionMetrics(selectedLocomotive, coachList),
    [selectedLocomotive, coachList],
  );
  const validation = useMemo(
    () => validateComposition(selectedLocomotive, coachList),
    [selectedLocomotive, coachList],
  );
  const platformWarnings = useMemo(
    () => evaluatePlatformConstraints(route, metrics.totalLengthMeters),
    [route, metrics.totalLengthMeters],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadStations() {
      setStationCatalogLoading(true);
      setStationCatalogError(null);
      try {
        const response = await fetch("/api/rail/stations/all");
        if (!response.ok) {
          throw new Error(`Station catalog request failed: ${response.status}`);
        }
        const payload = (await response.json()) as StationCatalogResponse;
        if (cancelled) return;
        const mapped = (payload.stations ?? []).map((station) => ({
          id: station.id,
          name: station.name,
          latitude: station.latitude,
          longitude: station.longitude,
          region: station.city ?? "",
          city: station.city ?? "",
          country: station.country ?? "",
          platformLengthMeters: 0,
          tracks: 0,
          amenities: [],
        }));
        setStationCatalog(mapped);
      } catch (error) {
        console.error("Failed to load rail station catalog", error);
        if (cancelled) return;
        setStationCatalogError(
          "Could not load main-line station list from OpenRailwayMap.",
        );
        setStationCatalog([]);
      } finally {
        if (!cancelled) {
          setStationCatalogLoading(false);
        }
      }
    }

    void loadStations();
    return () => {
      cancelled = true;
    };
  }, []);

  const travelTime = null;
  const travelTimeLoading = false;
  const travelTimeError =
    route.length >= 2
      ? 'Use "Calculate Perfect Route" to run infrastructure timetable calculation on the next page.'
      : null;
  const legPlans: RailLegPlan[] = [];
  const stopPlans: RailStopPlan[] = [];
  const canCalculatePerfectRoute =
    Boolean(selectedLocomotive) &&
    selectedCoaches.length > 0 &&
    route.length >= 2;

  function handleDropPart(payload: DroppedPayload, index?: number) {
    if (payload.kind === "locomotive") {
      const locomotive = locomotives.find((entry) => entry.id === payload.id);
      if (locomotive) {
        setSelectedLocomotive(locomotive);
      }
      return;
    }

    const coach = coaches.find((entry) => entry.id === payload.id);
    if (!coach) return;

    setSelectedCoaches((prev) => {
      const next = [...prev];
      const uid = createUid();
      const insertionIndex =
        typeof index === "number"
          ? clampIndex(index, next.length)
          : next.length;
      next.splice(insertionIndex, 0, { coach, uid });
      return next;
    });
  }

  function handleAddCoach(coach: Coach) {
    handleDropPart({ kind: "coach", id: coach.id });
  }

  function handleReorderCoach(from: number, to: number) {
    setSelectedCoaches((prev) => {
      if (from === to || from < 0 || from >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      let insertionIndex = clampIndex(to, next.length + 1);
      if (from < to) {
        insertionIndex = Math.max(0, insertionIndex - 1);
      }
      next.splice(insertionIndex, 0, item);
      return next;
    });
  }

  function handleRemoveCoach(index: number) {
    setSelectedCoaches((prev) => prev.filter((_, i) => i !== index));
  }

  function clearLocomotive() {
    setSelectedLocomotive(null);
  }

  function handleMapSelect(station: Station) {
    setRoute((prev) => {
      if (prev.length === 0) return [station];
      if (prev.length === 1) return [prev[0], station];
      const next = [...prev];
      next.splice(next.length - 1, 0, station);
      return next;
    });
  }

  function goToPerfectRoutePage() {
    setNavigationError(null);
    if (!selectedLocomotive) {
      setNavigationError(
        "Select a locomotive before calculating the perfect route.",
      );
      return;
    }
    if (selectedCoaches.length === 0) {
      setNavigationError(
        "Add at least one coach before calculating the perfect route.",
      );
      return;
    }
    if (route.length < 2) {
      setNavigationError(
        "Select at least origin and destination before calculating.",
      );
      return;
    }

    try {
      const draftId = createUid();
      const storageKey = getPerfectRouteDraftStorageKey(draftId);
      const payload = {
        locomotive: selectedLocomotive,
        coaches: selectedCoaches.map((entry) => entry.coach),
        route,
        createdAtIso: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
      router.push(
        `/builder/perfect-route?draft=${encodeURIComponent(draftId)}`,
      );
    } catch (error) {
      console.error("Failed to persist perfect route draft", error);
      setNavigationError("Unable to open the perfect route page. Try again.");
    }
  }

  const exportData = useMemo(
    () => ({
      locomotive: selectedLocomotive,
      coaches: selectedCoaches.map((item, index) => ({
        id: item.coach.id,
        name: item.coach.name,
        order: index + 1,
      })),
      route: route.map((station) => ({
        id: station.id,
        name: station.name,
      })),
      metrics,
      warnings: validation.warnings,
      platformWarnings,
      travelTime,
      travelTimeError,
      legPlans,
      stopPlans,
    }),
    [
      selectedLocomotive,
      selectedCoaches,
      route,
      metrics,
      validation.warnings,
      platformWarnings,
      travelTime,
      travelTimeError,
      legPlans,
      stopPlans,
    ],
  );

  return (
    <div className="space-y-8 pb-16">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Train Composition Builder
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Assemble locomotives and coaches, verify technical constraints, and
          plan a full route with live mapping and travel-time insights.
        </p>
      </section>

      {dataLoadError && (
        <Alert>
          <AlertTitle>Database connection issue</AlertTitle>
          <AlertDescription>{dataLoadError}</AlertDescription>
        </Alert>
      )}
      {stationCatalogError && (
        <Alert>
          <AlertTitle>Station catalog issue</AlertTitle>
          <AlertDescription>{stationCatalogError}</AlertDescription>
        </Alert>
      )}
      {stationCatalogLoading && (
        <Alert>
          <AlertTitle>Loading stations</AlertTitle>
          <AlertDescription>
            Fetching main-line OpenRailwayMap station list...
          </AlertDescription>
        </Alert>
      )}
      {navigationError && (
        <Alert>
          <AlertTitle>Cannot calculate yet</AlertTitle>
          <AlertDescription>{navigationError}</AlertDescription>
        </Alert>
      )}

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Step 2: Perfect route calculation</p>
            <p className="text-sm text-muted-foreground">
              Use the dedicated planner page for exact infrastructure routing, platforms, switches, and calculated times.
            </p>
          </div>
          <Button type="button" onClick={goToPerfectRoutePage}>
            Calculate Perfect Route <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        {!canCalculatePerfectRoute && (
          <p className="mt-2 text-xs text-muted-foreground">
            Required before continue: locomotive + at least one coach + origin and destination.
          </p>
        )}
      </Card>

      <CompositionCanvas
        locomotive={selectedLocomotive}
        coaches={selectedCoaches}
        onDropPart={handleDropPart}
        onReorderCoach={handleReorderCoach}
        onRemoveCoach={handleRemoveCoach}
        onClearLocomotive={clearLocomotive}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-4">
            <TrainRouteMap
              stations={stationCatalog}
              selectedStations={route}
              onSelectStation={handleMapSelect}
            />
          </Card>
          <RoutePlanner
            stations={stationCatalog}
            route={route}
            onRouteChange={setRoute}
          />
          <Card className="p-4">
            <div className="flex flex-col gap-3 ">
              <div>
                <p className="text-sm font-semibold">
                  Step 2: Perfect route calculation
                </p>
                <p className="text-sm text-muted-foreground">
                  After selecting composition and stops, calculate the full
                  track-accurate route on a dedicated planning page.
                </p>
              </div>
              <Button type="button" onClick={goToPerfectRoutePage}>
                Calculate Perfect Route <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
        <CompositionSummary
          locomotive={selectedLocomotive}
          coaches={coachList}
          metrics={metrics}
          validation={validation}
          platformWarnings={platformWarnings}
          travelTime={travelTime}
          travelTimeLoading={travelTimeLoading}
          travelTimeError={travelTimeError}
          legPlans={legPlans}
          stopPlans={stopPlans}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RollingStockPalette
            locomotives={locomotives}
            coaches={coaches}
            selectedLocomotiveId={selectedLocomotive?.id ?? null}
            onSelectLocomotive={(loc) => setSelectedLocomotive(loc)}
            onAddCoach={handleAddCoach}
          />
        </div>
        <ExportActions exportData={exportData} />
      </div>
    </div>
  );
}

function createUid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function clampIndex(index: number, length: number) {
  return Math.max(0, Math.min(index, length));
}
