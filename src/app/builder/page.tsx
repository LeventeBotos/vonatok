"use client";

import { useMemo, useState } from "react";
import { locomotives } from "@/data/locomotives";
import { coaches as coachCatalog } from "@/data/coaches";
import { stations } from "@/data/stations";
import type { Coach, Locomotive, Station } from "@/models";
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
  estimateTravelTime,
  getCompositionMetrics,
  validateComposition,
} from "@/utils/train-calculations";
import { TrainRouteMap } from "@/components/train-route-map";
import { Card } from "@/components/ui/card";

interface DroppedPayload {
  kind: "locomotive" | "coach";
  id: string;
}

export default function TrainBuilderPage() {
  const [selectedLocomotive, setSelectedLocomotive] = useState<Locomotive | null>(null);
  const [selectedCoaches, setSelectedCoaches] = useState<SelectedCoachInstance[]>([]);
  const [route, setRoute] = useState<Station[]>([]);

  const coachList = useMemo(() => selectedCoaches.map((item) => item.coach), [selectedCoaches]);

  const metrics = useMemo(
    () => getCompositionMetrics(selectedLocomotive, coachList),
    [selectedLocomotive, coachList]
  );
  const validation = useMemo(
    () => validateComposition(selectedLocomotive, coachList),
    [selectedLocomotive, coachList]
  );
  const platformWarnings = useMemo(
    () => evaluatePlatformConstraints(route, metrics.totalLengthMeters),
    [route, metrics.totalLengthMeters]
  );
  const travelTime = useMemo(
    () => estimateTravelTime(route, selectedLocomotive, coachList),
    [route, selectedLocomotive, coachList]
  );

  function handleDropPart(payload: DroppedPayload, index?: number) {
    if (payload.kind === "locomotive") {
      const locomotive = locomotives.find((entry) => entry.id === payload.id);
      if (locomotive) {
        setSelectedLocomotive(locomotive);
      }
      return;
    }

    const coach = coachCatalog.find((entry) => entry.id === payload.id);
    if (!coach) return;

    setSelectedCoaches((prev) => {
      const next = [...prev];
      const uid = createUid();
      const insertionIndex = typeof index === "number" ? clampIndex(index, next.length) : next.length;
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
    }),
    [selectedLocomotive, selectedCoaches, route, metrics, validation.warnings, platformWarnings, travelTime]
  );

  return (
    <div className="space-y-8 pb-16">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Train Composition Builder</h1>
        <p className="max-w-3xl text-muted-foreground">
          Assemble locomotives and coaches, verify technical constraints, and plan a full route with live mapping and travel-time insights.
        </p>
      </section>

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
              stations={stations}
              selectedStations={route}
              onSelectStation={handleMapSelect}
            />
          </Card>
          <RoutePlanner stations={stations} route={route} onRouteChange={setRoute} />
        </div>
        <CompositionSummary
          locomotive={selectedLocomotive}
          coaches={coachList}
          metrics={metrics}
          validation={validation}
          platformWarnings={platformWarnings}
          travelTime={travelTime}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RollingStockPalette
            locomotives={locomotives}
            coaches={coachCatalog}
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
