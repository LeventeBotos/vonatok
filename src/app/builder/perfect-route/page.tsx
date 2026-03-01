import { Suspense } from "react";
import PerfectRouteClient from "@/components/builder/perfect-route-client";

export default function PerfectRoutePage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading planner...</p>}>
        <PerfectRouteClient />
      </Suspense>
    </main>
  );
}
