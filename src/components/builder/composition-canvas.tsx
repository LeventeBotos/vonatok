"use client";

import { useMemo } from "react";
import Image from "next/image";
import type { Coach, Locomotive } from "@/models";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Trash2, ArrowRightLeft } from "lucide-react";
import type { RollingStockKind } from "./rolling-stock-palette";

export interface SelectedCoachInstance {
  coach: Coach;
  uid: string;
}

export interface CompositionCanvasProps {
  locomotive: Locomotive | null;
  coaches: SelectedCoachInstance[];
  onDropPart: (payload: { kind: RollingStockKind; id: string }, index?: number) => void;
  onReorderCoach: (from: number, to: number) => void;
  onRemoveCoach: (index: number) => void;
  onClearLocomotive: () => void;
}

export function CompositionCanvas({
  locomotive,
  coaches,
  onDropPart,
  onReorderCoach,
  onRemoveCoach,
  onClearLocomotive,
}: CompositionCanvasProps) {
  const coachCount = coaches.length;

  const dropHint = useMemo(() => {
    if (!locomotive && coachCount === 0) {
      return "Drag a locomotive and coaches here to start building.";
    }
    if (!locomotive) {
      return "Add a locomotive to lead the composition.";
    }
    return null;
  }, [coachCount, locomotive]);

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Train Composition</h2>
          <p className="text-sm text-muted-foreground">
            Drag locomotives and coaches into the rail to build your consist. Drag existing coaches to reorder or remove.
          </p>
        </div>
        {coachCount > 1 && (
          <Badge variant="outline" className="text-xs">
            {coachCount} coaches
          </Badge>
        )}
      </header>

      <div
        className="relative flex min-h-[180px] items-end gap-0 overflow-x-auto rounded-xl border border-dashed border-primary/40 bg-muted/40 p-6"
        onDragOver={(event) => handleDragOver(event)}
        onDrop={(event) => handleDrop(event, onDropPart, onReorderCoach, coaches.length)}
      >
        {!locomotive && coachCount === 0 && (
          <p className="text-sm text-muted-foreground">{dropHint}</p>
        )}

        {locomotive && (
          <div className="relative mx-1 flex shrink-0 flex-col items-center" title={locomotive.name}>
            <div className="relative h-28 w-40">
              <StockImage src={locomotive.imageUrl} alt={locomotive.name} />
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{locomotive.name}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={onClearLocomotive}
                aria-label="Remove locomotive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {coaches.map((coachInstance, index) => (
          <div
            key={coachInstance.uid}
            className="group relative mx-1 flex shrink-0 cursor-grab flex-col items-center"
            draggable
            onDragStart={(event) => handleCoachDragStart(event, index)}
            onDragOver={(event) => handleDragOver(event)}
            onDrop={(event) => handleDrop(event, onDropPart, onReorderCoach, index)}
            title={coachInstance.coach.name}
          >
            <div className="relative h-24 w-36">
              <StockImage src={coachInstance.coach.imageUrl} alt={coachInstance.coach.name} />
              <span className="absolute left-1 top-1 rounded-sm bg-primary px-1.5 py-0.5 text-[10px] uppercase text-primary-foreground opacity-0 transition group-hover:opacity-100">
                Drag to reorder
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{coachInstance.coach.name}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => onRemoveCoach(index)}
                aria-label={`Remove ${coachInstance.coach.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {dropHint && (
        <Alert variant="default">
          <ArrowRightLeft className="h-4 w-4" />
          <AlertDescription>{dropHint}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}

function handleCoachDragStart(event: React.DragEvent, index: number) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-train-coach-index", `${index}`);
}

function handleDragOver(event: React.DragEvent) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function handleDrop(
  event: React.DragEvent,
  onDropPart: CompositionCanvasProps["onDropPart"],
  onReorderCoach: CompositionCanvasProps["onReorderCoach"],
  targetIndex: number
) {
  event.preventDefault();

  const coachIndex = event.dataTransfer.getData("application/x-train-coach-index");
  if (coachIndex) {
    const from = Number.parseInt(coachIndex, 10);
    if (!Number.isNaN(from)) {
      onReorderCoach(from, targetIndex);
      return;
    }
  }

  const payloadRaw = event.dataTransfer.getData("application/x-rolling-stock");
  if (!payloadRaw) return;

  try {
    const payload = JSON.parse(payloadRaw) as { kind: RollingStockKind; id: string };
    onDropPart(payload, targetIndex);
  } catch (error) {
    console.error("Failed to parse dropped payload", error);
  }
}

function StockImage({ src, alt }: { src?: string; alt: string }) {
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded bg-muted text-[11px] text-muted-foreground">
        {alt}
      </div>
    );
  }

  return (
    <Image
      fill
      src={src}
      alt={alt}
      className="object-contain"
      sizes="160px"
    />
  );
}
