import type { TrainComposition } from "@/models";
import { coaches } from "./coaches";
import { locomotives } from "./locomotives";
import { stations } from "./stations";

const now = new Date().toISOString();

function pickLoc(id: string) {
  return locomotives.find((loc) => loc.id === id) ?? locomotives[0];
}

function pickCoach(id: string) {
  const coach = coaches.find((c) => c.id === id);
  if (!coach) throw new Error(`Missing coach ${id}`);
  return coach;
}

function pickStation(id: string) {
  const station = stations.find((s) => s.id === id);
  if (!station) throw new Error(`Missing station ${id}`);
  return station;
}

export const sampleCompositions: TrainComposition[] = [
  {
    id: "icplus-gyor",
    name: "IC+ Budapest–Győr",
    description: "Typical InterCity formation powering westbound services.",
    locomotive: pickLoc("mav-v63"),
    coaches: [
      { coach: pickCoach("icplus-ap"), order: 1, identifier: "AP 001" },
      { coach: pickCoach("icplus-bp"), order: 2, identifier: "BP 201" },
      { coach: pickCoach("icplus-bp"), order: 3, identifier: "BP 202" },
      { coach: pickCoach("mz-restaurant"), order: 4, identifier: "WR 310" },
      { coach: pickCoach("icplus-bp"), order: 5, identifier: "BP 203" },
    ],
    route: [
      pickStation("budapest-nyugati"),
      pickStation("tatabanya"),
      pickStation("gyor"),
    ],
    createdAt: now,
    updatedAt: now,
  },
];
