export interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  region: string;
  city: string;
  country: string;
  platformLengthMeters: number;
  elevationMeters?: number;
  tracks: number;
  amenities?: string[];
}

export interface StationRouteNode extends Station {
  dwellMinutes: number;
}
