import type { Coach } from "../lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CoachDisplayProps {
  coach: Coach;
}

export function CoachDisplay({ coach }: CoachDisplayProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{coach.kocsiid}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <div className="relative h-40 w-full">
            <img
              src={coach.imageurl || "/placeholder.svg"}
              alt={coach.kocsiid}
              style={{ objectFit: "contain" }}
              className="rounded-md"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="font-medium">Class:</div>
            <div>{coach.kocsiosztaly}</div>

            <div className="font-medium">Space:</div>
            <div>{coach.utaster}</div>

            <div className="font-medium">Speed:</div>
            <div>{coach.sebesseg} km/h</div>

            <div className="font-medium">Climate:</div>
            <div>{coach.klima === "t" ? "Yes" : "No"}</div>

            <div className="font-medium">Seats:</div>
            <div>{coach.ulohelyek}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
