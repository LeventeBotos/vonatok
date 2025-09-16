"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, MapPin, Plus, X } from "lucide-react";

import { stations, type Station } from "@/data/stations";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TrainRouteMap = dynamic(
  () => import("./train-route-map").then((mod) => mod.TrainRouteMap),
  { ssr: false }
);

interface TrainRoutePlannerProps {
  selectedStations: Station[];
  onSelectedStationsChange: (stations: Station[]) => void;
}

export function TrainRoutePlanner({
  selectedStations,
  onSelectedStationsChange,
}: TrainRoutePlannerProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const suggestions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return stations.slice(0, 6);

    return stations
      .filter((station) =>
        station.name.toLowerCase().includes(term) ||
        station.region?.toLowerCase().includes(term)
      )
      .slice(0, 8);
  }, [searchTerm]);

  function addStation(station: Station) {
    onSelectedStationsChange([...selectedStations, station]);
  }

  function removeStation(index: number) {
    onSelectedStationsChange(selectedStations.filter((_, i) => i !== index));
  }

  function moveStation(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= selectedStations.length) return;

    const next = [...selectedStations];
    const [removed] = next.splice(index, 1);
    next.splice(newIndex, 0, removed);
    onSelectedStationsChange(next);
  }

  function handleAddFromSearch() {
    const match = stations.find(
      (station) => station.name.toLowerCase() === searchTerm.trim().toLowerCase()
    );

    if (match) {
      addStation(match);
      setSearchTerm("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Stops
            </p>
            <h3 className="text-lg font-semibold text-slate-900">
              Build the route by combining stations and map clicks
            </h3>
            <p className="text-sm text-muted-foreground">
              Click a marker on the map, or search below to add stations. Reorder to
              fine-tune the journey.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSelectedStationsChange([])}
            disabled={selectedStations.length === 0}
          >
            Clear route
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Find a station
              </label>
              <div className="mt-2 flex gap-2">
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Start typing a city or station name"
                  list="station-search"
                />
                <Button type="button" variant="secondary" onClick={handleAddFromSearch}>
                  <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                  Add
                </Button>
              </div>
              <datalist id="station-search">
                {stations.map((station) => (
                  <option key={station.id} value={station.name} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Suggestions
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((station) => (
                  <Badge
                    key={station.id}
                    variant="secondary"
                    className="cursor-pointer gap-1"
                    onClick={() => addStation(station)}
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {station.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200">
              <TrainRouteMap
                stations={stations}
                selectedStations={selectedStations}
                onSelectStation={addStation}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: Click a marker to append that station to the end of the route. Use the
              controls below to refine ordering or remove stops.
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Route order
        </p>
        {selectedStations.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-muted-foreground">
            No stops yet. Add at least two stations to draw the route and calculate
            travel times.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {selectedStations.map((station, index) => (
              <div
                key={`${station.id}-${index}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Stop {index + 1}: {station.name}
                  </p>
                  {station.region && (
                    <p className="text-xs text-muted-foreground">{station.region}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveStation(index, -1)}
                    disabled={index === 0}
                    aria-label="Move stop up"
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveStation(index, 1)}
                    disabled={index === selectedStations.length - 1}
                    aria-label="Move stop down"
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeStation(index)}
                    aria-label="Remove stop"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

