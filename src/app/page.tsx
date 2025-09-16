import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { getTrains } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { TrainExplorer } from "@/components/train-explorer";

export default async function Home() {
  const trains = await getTrains();

  const uniqueStops = new Set<string>();
  const uniqueRoutes = new Set<string>();

  let totalStops = 0;
  let totalCoaches = 0;

  trains.forEach((train) => {
    train.megallok.forEach((stop) => uniqueStops.add(stop));

    if (train.megallok.length > 0) {
      const origin = train.megallok[0];
      const destination = train.megallok[train.megallok.length - 1];
      if (origin && destination) {
        uniqueRoutes.add(`${origin}→${destination}`);
      }
    }

    totalStops += train.megallok.length;
    totalCoaches += train.kocsiidk?.length ?? 0;
  });

  const averageStops =
    trains.length > 0
      ? Math.round((totalStops / trains.length) * 10) / 10
      : 0;
  const averageCoaches =
    trains.length > 0
      ? Math.round((totalCoaches / trains.length) * 10) / 10
      : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="pb-16">
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            aria-hidden="true"
          >
            <div className="absolute -left-48 top-24 h-72 w-72 rounded-full bg-primary/40 blur-3xl" />
            <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-sky-500/30 blur-3xl" />
          </div>
          <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="max-w-2xl space-y-6">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-300">
                Magyar vasút adatok
              </p>
              <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl">
                Discover how every carriage fits into Hungary&apos;s rail network
              </h1>
              <p className="text-lg text-slate-200">
                Browse curated train compositions, explore their full list of stops,
                and assemble new services with confidence.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="shadow-lg shadow-primary/20">
                  <Link href="/train/new">
                    Design a composition
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  size="lg"
                  className="bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
                >
                  <Link href="/about">Learn about the dataset</Link>
                </Button>
              </div>
            </div>

            <div className="grid w-full max-w-md grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur">
              <StatCard label="Active trains" value={trains.length.toString()} />
              <StatCard label="Routes served" value={uniqueRoutes.size.toString()} />
              <StatCard label="Unique stops" value={uniqueStops.size.toString()} />
              <StatCard label="Avg. coaches" value={averageCoaches.toFixed(1)} />
            </div>
          </div>
        </section>

        <TrainExplorer
          trains={trains}
          baselineAverageStops={averageStops}
          totalStops={uniqueStops.size}
          totalRoutes={uniqueRoutes.size}
        />
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-slate-900/50 p-4 text-left shadow-inner shadow-black/10">
      <span className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className="text-2xl font-semibold text-white">{value}</span>
    </div>
  );
}
