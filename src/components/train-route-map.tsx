"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Tooltip,
  useMap,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { Station } from "@/data/stations";

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

interface TrainRouteMapProps {
  stations: Station[];
  selectedStations: Station[];
  onSelectStation: (station: Station) => void;
}

export function TrainRouteMap({
  stations,
  selectedStations,
  onSelectStation,
}: TrainRouteMapProps) {
  const polylinePositions: LatLngExpression[] = selectedStations.map(
    (station) => [station.latitude, station.longitude]
  );

  return (
    <MapContainer
      center={defaultCenter}
      zoom={7}
      scrollWheelZoom
      className="h-[360px] w-full rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds selectedStations={selectedStations} />

      {polylinePositions.length >= 2 && (
        <Polyline
          positions={polylinePositions}
          pathOptions={{ color: "#2563eb", weight: 4 }}
        />
      )}

      {stations.map((station) => {
        const isSelected = selectedStations.some((s) => s.id === station.id);
        const order = selectedStations.findIndex((s) => s.id === station.id);

        return (
          <Marker
            key={station.id}
            position={[station.latitude, station.longitude]}
            eventHandlers={{
              click: () => onSelectStation(station),
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <div className="space-y-1">
                <p className="font-medium">{station.name}</p>
                {isSelected ? (
                  <p className="text-xs">Stop #{order + 1} in this route</p>
                ) : (
                  <p className="text-xs">Click to add to the route</p>
                )}
              </div>
            </Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

function FitBounds({ selectedStations }: { selectedStations: Station[] }) {
  const map = useMap();

  useEffect(() => {
    if (selectedStations.length === 0) {
      map.setView(defaultCenter, 7);
      return;
    }

    if (selectedStations.length === 1) {
      const [station] = selectedStations;
      map.setView([station.latitude, station.longitude], 10);
      return;
    }

    const bounds = L.latLngBounds(
      selectedStations.map((station) => [station.latitude, station.longitude])
    );
    map.fitBounds(bounds, { padding: [32, 32] });
  }, [map, selectedStations]);

  return null;
}

