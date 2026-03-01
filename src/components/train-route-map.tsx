"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { Station } from "@/models";

const defaultCenter: LatLngExpression = [47.1625, 19.5033];

const defaultIconUrl =
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const retinaIconUrl =
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const shadowIconUrl =
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: retinaIconUrl,
  iconUrl: defaultIconUrl,
  shadowUrl: shadowIconUrl,
});

const STATION_MARKER_MIN_ZOOM = 10;
const STATION_MARKER_MAX_PER_VIEW = 1200;

interface TrainRouteMapProps {
  stations: Station[];
  selectedStations: Station[];
  onSelectStation?: (station: Station) => void;
  routeLine?: LatLngExpression[];
  interactive?: boolean;
}

export function TrainRouteMap({
  stations,
  selectedStations,
  onSelectStation,
  routeLine,
  interactive = true,
}: TrainRouteMapProps) {
  const polylinePositions: LatLngExpression[] =
    routeLine
      ? routeLine
      : selectedStations.map((station) => [station.latitude, station.longitude]);

  return (
    <div className="relative">
      <MapContainer
        center={defaultCenter}
        zoom={7}
        scrollWheelZoom
        preferCanvas
        className="h-[360px] w-full rounded-xl"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, style: <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a> (CC-BY-SA)'
          url="https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png"
        />
        <FitBounds
          selectedStations={selectedStations}
          polylinePositions={polylinePositions}
        />

        {polylinePositions.length >= 2 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{ color: "#2563eb", weight: 4 }}
          />
        )}

        <StationMarkers
          stations={stations}
          selectedStations={selectedStations}
          interactive={interactive}
          onSelectStation={onSelectStation}
        />
      </MapContainer>
    </div>
  );
}

function FitBounds({
  selectedStations,
  polylinePositions,
}: {
  selectedStations: Station[];
  polylinePositions: LatLngExpression[];
}) {
  const map = useMap();

  useEffect(() => {
    const positions = polylinePositions.length
      ? polylinePositions
      : selectedStations.map((station) => [station.latitude, station.longitude]);

    if (positions.length === 0) {
      map.setView(defaultCenter, 7);
      return;
    }

    if (positions.length === 1) {
      const [lat, lon] = positions[0] as [number, number];
      map.setView([lat, lon], 10);
      return;
    }

    const bounds = L.latLngBounds(positions as [number, number][]);
    map.fitBounds(bounds, { padding: [32, 32] });
  }, [map, selectedStations, polylinePositions]);

  return null;
}

function StationMarkers({
  stations,
  selectedStations,
  interactive,
  onSelectStation,
}: {
  stations: Station[];
  selectedStations: Station[];
  interactive: boolean;
  onSelectStation?: (station: Station) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [bounds, setBounds] = useState(map.getBounds());

  useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
      setBounds(map.getBounds());
    },
    moveend: () => {
      setZoom(map.getZoom());
      setBounds(map.getBounds());
    },
  });

  const selectedIds = useMemo(
    () => new Set(selectedStations.map((station) => station.id)),
    [selectedStations]
  );

  const visibleStations = useMemo(() => {
    if (zoom < STATION_MARKER_MIN_ZOOM) {
      return [] as Station[];
    }
    const paddedBounds = bounds.pad(0.2);
    const inView = stations.filter((station) =>
      paddedBounds.contains([station.latitude, station.longitude])
    );
    return inView.slice(0, STATION_MARKER_MAX_PER_VIEW);
  }, [bounds, stations, zoom]);

  const renderedStations = useMemo(() => {
    const markers: Station[] = [...selectedStations];
    for (const station of visibleStations) {
      if (!selectedIds.has(station.id)) {
        markers.push(station);
      }
    }
    return markers;
  }, [selectedIds, selectedStations, visibleStations]);

  return (
    <>
      {renderedStations.map((station) => {
        const order = selectedStations.findIndex((s) => s.id === station.id);
        const isSelected = order >= 0;

        return (
          <Marker
            key={station.id}
            position={[station.latitude, station.longitude]}
            eventHandlers={
              interactive && onSelectStation
                ? {
                    click: () => onSelectStation(station),
                  }
                : undefined
            }
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <div className="space-y-1">
                <p className="font-medium">{station.name}</p>
                {isSelected ? (
                  <p className="text-xs">Stop #{order + 1} in this route</p>
                ) : zoom < STATION_MARKER_MIN_ZOOM ? (
                  <p className="text-xs">Zoom in to show nearby stations</p>
                ) : (
                  <p className="text-xs">Click to add to the route</p>
                )}
              </div>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
