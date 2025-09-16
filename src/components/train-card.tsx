import Link from "next/link";
import { ArrowRight, Layers, TrainIcon } from "lucide-react";

import type { Train } from "../lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TrainCardProps {
  train: Train;
}

export function TrainCard({ train }: TrainCardProps) {
  const origin = train.megallok[0] ?? "Unknown origin";
  const destination = train.megallok[train.megallok.length - 1] ?? "";
  const previewStops = train.megallok.slice(0, 5);
  const remainingStops = Math.max(train.megallok.length - previewStops.length, 0);
  const coachCount = train.kocsiidk?.length ?? 0;

  return (
    <Card className="h-full border-slate-200 transition-all hover:-translate-y-1 hover:shadow-lg">
      <CardHeader className="space-y-3 pb-4">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <TrainIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            {train.nev || `Train ${train.vonatid}`}
          </CardTitle>
          <Badge variant="outline" className="mt-1 text-xs">
            #{train.vonatid}
          </Badge>
        </div>
        <CardDescription>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <span>{origin}</span>
            {destination && (
              <>
                <ArrowRight className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>{destination}</span>
              </>
            )}
          </div>
          <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
            {train.megallok.length} stops · {coachCount} coaches · Locomotive {train.mozdonyid}
          </p>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Stops snapshot
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {previewStops.map((stop, index) => (
              <Badge key={`${train.vonatid}-stop-${index}`} variant="secondary">
                {stop}
              </Badge>
            ))}
            {remainingStops > 0 && (
              <Badge variant="outline">+{remainingStops} more</Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Layers className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Coaches
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{coachCount}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Locomotive
            </p>
            <p className="mt-1 font-semibold text-slate-900">{train.mozdonyid}</p>
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Button asChild variant="secondary" className="w-full">
          <Link href={`/train/${train.vonatid}`}>
            View details
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
