import type { Coach } from "./coach";
import type { Locomotive } from "./locomotive";
import type { Station } from "./station";

export interface TrainComposition {
  id: string;
  name: string;
  description?: string;
  locomotive: Locomotive | null;
  coaches: TrainCoachInstance[];
  route: Station[];
  createdAt: string;
  updatedAt: string;
}

export interface TrainCoachInstance {
  coach: Coach;
  order: number;
  identifier: string;
}

export interface TrainConstraints {
  maxLengthMeters: number;
  maxWeightTons?: number;
  allowedCouplings?: string[];
}
