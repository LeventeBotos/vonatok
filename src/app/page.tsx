import { getTrains } from "@/lib/actions";
import { TrainCard } from "@/components/train-card";

export default async function Home() {
  const trains = await getTrains();

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-8">Train List</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trains.map((train) => (
            <TrainCard key={train.vonatid} train={train} />
          ))}
        </div>
      </main>
    </div>
  );
}
