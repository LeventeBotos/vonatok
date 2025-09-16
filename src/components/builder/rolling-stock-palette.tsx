"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { Coach, Locomotive } from "@/models";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type RollingStockKind = "locomotive" | "coach";

export interface RollingStockPaletteProps {
  locomotives: Locomotive[];
  coaches: Coach[];
  selectedLocomotiveId: string | null;
  onSelectLocomotive: (locomotive: Locomotive) => void;
  onAddCoach: (coach: Coach) => void;
}

export function RollingStockPalette({
  locomotives,
  coaches,
  selectedLocomotiveId,
  onSelectLocomotive,
  onAddCoach,
}: RollingStockPaletteProps) {
  const [query, setQuery] = useState("");

  const filteredLocos = useMemo(() => {
    if (!query.trim()) return locomotives;
    const q = query.toLowerCase();
    return locomotives.filter((loc) =>
      [loc.name, loc.manufacturer, loc.id].some((value) =>
        value.toLowerCase().includes(q)
      )
    );
  }, [locomotives, query]);

  const filteredCoaches = useMemo(() => {
    if (!query.trim()) return coaches;
    const q = query.toLowerCase();
    return coaches.filter((coach) =>
      [coach.name, coach.id, coach.type, coach.manufacturer].some((value) =>
        value.toLowerCase().includes(q)
      )
    );
  }, [coaches, query]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Rolling Stock Library</CardTitle>
        <CardDescription>
          Drag items into the builder or tap to select/add them to your train.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="palette-search">
            Search
          </label>
          <Input
            id="palette-search"
            placeholder="Search ID, name, manufacturer"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <section className="space-y-3">
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Locomotives
            </h3>
            <Badge variant="outline">{filteredLocos.length}</Badge>
          </header>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filteredLocos.map((locomotive) => (
              <article
                key={locomotive.id}
                className={`group relative flex cursor-grab flex-col overflow-hidden rounded-lg border bg-card transition hover:ring-2 hover:ring-primary/40 ${
                  selectedLocomotiveId === locomotive.id
                    ? "ring-2 ring-primary"
                    : ""
                }`}
                draggable
                onDragStart={(event) =>
                  handleDragStart(event, "locomotive", locomotive.id)
                }
              >
                <div className="relative h-28 w-full bg-muted">
                  <StockImage
                    src={locomotive.imageUrl}
                    alt={locomotive.name}
                    fallbackText={locomotive.name}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3 text-sm">
                  <p className="font-semibold leading-tight">{locomotive.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {locomotive.manufacturer} · {locomotive.maxSpeedKph} km/h · {locomotive.lengthMeters} m
                  </p>
                  <Button
                    type="button"
                    variant={
                      selectedLocomotiveId === locomotive.id
                        ? "default"
                        : "secondary"
                    }
                    size="sm"
                    className="mt-auto"
                    onClick={() => onSelectLocomotive(locomotive)}
                  >
                    {selectedLocomotiveId === locomotive.id
                      ? "Selected"
                      : "Set as locomotive"}
                  </Button>
                </div>
              </article>
            ))}
            {filteredLocos.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground">
                No locomotives match your search.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Coaches
            </h3>
            <Badge variant="outline">{filteredCoaches.length}</Badge>
          </header>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filteredCoaches.map((coach) => (
              <article
                key={coach.id}
                className="group relative flex cursor-grab flex-col overflow-hidden rounded-lg border bg-card transition hover:ring-2 hover:ring-primary/40"
                draggable
                onDragStart={(event) => handleDragStart(event, "coach", coach.id)}
              >
                <div className="relative h-28 w-full bg-muted">
                  <StockImage
                    src={coach.imageUrl}
                    alt={coach.name}
                    fallbackText={coach.name}
                  />
                  <Badge className="absolute left-2 top-2 text-[10px] uppercase">
                    {coach.type}
                  </Badge>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3 text-sm">
                  <p className="font-semibold leading-tight">{coach.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {coach.seatingCapacity} seats · {coach.lengthMeters} m · {coach.maxSpeedKph} km/h
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-auto"
                    onClick={() => onAddCoach(coach)}
                  >
                    Add coach
                  </Button>
                </div>
              </article>
            ))}
            {filteredCoaches.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground">
                No coaches match your search.
              </p>
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function handleDragStart(
  event: React.DragEvent,
  kind: RollingStockKind,
  id: string
) {
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData(
    "application/x-rolling-stock",
    JSON.stringify({ kind, id })
  );
}

function StockImage({
  src,
  alt,
  fallbackText,
}: {
  src?: string;
  alt: string;
  fallbackText: string;
}) {
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
        {fallbackText}
      </div>
    );
  }

  return (
    <Image
      fill
      src={src}
      alt={alt}
      className="object-contain"
      sizes="(max-width: 768px) 100vw, 50vw"
    />
  );
}
