"use client";

import { useMemo, useState } from "react";
import { Filter, RefreshCcw, Search } from "lucide-react";

import type { Train } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrainCard } from "@/components/train-card";

interface TrainExplorerProps {
  trains: Train[];
  baselineAverageStops: number;
  totalStops: number;
  totalRoutes: number;
}

type SortOption = "az" | "stops" | "coaches";

export function TrainExplorer({
  trains,
  baselineAverageStops,
  totalStops,
  totalRoutes,
}: TrainExplorerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [origin, setOrigin] = useState<string>("all");
  const [destination, setDestination] = useState<string>("all");
  const [sort, setSort] = useState<SortOption>("az");

  const collator = useMemo(
    () => new Intl.Collator("hu", { sensitivity: "base" }),
    []
  );

  const originOptions = useMemo(() => {
    const set = new Set<string>();
    trains.forEach((train) => {
      if (train.megallok.length > 0) {
        set.add(train.megallok[0]);
      }
    });
    return Array.from(set).sort(collator.compare);
  }, [trains, collator]);

  const destinationOptions = useMemo(() => {
    const set = new Set<string>();
    trains.forEach((train) => {
      if (train.megallok.length > 0) {
        set.add(train.megallok[train.megallok.length - 1]);
      }
    });
    return Array.from(set).sort(collator.compare);
  }, [trains, collator]);

  const filteredTrains = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const applyFilters = trains.filter((train) => {
      const routeStart = train.megallok[0];
      const routeEnd = train.megallok[train.megallok.length - 1];

      const matchesSearch =
        term.length === 0 ||
        train.nev.toLowerCase().includes(term) ||
        train.vonatid.toString().includes(term) ||
        train.megallok.some((stop) => stop.toLowerCase().includes(term));

      if (!matchesSearch) return false;

      const matchesOrigin = origin === "all" || routeStart === origin;
      if (!matchesOrigin) return false;

      const matchesDestination =
        destination === "all" || routeEnd === destination;
      return matchesDestination;
    });

    return applyFilters.sort((a, b) => {
      if (sort === "az") {
        return collator.compare(a.nev || `${a.vonatid}`, b.nev || `${b.vonatid}`);
      }

      if (sort === "stops") {
        return b.megallok.length - a.megallok.length;
      }

      if (sort === "coaches") {
        return (b.kocsiidk?.length ?? 0) - (a.kocsiidk?.length ?? 0);
      }

      return 0;
    });
  }, [trains, searchTerm, origin, destination, sort, collator]);

  function resetFilters() {
    setSearchTerm("");
    setOrigin("all");
    setDestination("all");
    setSort("az");
  }

  return (
    <section className="-mt-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/5 sm:p-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              Train explorer
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">
              Find the exact service you&apos;re after
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse {trains.length} trains that cover {totalRoutes} distinct routes
              across {totalStops} stops. Average journey length is
              {" "}
              {baselineAverageStops.toFixed(1)} stops.
            </p>
          </div>

          <Badge variant="secondary" className="w-fit">
            {filteredTrains.length} trains shown
          </Badge>
        </div>

        <div className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Search
            </label>
            <div className="relative mt-2">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Train name, station or ID"
                className="pl-9"
                aria-label="Search trains"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Origin
            </label>
            <Select value={origin} onValueChange={setOrigin}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Any origin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All origins</SelectItem>
                {originOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Destination
            </label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Any destination" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All destinations</SelectItem>
                {destinationOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="lg:col-span-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sort by
            </label>
            <Select value={sort} onValueChange={(value) => setSort(value as SortOption)}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Sort trains" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="az">Name (A-Z)</SelectItem>
                <SelectItem value="stops">Most stops</SelectItem>
                <SelectItem value="coaches">Most coaches</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end justify-end lg:justify-start">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="gap-2 text-slate-600 hover:text-slate-900"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Reset
            </Button>
          </div>
        </div>

        {filteredTrains.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center">
            <h3 className="text-xl font-semibold text-slate-900">
              No trains match the current filters
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Try resetting the filters or searching for a different station.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredTrains.map((train) => (
              <TrainCard key={train.vonatid} train={train} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
