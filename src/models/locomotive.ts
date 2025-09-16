export type TractionType = "electric" | "diesel" | "hybrid" | "steam";
export type CouplingType = "UIC" | "Scharfenberg" | "Chain" | "Dellner";

export interface Locomotive {
  id: string;
  name: string;
  manufacturer: string;
  introductionYear: number;
  traction: TractionType;
  couplingType: CouplingType;
  maxSpeedKph: number;
  powerKw: number;
  tractiveEffortKn: number;
  weightTons: number;
  lengthMeters: number;
  axleConfig: string;
  imageUrl?: string;
  notes?: string;
}
