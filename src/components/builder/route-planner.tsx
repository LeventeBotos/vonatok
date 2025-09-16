"use client";

import { useMemo, useState } from "react";
import type { Station } from "@/models";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

export interface RoutePlannerProps {
  stations: Station[];
  route: Station[];
  onRouteChange: (nextRoute: Station[]) => void;
}

export function RoutePlanner({ stations, route, onRouteChange }: RoutePlannerProps) {
  const [stopToAdd, setStopToAdd] = useState<string>("");

  const stationsById = useMemo(() =>
    new Map(stations.map((station) => [station.id, station] as const)),
  [stations]);

  const origin = route[0];
  const destination = route.length > 1 ? route[route.length - 1] : undefined;
  const intermediateStops = route.slice(1, route.length - 1);

  function setOrigin(id: string) {
    const station = stationsById.get(id);
    if (!station) return;
    const next = [station, ...intermediateStops];
    if (destination) {
      next.push(destination);
    }
    onRouteChange(next);
  }

  function setDestination(id: string) {
    const station = stationsById.get(id);
    if (!station) return;
    if (!origin) {
      onRouteChange([station]);
      return;
    }
    const next = [origin, ...intermediateStops, station];
    onRouteChange(next);
  }

  function addStop() {
    if (!stopToAdd) return;
    const station = stationsById.get(stopToAdd);
    if (!station) return;

    const next = [...route];
    if (next.length === 0) {
      onRouteChange([station]);
      setStopToAdd("");
      return;
    }

    if (next.length === 1) {
      next.push(station);
      onRouteChange(next);
      setStopToAdd("");
      return;
    }

    next.splice(next.length - 1, 0, station);
    onRouteChange(next);
    setStopToAdd("");
  }

  function removeStop(index: number) {
    const next = [...route];
    next.splice(index + 1, 1);
    onRouteChange(next);
  }

  function moveStop(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= intermediateStops.length) return;
    const next = [...intermediateStops];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    const updated = origin ? [origin, ...next] : [...next];
    if (destination) updated.push(destination);
    onRouteChange(updated);
  }

  const selectableStations = useMemo(
    () =>
      stations.filter(
        (station) => station.id !== origin?.id && station.id !== destination?.id
      ),
    [stations, origin?.id, destination?.id]
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Route Planning</CardTitle>
        <CardDescription>Select origin, destination, and any intermediate stops.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="origin-select">Origin</Label>
            <Select value={origin?.id ?? ""} onValueChange={setOrigin}>
              <SelectTrigger id="origin-select">
                <SelectValue placeholder="Choose origin" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {stations.map((station) => (
                    <SelectItem key={station.id} value={station.id}>
                      {station.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="destination-select">Destination</Label>
            <Select
              value={destination?.id ?? ""}
              onValueChange={setDestination}
              disabled={!origin}
            >
              <SelectTrigger id="destination-select">
                <SelectValue placeholder="Choose destination" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {stations.map((station) => (
                    <SelectItem key={station.id} value={station.id}>
                      {station.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="intermediate-select">Intermediate stops</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={stopToAdd} onValueChange={setStopToAdd}>
              <SelectTrigger id="intermediate-select" className="w-full">
                <SelectValue placeholder="Choose stop" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {selectableStations.map((station) => (
                    <SelectItem key={station.id} value={station.id}>
                      {station.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="secondary"
              onClick={addStop}
              disabled={!stopToAdd}
            >
              <Plus className="mr-2 h-4 w-4" /> Add stop
            </Button>
          </div>
        </div>

        {intermediateStops.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No intermediate stops. Add stops above to build a full route.
          </p>
        ) : (
          <ul className="space-y-2">
            {intermediateStops.map((station, index) => (
              <li
                key={station.id}
                className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{station.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {station.city} · platform {station.platformLengthMeters} m
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => moveStop(index, -1)}
                    disabled={index === 0}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => moveStop(index, 1)}
                    disabled={index === intermediateStops.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeStop(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">Current route</p>
          {route.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              Choose at least an origin and destination to define the route.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {route.map((station, index) => (
                <Badge key={station.id} variant="outline">
                  {index + 1}. {station.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
