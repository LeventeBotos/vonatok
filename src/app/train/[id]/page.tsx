import { notFound } from "next/navigation";
import {
  getTrainById,
  getCoachesByIds,
  getLocomotiveById,
} from "@/lib/actions";
import { Header } from "@/components/header";
import { CoachDisplay } from "@/components/coach-display";
import { LocomotiveDisplay } from "@/components/locomotive-display";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

// Use the simplest approach for page component
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const trainId = Number.parseInt((await params).id);

  // Fetch the train using the string ID
  const train = await getTrainById(trainId);

  // If no train is found, trigger a 404
  if (!train) {
    return notFound();
  }

  // Fetch coaches and locomotive using IDs from the train object
  const coaches = await getCoachesByIds(train.kocsiidk || []);
  const locomotive = await getLocomotiveById(train.mozdonyid);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto py-8 px-4">
        <Link
          href="/"
          className="flex items-center text-primary mb-6 hover:underline"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Train List
        </Link>

        <h1 className="text-3xl font-bold mb-2">{train.megallok[0]}</h1>
        <p className="text-muted-foreground mb-8">Train ID: {train.vonatid}</p>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Stops</h2>
          <div className="flex flex-wrap gap-2">
            {train.megallok.map((stop, index) => (
              <Badge
                key={index}
                variant="outline"
                className="text-base py-1 px-3"
              >
                {index > 0 && "→ "}
                {stop}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex w-full overflow-x-auto flex-row gap-0 py-10 items-end">
          {locomotive && (
            <img src={locomotive.imageurl || ""} alt={locomotive.mozdonyid} />
          )}
          {coaches.map((coach, index) => (
            <img
              key={`${index}.kocsi - ${coach.kocsiid}`}
              src={coach.imageurl || ""}
              alt={coach.kocsiid}
            />
          ))}
        </div>

        {locomotive && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Locomotive</h2>
            <div className="max-w-md">
              <LocomotiveDisplay locomotive={locomotive} />
            </div>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Coaches</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coaches.map((coach, index) => (
              <CoachDisplay
                key={`${index}.kocsi - ${coach.kocsiid} továbbiakban`}
                coach={coach}
              />
            ))}
          </div>
        </div>
      </main>
      <footer className="bg-muted py-4 text-center text-sm">
        <div className="container mx-auto">
          © {new Date().getFullYear()} Train Data Website
        </div>
      </footer>
    </div>
  );
}
// import { notFound } from "next/navigation";
// import {
//   getTrainById,
//   getCoachesByIds,
//   getLocomotiveById,
// } from "@/lib/actions";
// import { Header } from "@/components/header";
// import { CoachDisplay } from "@/components/coach-display";
// import { LocomotiveDisplay } from "@/components/locomotive-display";
// import { Badge } from "@/components/ui/badge";
// import { ArrowLeft } from "lucide-react";
// import Link from "next/link";

// // No need to define 'TrainDetailPageProps' explicitly anymore
// export default async function TrainDetailPage({
//   params,
// }: {
//   params: { id: string };
// }) {
//   const trainId = Number.parseInt(params.id);

//   if (isNaN(trainId)) {
//     return notFound();
//   }

//   const train = await getTrainById(trainId);

//   if (!train) {
//     return notFound();
//   }

//   const coaches = await getCoachesByIds(train.kocsiidk || []);
//   const locomotive = await getLocomotiveById(train.mozdonyid);

//   return (
//     <div className="min-h-screen flex flex-col">
//       <Header />
//       <main className="flex-1 container mx-auto py-8 px-4">
//         <Link
//           href="/"
//           className="flex items-center text-primary mb-6 hover:underline"
//         >
//           <ArrowLeft size={16} className="mr-2" />
//           Back to Train List
//         </Link>

//         <h1 className="text-3xl font-bold mb-2">{train.megallok[0]}</h1>
//         <p className="text-muted-foreground mb-8">Train ID: {train.vonatid}</p>

//         <div className="mb-8">
//           <h2 className="text-xl font-semibold mb-4">Stops</h2>
//           <div className="flex flex-wrap gap-2">
//             {train.megallok.map((stop, index) => (
//               <Badge
//                 key={index}
//                 variant="outline"
//                 className="text-base py-1 px-3"
//               >
//                 {index > 0 && "→ "}
//                 {stop}
//               </Badge>
//             ))}
//           </div>
//         </div>

//         <div className="flex w-full overflow-x-auto flex-row gap-0 py-10 items-end">
//           {locomotive && (
//             <img src={locomotive.imageurl || ""} alt={locomotive.mozdonyid} />
//           )}
//           {coaches.map((coach, index: number) => (
//             <img
//               key={`${index}.kocsi - ${coach.kocsiid}`}
//               src={coach.imageurl || ""}
//               alt={coach.kocsiid}
//             />
//           ))}
//         </div>
//         {locomotive && (
//           <div className="mb-8">
//             <h2 className="text-xl font-semibold mb-4">Locomotive</h2>
//             <div className="max-w-md">
//               <LocomotiveDisplay locomotive={locomotive} />
//             </div>
//           </div>
//         )}

//         <div className="mb-8">
//           <h2 className="text-xl font-semibold mb-4">Coaches</h2>
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//             {coaches.map((coach, index) => (
//               <CoachDisplay
//                 key={`${index}.kocsi - ${coach.kocsiid} továbbiakban`}
//                 coach={coach}
//               />
//             ))}
//           </div>
//         </div>
//       </main>
//       <footer className="bg-muted py-4 text-center text-sm">
//         <div className="container mx-auto">
//           &copy; {new Date().getFullYear()} Train Data Website
//         </div>
//       </footer>
//     </div>
//   );
// }
