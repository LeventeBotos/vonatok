import type { CouplingType, TractionType } from "./locomotive";

export type CoachType =
  | "first-class"
  | "second-class"
  | "restaurant"
  | "bistro"
  | "sleeper"
  | "generator";

export interface CoachAmenityProfile {
  airConditioned: boolean;
  wifi: boolean;
  accessibility: "standard" | "enhanced" | "wheelchair";
  powerOutlets: boolean;
  bikeSpaces: number;
  restroom: "standard" | "accessible" | "none";
}

export interface Coach {
  id: string;
  name: string;
  type: CoachType;
  manufacturer: string;
  introductionYear: number;
  maxSpeedKph: number;
  lengthMeters: number;
  weightTons: number;
  seatingCapacity: number;
  couplingType: CouplingType;
  compatibleTraction: TractionType[];
  amenities: CoachAmenityProfile;
  imageUrl?: string;
  notes?: string;
}
