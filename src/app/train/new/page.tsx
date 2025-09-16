/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import type React from "react";
import { useState, useEffect } from "react";
import {
  createNewTrain,
  getAllCoaches,
  getAllLocomotives,
} from "@/lib/actions";
import type { Coach, Locomotive } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Plus,
  Train,
  X,
  GripVertical,
  Trash2,
  ChevronLeft,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function TrainCompositionMaker() {
  // State for available items
  const [availableCoaches, setAvailableCoaches] = useState<Coach[]>([]);
  const [availableLocomotives, setAvailableLocomotives] = useState<
    Locomotive[]
  >([]);

  // State for form inputs
  const [vonatId, setVonatId] = useState<number | null>(null);
  const [nev, setNev] = useState("");
  const [vonatNem, setVonatNem] = useState("");
  const [mozdonyId, setMozdonyId] = useState("");
  const [kocsiIdk, setKocsiIdk] = useState<string[]>([]);
  const [megallok, setMegallok] = useState<string[]>([]);
  const [megallo, setMegallo] = useState("");
  // DnD state
  const [dragCoachIndex, setDragCoachIndex] = useState<number | null>(null);
  const [dragStopIndex, setDragStopIndex] = useState<number | null>(null);

  // State for UI
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Fetch available coaches and locomotives on component mount
  useEffect(() => {
    async function fetchData() {
      try {
        const coaches = await getAllCoaches();
        const locomotives = await getAllLocomotives();
        setAvailableCoaches(coaches);
        setAvailableLocomotives(locomotives);
      } catch (error: any) {
        setError("Failed to load train components. Please refresh the page.");
      }
    }
    fetchData();
  }, []);

  // Handle form submission; event is optional so it works with both onSubmit and onClick.
  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");

    // Validate form
    if (!vonatId) {
      setError("Train ID is required");
      return;
    }
    if (!nev.trim()) {
      setError("Train name is required");
      return;
    }
    if (!vonatNem.trim()) {
      setError("Train type is required");
      return;
    }
    if (!mozdonyId) {
      setError("Please select a locomotive");
      return;
    }
    if (kocsiIdk.length === 0) {
      setError("Please add at least one coach");
      return;
    }
    if (megallok.length === 0) {
      setError("Please add at least one stop");
      return;
    }

    setIsSubmitting(true);

    try {
      await createNewTrain(
        vonatId,
        nev,
        vonatNem,
        mozdonyId,
        kocsiIdk,
        megallok
      );
      setSuccess(true);

      // Reset form after successful submission
      setTimeout(() => {
        setVonatId(null);
        setNev("");
        setVonatNem("");
        setMozdonyId("");
        setKocsiIdk([]);
        setMegallok([]);
        setSuccess(false);
      }, 3000);
    } catch (error: any) {
      setError("Failed to create train composition. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Add a stop to the list
  function addStop() {
    if (megallo.trim() && !megallok.includes(megallo.trim())) {
      setMegallok([...megallok, megallo.trim()]);
      setMegallo("");
    }
  }

  // Remove a stop from the list
  function removeStop(stop: string) {
    setMegallok(megallok.filter((s) => s !== stop));
  }

  // Add a coach to the composition
  // Add a coach to the composition (allowing duplicates)
  function addCoach(coachId: string) {
    setKocsiIdk([...kocsiIdk, coachId]);
  }

  // Remove a coach from the composition
  function removeCoach(index: number) {
    setKocsiIdk((prevKocsiIdk) => prevKocsiIdk.filter((_, i) => i !== index));
  }

  // Reorder helpers
  function moveCoach(from: number, to: number) {
    if (from === to) return;
    setKocsiIdk((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function moveStop(from: number, to: number) {
    if (from === to) return;
    setMegallok((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  // Get coach details by ID
  function getCoachById(id: string): Coach | undefined {
    return availableCoaches.find((coach) => coach.kocsiid === id);
  }

  // Get locomotive details by ID
  function getLocomotiveById(id: string): Locomotive | undefined {
    return availableLocomotives.find((loco) => loco.mozdonyid === id);
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Train Composition Maker
      </h1>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <Check className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Success</AlertTitle>
          <AlertDescription className="text-green-700">
            Train &quot;{nev}&quot; has been created successfully with ID:{" "}
            {vonatId}!
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Train Details Form */}
        <Card>
          <CardHeader>
            <CardTitle>Train Details</CardTitle>
            <CardDescription>
              Enter basic information about the train
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vonatId">Train ID</Label>
                <Input
                  id="vonatId"
                  type="number"
                  value={vonatId || ""}
                  onChange={(e) =>
                    setVonatId(Number.parseInt(e.target.value) || null)
                  }
                  placeholder="Enter train ID"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nev">Train Name</Label>
                <Input
                  id="nev"
                  value={nev}
                  onChange={(e) => setNev(e.target.value)}
                  placeholder="Enter train name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vonatNem">Train Type</Label>
                <Select value={vonatNem} onValueChange={setVonatNem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select train type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IC">InterCity (IC)</SelectItem>
                    <SelectItem value="EC">EuroCity (EC)</SelectItem>
                    <SelectItem value="EN">EuroNight (EN)</SelectItem>
                    <SelectItem value="Gyorsvonat">Express Train</SelectItem>
                    <SelectItem value="Személyvonat">
                      Passenger Train
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="megallo">Stops</Label>
                <div className="flex space-x-2">
                  <Input
                    id="megallo"
                    value={megallo}
                    onChange={(e) => setMegallo(e.target.value)}
                    placeholder="Add a stop"
                  />
                  <Button type="button" size="sm" onClick={addStop}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  {megallok.map((stop, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {stop}
                      <button
                        type="button"
                        onClick={() => removeStop(stop)}
                        className="ml-1 rounded-full hover:bg-gray-200 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
              {/* Optionally include the submit button here so it is part of the form */}
              <Button
                type="submit"
                disabled={isSubmitting || success}
                className="w-full"
              >
                {isSubmitting
                  ? "Creating Train..."
                  : "Create Train Composition"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Locomotive Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Locomotive</CardTitle>
            <CardDescription>
              Choose a locomotive for your train
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {availableLocomotives.map((locomotive) => (
                <div
                  key={locomotive.mozdonyid}
                  className={`border rounded-lg p-3 cursor-pointer transition-all ${
                    mozdonyId === locomotive.mozdonyid
                      ? "ring-2 ring-primary bg-primary/5"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => setMozdonyId(locomotive.mozdonyid)}
                >
                  <div className="aspect-video relative rounded-md mb-2 bg-white">
                    <img
                      src={
                        locomotive.imageurl ||
                        "/placeholder.svg?height=100&width=200"
                      }
                      alt={locomotive.gyarto}
                      className="object-contain w-full h-full"
                    />
                  </div>
                  <div className="text-center font-medium">
                    {locomotive.gyarto}
                  </div>
                  <div className="text-center text-sm text-muted-foreground">
                    {locomotive.nev}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Coach Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Coaches</CardTitle>
            <CardDescription>
              Add coaches to your train composition
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {availableCoaches.map((coach, index) => {
                const addedCount = kocsiIdk.filter(
                  (id) => id === coach.kocsiid
                ).length;
                return (
                  <div
                    key={`${coach.kocsiid} ${index}`}
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${
                      kocsiIdk.includes(coach.kocsiid)
                        ? "ring-2 ring-primary bg-primary/5"
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => addCoach(coach.kocsiid)}
                  >
                    <div className="aspect-video relative rounded-md mb-2 bg-white">
                      <img
                        src={
                          coach.imageurl ||
                          "/placeholder.svg?height=100&width=200"
                        }
                        alt={coach.kocsiosztaly}
                        className="object-contain w-full h-full"
                      />
                      {addedCount > 0 && (
                        <div className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                          +{addedCount}
                        </div>
                      )}
                    </div>
                    <div className="text-center font-medium">
                      Class {coach.kocsiosztaly}
                    </div>
                    <div className="text-center text-sm text-muted-foreground">
                      {coach.utaster}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Train Composition Preview */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Train Composition Preview</CardTitle>
          <CardDescription>Visual representation of your train</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-row items-end overflow-x-auto pb-4 gap-0 min-h-32">
              {mozdonyId && (
                <div className="shrink-0">
                  <img
                    src={
                      getLocomotiveById(mozdonyId)?.imageurl ||
                      "/placeholder.svg?height=100&width=200"
                    }
                    alt="Locomotive"
                    // className="h-16 object-contain block"
                  />
                </div>
              )}

              {kocsiIdk.map((coachId, index) => {
                const coach = getCoachById(coachId);
                return (
                  <div
                    key={`${coachId}-${index}`}
                    className={`group relative shrink-0 transition-all ${
                      dragCoachIndex === index ? "ring-2 ring-primary/50" : ""
                    }`}
                    draggable
                    onDragStart={() => setDragCoachIndex(index)}
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDrop={() => {
                      if (dragCoachIndex !== null) {
                        moveCoach(dragCoachIndex, index);
                        setDragCoachIndex(null);
                      }
                    }}
                  >
                    <div className="absolute -top-2 -left-2 hidden group-hover:flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          moveCoach(Math.max(0, index), Math.max(0, index - 1))
                        }
                        className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-white border shadow-sm hover:bg-muted"
                        aria-label="Move left"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          moveCoach(
                            index,
                            Math.min(kocsiIdk.length - 1, index + 1)
                          )
                        }
                        className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-white border shadow-sm hover:bg-muted"
                        aria-label="Move right"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCoach(index)}
                        className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-white border shadow-sm hover:bg-red-50"
                        aria-label="Remove coach"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      </button>
                    </div>
                    <div className="mt-1 text-xs text-center text-muted-foreground">
                      Coach {index + 1}
                    </div>
                    <img
                      src={
                        coach?.imageurl ||
                        "/placeholder.svg?height=100&width=200"
                      }
                      alt={`Coach ${index + 1}`}
                      // className="h-16 object-contain block"
                    />
                  </div>
                );
              })}

              {!mozdonyId && kocsiIdk.length === 0 && (
                <div className="flex items-center justify-center w-full py-8 text-muted-foreground">
                  <Train className="mr-2 h-5 w-5" />
                  Select a locomotive and coaches to preview your train
                  composition
                </div>
              )}
            </div>

            {megallok.length > 0 && (
              <div className="mt-2">
                <h3 className="font-medium mb-2">Route:</h3>
                <div className="flex flex-wrap items-center gap-1">
                  {megallok.map((stop, index) => (
                    <div key={`${stop}-${index}`} className="flex items-center">
                      <Badge
                        variant="outline"
                        className="mr-1 cursor-move"
                        draggable
                        onDragStart={() => setDragStopIndex(index)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (dragStopIndex !== null) {
                            moveStop(dragStopIndex, index);
                            setDragStopIndex(null);
                          }
                        }}
                      >
                        {stop}
                      </Badge>
                      {index < megallok.length - 1 && (
                        <ChevronRight className="mr-1 text-gray-400 h-4 w-4" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          {/* If you prefer the submit button outside the form, you can call handleSubmit without an event */}
          <Button
            onClick={() => handleSubmit()}
            disabled={isSubmitting || success}
            className="w-full"
          >
            {isSubmitting ? "Creating Train..." : "Create Train Composition"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// /* eslint-disable @typescript-eslint/no-unused-vars */
// /* eslint-disable @typescript-eslint/no-explicit-any */
// "use client";

// import type React from "react";

// import { useState, useEffect } from "react";
// import {
//   createNewTrain,
//   getAllCoaches,
//   getAllLocomotives,
// } from "@/lib/actions";
// import type { Coach, Locomotive } from "@/lib/db";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardFooter,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { Badge } from "@/components/ui/badge";
// import { AlertCircle, Check, ChevronRight, Plus, Train, X } from "lucide-react";
// import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// export default function TrainCompositionMaker() {
//   // State for available items
//   const [availableCoaches, setAvailableCoaches] = useState<Coach[]>([]);
//   const [availableLocomotives, setAvailableLocomotives] = useState<
//     Locomotive[]
//   >([]);

//   // State for form inputs
//   const [vonatId, setVonatId] = useState<number | null>(null);
//   const [nev, setNev] = useState("");
//   const [vonatNem, setVonatNem] = useState("");
//   const [mozdonyId, setMozdonyId] = useState("");
//   const [kocsiIdk, setKocsiIdk] = useState<string[]>([]);
//   const [megallok, setMegallok] = useState<string[]>([]);
//   const [megallo, setMegallo] = useState("");

//   // State for UI
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [error, setError] = useState("");
//   const [success, setSuccess] = useState(false);

//   // Fetch available coaches and locomotives on component mount
//   useEffect(() => {
//     async function fetchData() {
//       try {
//         const coaches = await getAllCoaches();
//         const locomotives = await getAllLocomotives();
//         setAvailableCoaches(coaches);
//         setAvailableLocomotives(locomotives);
//       } catch (error: any) {
//         setError("Failed to load train components. Please refresh the page.");
//       }
//     }
//     fetchData();
//   }, []);

//   // Handle form submission
//   async function handleSubmit(e: React.FormEvent) {
//     e.preventDefault();
//     setError("");

//     // Validate form
//     if (!vonatId) {
//       setError("Train ID is required");
//       return;
//     }
//     if (!nev.trim()) {
//       setError("Train name is required");
//       return;
//     }
//     if (!vonatNem.trim()) {
//       setError("Train type is required");
//       return;
//     }
//     if (!mozdonyId) {
//       setError("Please select a locomotive");
//       return;
//     }
//     if (kocsiIdk.length === 0) {
//       setError("Please add at least one coach");
//       return;
//     }
//     if (megallok.length === 0) {
//       setError("Please add at least one stop");
//       return;
//     }

//     setIsSubmitting(true);

//     try {
//       await createNewTrain(
//         vonatId,
//         nev,
//         vonatNem,
//         mozdonyId,
//         kocsiIdk,
//         megallok
//       );
//       setSuccess(true);

//       // Reset form after successful submission
//       setTimeout(() => {
//         setVonatId(null);
//         setNev("");
//         setVonatNem("");
//         setMozdonyId("");
//         setKocsiIdk([]);
//         setMegallok([]);
//         setSuccess(false);
//       }, 3000);
//     } catch (error: any) {
//       setError("Failed to load train components. Please refresh the page.");
//     } finally {
//       setIsSubmitting(false);
//     }
//   }

//   // Add a stop to the list
//   function addStop() {
//     if (megallo.trim() && !megallok.includes(megallo.trim())) {
//       setMegallok([...megallok, megallo.trim()]);
//       setMegallo("");
//     }
//   }

//   // Remove a stop from the list
//   function removeStop(stop: string) {
//     setMegallok(megallok.filter((s) => s !== stop));
//   }

//   // Add a coach to the composition
//   function addCoach(coachId: string) {
//     if (!kocsiIdk.includes(coachId)) {
//       setKocsiIdk([...kocsiIdk, coachId]);
//     }
//   }

//   // Remove a coach from the composition
//   function removeCoach(index: number) {
//     setKocsiIdk((prevKocsiIdk) => prevKocsiIdk.filter((_, i) => i !== index));
//   }

//   // Get coach details by ID
//   function getCoachById(id: string): Coach | undefined {
//     return availableCoaches.find((coach) => coach.kocsiid === id);
//   }

//   // Get locomotive details by ID
//   function getLocomotiveById(id: string): Locomotive | undefined {
//     return availableLocomotives.find((loco) => loco.mozdonyid === id);
//   }

//   return (
//     <div className="container mx-auto py-8 px-4">
//       <h1 className="text-3xl font-bold mb-6 text-center">
//         Train Composition Maker
//       </h1>

//       {error && (
//         <Alert variant="destructive" className="mb-6">
//           <AlertCircle className="h-4 w-4" />
//           <AlertTitle>Error</AlertTitle>
//           <AlertDescription>{error}</AlertDescription>
//         </Alert>
//       )}

//       {success && (
//         <Alert className="mb-6 bg-green-50 border-green-200">
//           <Check className="h-4 w-4 text-green-600" />
//           <AlertTitle className="text-green-800">Success</AlertTitle>
//           <AlertDescription className="text-green-700">
//             Train &quot;{nev}&quot; has been created successfully with ID:{" "}
//             {vonatId}!
//           </AlertDescription>
//         </Alert>
//       )}

//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//         {/* Train Details Form */}
//         <Card>
//           <CardHeader>
//             <CardTitle>Train Details</CardTitle>
//             <CardDescription>
//               Enter basic information about the train
//             </CardDescription>
//           </CardHeader>
//           <CardContent>
//             <form onSubmit={handleSubmit} className="space-y-4">
//               <div className="space-y-2">
//                 <Label htmlFor="vonatId">Train ID</Label>
//                 <Input
//                   id="vonatId"
//                   type="number"
//                   value={vonatId || ""}
//                   onChange={(e) =>
//                     setVonatId(Number.parseInt(e.target.value) || null)
//                   }
//                   placeholder="Enter train ID"
//                   required
//                 />
//               </div>

//               <div className="space-y-2">
//                 <Label htmlFor="nev">Train Name</Label>
//                 <Input
//                   id="nev"
//                   value={nev}
//                   onChange={(e) => setNev(e.target.value)}
//                   placeholder="Enter train name"
//                   required
//                 />
//               </div>

//               <div className="space-y-2">
//                 <Label htmlFor="vonatNem">Train Type</Label>
//                 <Select value={vonatNem} onValueChange={setVonatNem}>
//                   <SelectTrigger>
//                     <SelectValue placeholder="Select train type" />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value="IC">InterCity (IC)</SelectItem>
//                     <SelectItem value="EC">EuroCity (EC)</SelectItem>
//                     <SelectItem value="EN">EuroNight (EN)</SelectItem>
//                     <SelectItem value="Gyorsvonat">Express Train</SelectItem>
//                     <SelectItem value="Személyvonat">
//                       Passenger Train
//                     </SelectItem>
//                   </SelectContent>
//                 </Select>
//               </div>

//               <div className="space-y-2">
//                 <Label htmlFor="megallo">Stops</Label>
//                 <div className="flex space-x-2">
//                   <Input
//                     id="megallo"
//                     value={megallo}
//                     onChange={(e) => setMegallo(e.target.value)}
//                     placeholder="Add a stop"
//                   />
//                   <Button type="button" size="sm" onClick={addStop}>
//                     <Plus className="h-4 w-4" />
//                   </Button>
//                 </div>

//                 <div className="flex flex-wrap gap-2 mt-2">
//                   {megallok.map((stop, index) => (
//                     <Badge
//                       key={index}
//                       variant="secondary"
//                       className="flex items-center gap-1"
//                     >
//                       {stop}
//                       <button
//                         type="button"
//                         onClick={() => removeStop(stop)}
//                         className="ml-1 rounded-full hover:bg-gray-200 p-0.5"
//                       >
//                         <X className="h-3 w-3" />
//                       </button>
//                     </Badge>
//                   ))}
//                 </div>
//               </div>
//             </form>
//           </CardContent>
//         </Card>

//         {/* Locomotive Selection */}
//         <Card>
//           <CardHeader>
//             <CardTitle>Select Locomotive</CardTitle>
//             <CardDescription>
//               Choose a locomotive for your train
//             </CardDescription>
//           </CardHeader>
//           <CardContent>
//             <div className="grid grid-cols-2 gap-4">
//               {availableLocomotives.map((locomotive) => (
//                 <div
//                   key={locomotive.mozdonyid}
//                   className={`border rounded-lg p-3 cursor-pointer transition-all ${
//                     mozdonyId === locomotive.mozdonyid
//                       ? "ring-2 ring-primary bg-primary/5"
//                       : "hover:bg-gray-50"
//                   }`}
//                   onClick={() => setMozdonyId(locomotive.mozdonyid)}
//                 >
//                   <div className="aspect-video relative overflow-hidden rounded-md mb-2">
//                     <img
//                       src={
//                         locomotive.imageurl ||
//                         "/placeholder.svg?height=100&width=200"
//                       }
//                       alt={locomotive.gyarto}
//                       //   className="object-cover w-full h-full"
//                     />
//                   </div>
//                   <div className="text-center font-medium">
//                     {locomotive.gyarto}
//                   </div>
//                   <div className="text-center text-sm text-muted-foreground">
//                     {locomotive.nev}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </CardContent>
//         </Card>

//         {/* Coach Selection */}
//         <Card>
//           <CardHeader>
//             <CardTitle>Select Coaches</CardTitle>
//             <CardDescription>
//               Add coaches to your train composition
//             </CardDescription>
//           </CardHeader>
//           <CardContent>
//             <div className="grid grid-cols-2 gap-4">
//               {availableCoaches.map((coach, index) => (
//                 <div
//                   key={`${coach.kocsiid} ${index}`}
//                   className={`border rounded-lg p-3 cursor-pointer transition-all ${
//                     kocsiIdk.includes(coach.kocsiid)
//                       ? "ring-2 ring-primary bg-primary/5"
//                       : "hover:bg-gray-50"
//                   }`}
//                   onClick={() => addCoach(coach.kocsiid)}
//                 >
//                   <div className="aspect-video relative overflow-hidden rounded-md mb-2">
//                     <img
//                       src={
//                         coach.imageurl ||
//                         "/placeholder.svg?height=100&width=200"
//                       }
//                       alt={coach.kocsiosztaly}
//                       //   className="object-cover w-full h-full"
//                     />
//                   </div>
//                   <div className="text-center font-medium">
//                     Class {coach.kocsiosztaly}
//                   </div>
//                   <div className="text-center text-sm text-muted-foreground">
//                     {coach.utaster}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </CardContent>
//         </Card>
//       </div>

//       {/* Train Composition Preview */}
//       <Card className="mt-8">
//         <CardHeader>
//           <CardTitle>Train Composition Preview</CardTitle>
//           <CardDescription>Visual representation of your train</CardDescription>
//         </CardHeader>
//         <CardContent>
//           <div className="flex flex-row items-end overflow-x-auto pb-4">
//             {mozdonyId && (
//               <img
//                 src={
//                   getLocomotiveById(mozdonyId)?.imageurl ||
//                   "/placeholder.svg?height=100&width=200"
//                 }
//                 alt="Locomotive"
//                 // className="self-center bg-red-400"
//                 //   className="object-cover w-full h-full"
//               />
//               //   <div className="flex-shrink-0 mr-2">
//               //     <div className="border rounded-lg p-2 bg-amber-50 ">
//               //       <div className="aspect-video relative overflow-hidden rounded-md mb-2">
//               //         <img
//               //           src={
//               //             getLocomotiveById(mozdonyId)?.imageurl ||
//               //             "/placeholder.svg?height=100&width=200"
//               //           }
//               //           alt="Locomotive"
//               //           //   className="object-cover w-full h-full"
//               //         />
//               //       </div>
//               //       <div className="text-center text-sm font-medium">
//               //         {getLocomotiveById(mozdonyId)?.gyarto}
//               //       </div>
//               //     </div>
//               //   </div>
//             )}

//             {kocsiIdk.map((coachId, index) => {
//               const coach = getCoachById(coachId);
//               return (
//                 <img
//                   key={index}
//                   src={
//                     coach?.imageurl || "/placeholder.svg?height=100&width=200"
//                   }
//                   onClick={() => removeCoach(index)}
//                   alt={`Coach ${index + 1}`}
//                   //   className="self-center bg-red-400"
//                   // className="object-cover w-full h-full"
//                 />
//                 // <div key={index} className="flex items-center flex-shrink-0">
//                 //   <ChevronRight className="mx-1 text-gray-400" />
//                 //   <div className="border rounded-lg p-2 bg-blue-50 ">
//                 //     <div className="aspect-video relative overflow-hidden rounded-md mb-2">
//                 //       <img
//                 //         src={
//                 //           coach?.imageurl ||
//                 //           "/placeholder.svg?height=100&width=200"
//                 //         }
//                 //         alt={`Coach ${index + 1}`}
//                 //         // className="object-cover w-full h-full"
//                 //       />
//                 //     </div>
//                 //     <div className="text-center text-sm font-medium">
//                 //       Class {coach?.kocsiosztaly}
//                 //     </div>
//                 //   </div>
//                 // </div>
//               );
//             })}

//             {!mozdonyId && kocsiIdk.length === 0 && (
//               <div className="flex items-center justify-center w-full py-8 text-muted-foreground">
//                 <Train className="mr-2 h-5 w-5" />
//                 Select a locomotive and coaches to preview your train
//                 composition
//               </div>
//             )}
//           </div>

//           {megallok.length > 0 && (
//             <div className="mt-4">
//               <h3 className="font-medium mb-2">Route:</h3>
//               <div className="flex flex-wrap items-center">
//                 {megallok.map((stop, index) => (
//                   <div key={index} className="flex items-center">
//                     <Badge variant="outline" className="mr-1">
//                       {stop}
//                     </Badge>
//                     {index < megallok.length - 1 && (
//                       <ChevronRight className="mr-1 text-gray-400 h-4 w-4" />
//                     )}
//                   </div>
//                 ))}
//               </div>
//             </div>
//           )}
//         </CardContent>
//         <CardFooter>
//           <Button
//             onClick={handleSubmit}
//             disabled={isSubmitting || success}
//             className="w-full"
//           >
//             {isSubmitting ? "Creating Train..." : "Create Train Composition"}
//           </Button>
//         </CardFooter>
//       </Card>
//     </div>
//   );
// }

// // "use client";
// // import {
// //   createNewTrain,
// //   getAllCoaches,
// //   getAllLocomotives,
// // } from "@/lib/actions";
// // import { Coach, Locomotive } from "@/lib/db";
// // import React, { useEffect, useState } from "react";

// // const Page = () => {
// //   const [availableCoaches, setAvailableCoaches] = useState<Coach[]>([]);
// //   const [availableLocomotives, setAvailableLocomotives] = useState<
// //     Locomotive[]
// //   >([]);
// //   const [vonatId, setVonatId] = useState<number | null>();
// //   const [nev, setNev] = useState("");
// //   const [vonatNem, setVonatNem] = useState("");
// //   const [mozdonyId, setMozdonyId] = useState("");
// //   const [kocsiIdk, setKocsiIdk] = useState<string[]>([]);
// //   const [megallok, setMegallok] = useState<string[]>([]);

// //   useEffect(() => {
// //     async function getCoaches() {
// //       const res = await getAllCoaches();
// //       setAvailableCoaches(res);
// //     }
// //     async function getLocomotives() {
// //       const res = await getAllLocomotives();
// //       setAvailableLocomotives(res);
// //     }
// //     getCoaches();
// //     getLocomotives();
// //   }, []);

// //   async function createTrain(e: any) {
// //     e.preventDefault();
// //     if (vonatId && nev && vonatNem && mozdonyId && kocsiIdk && megallok) {
// //       await createNewTrain(
// //         vonatId,
// //         nev,
// //         vonatNem,
// //         mozdonyId,
// //         kocsiIdk,
// //         megallok
// //       );
// //       console.log("Siker");
// //     }
// //   }
// //   return (
// //     <div className="flex flex-col gap-2 items-center">
// //       <div className="flex flex-row gap-2">
// //         {availableLocomotives.map((locomotive) => (
// //           <div key={locomotive.mozdonyid} className="flex flex-col gap-2">
// //             <div className="text-center">{locomotive.gyarto}</div>
// //             <img src={`${locomotive.imageurl}`} alt={locomotive.gyarto} />
// //           </div>
// //         ))}
// //       </div>
// //       <div className="flex flex-row gap-2">
// //         {availableCoaches.map((coach) => (
// //           <div key={coach.kocsiid} className="flex flex-col gap-2">
// //             <div className="text-center">{coach.kocsiosztaly}</div>
// //             <img src={`${coach.imageurl}`} alt={coach.kocsiosztaly} />
// //           </div>
// //         ))}
// //       </div>
// //     </div>
// //   );
// // };

// // export default Page;
