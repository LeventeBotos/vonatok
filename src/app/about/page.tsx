import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-8">About Train Data</h1>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Our Database</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">This website displays train data from a Neon database with the following tables:</p>

            <h3 className="font-semibold mb-2">Vonatok (Trains)</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>vonatid - Train ID</li>
              <li>megallok - Stops (array)</li>
              <li>kocsiidk - Coach IDs (array)</li>
              <li>mozdonyid - Locomotive ID</li>
            </ul>

            <h3 className="font-semibold mb-2">Kocsik (Coaches)</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>kocsiid - Coach ID</li>
              <li>imageurl - Image URL</li>
              <li>kocsiosztaly - Coach class</li>
              <li>utaster - Passenger space</li>
              <li>sebesseg - Speed</li>
              <li>klima - Air conditioning</li>
              <li>ulohelyek - Seats</li>
            </ul>

            <h3 className="font-semibold mb-2">Mozdonyok (Locomotives)</h3>
            <ul className="list-disc pl-6">
              <li>mozdonyid - Locomotive ID</li>
              <li>sebesseg - Speed</li>
              <li>gyarto - Manufacturer</li>
              <li>imageurl - Image URL</li>
            </ul>
          </CardContent>
        </Card>
      </main>
      <footer className="bg-muted py-4 text-center text-sm">
        <div className="container mx-auto">&copy; {new Date().getFullYear()} Train Data Website</div>
      </footer>
    </div>
  )
}

