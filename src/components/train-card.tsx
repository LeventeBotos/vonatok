import Link from "next/link"
import type { Train } from "../lib/db"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrainIcon } from "lucide-react"

interface TrainCardProps {
  train: Train
}

export function TrainCard({ train }: TrainCardProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrainIcon size={20} />
          {train.megallok[0]}
        </CardTitle>
        <CardDescription>Train ID: {train.vonatid}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <h3 className="text-sm font-medium mb-2">Stops:</h3>
          <div className="flex flex-wrap gap-2">
            {train.megallok.map((stop, index) => (
              <Badge key={index} variant="outline">
                {stop}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium mb-2">Locomotive:</h3>
          <Badge>{train.mozdonyid}</Badge>
        </div>
      </CardContent>
      <CardFooter>
        <Link
          href={`/train/${train.vonatid}`}
          className="w-full text-center bg-primary text-primary-foreground py-2 rounded-md hover:bg-primary/90 transition-colors"
        >
          View Details
        </Link>
      </CardFooter>
    </Card>
  )
}

