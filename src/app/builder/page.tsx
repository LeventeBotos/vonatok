import TrainBuilderClient from "@/components/builder/train-builder-client";
import { getAllCoaches, getAllLocomotives } from "@/lib/actions";
import { mapDbCoachToModel, mapDbLocomotiveToModel } from "@/lib/db-to-model";

export default async function BuilderPage() {
  try {
    const [dbLocomotives, dbCoaches] = await Promise.all([
      getAllLocomotives(),
      getAllCoaches(),
    ]);

    const locomotives = dbLocomotives.map(mapDbLocomotiveToModel);
    const coaches = dbCoaches.map(mapDbCoachToModel);

    return <TrainBuilderClient locomotives={locomotives} coaches={coaches} />;
  } catch (error) {
    console.error("Failed to load rolling stock from DB", error);
    return (
      <TrainBuilderClient
        locomotives={[]}
        coaches={[]}
        dataLoadError="Failed to load locomotives/coaches from the database."
      />
    );
  }
}
