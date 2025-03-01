import type { Locomotive } from "../lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LocomotiveDisplayProps {
  locomotive: Locomotive;
}

export function LocomotiveDisplay({ locomotive }: LocomotiveDisplayProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{locomotive.mozdonyid}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <div className="relative h-40 w-full">
            <img
              src={locomotive.imageurl || "/placeholder.svg"}
              alt={locomotive.mozdonyid}
              style={{ objectFit: "contain" }}
              className="rounded-md"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="font-medium">Manufacturer:</div>
            <div>{locomotive.gyarto}</div>

            <div className="font-medium">Speed:</div>
            <div>{locomotive.sebesseg} km/h</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
