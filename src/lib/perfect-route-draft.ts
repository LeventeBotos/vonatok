import type { Coach, Locomotive, Station } from "@/models";

export interface PerfectRouteDraft {
  locomotive: Locomotive | null;
  coaches: Coach[];
  route: Station[];
  createdAtIso: string;
}

export function getPerfectRouteDraftStorageKey(draftId: string): string {
  return `perfect-route-draft:${draftId}`;
}
