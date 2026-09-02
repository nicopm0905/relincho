"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/react";
import { X, CheckCircle, WarningCircle, Clock, SpinnerGap } from "@phosphor-icons/react";
import { SwipeableCard } from "@/components/kiosko/swipeable-card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function KioskoPage() {
  const { tenantSlug } = useParams();
  
  // Determinar la comida actual según la hora
  const hour = new Date().getHours();
  let defaultMeal = "MAÑANA";
  if (hour >= 12 && hour < 17) defaultMeal = "MEDIODIA";
  if (hour >= 17) defaultMeal = "TARDE";
  
  const [mealType, setMealType] = useState(defaultMeal);
  const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  
  const utils = trpc.useUtils();
  
  const { data: horses, isLoading, isError } = trpc.feeding.getDailyStatus.useQuery({
    mealType,
    date: dateStr
  }, {
    refetchInterval: 30000 // Refresca cada 30s
  });
  
  const logMeal = trpc.feeding.logMeal.useMutation({
    onSuccess: () => {
      // Refresh local cache transparently
      utils.feeding.getDailyStatus.invalidate({ mealType, date: dateStr });
    },
    onError: (err) => {
      toast.error(err.message || "Error al registrar");
    }
  });

  const handleSwipe = (horseId: string, status: "DONE" | "SKIPPED") => {
    logMeal.mutate({
      horseId,
      mealType,
      date: dateStr,
      status
    });
    toast.success(`Comida ${status === "DONE" ? "repartida" : "omitida"} correctamente`, {
      duration: 2000,
      position: "top-center"
    });
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center">
        <SpinnerGap weight="bold" className="h-12 w-12 text-orange-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold font-heading text-foreground">Cargando kiosko...</h2>
      </div>
    );
  }
  
  if (isError) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 text-center">
        <WarningCircle weight="duotone" className="h-16 w-16 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-foreground">Error al cargar datos</h2>
        <Button asChild className="mt-6 rounded-full" variant="outline">
          <Link href={`/${tenantSlug}/inicio`}>Volver al inicio</Link>
        </Button>
      </div>
    );
  }
  
  const pendingHorses = horses?.filter(h => h.status === "PENDING") || [];
  const completedHorses = horses?.filter(h => h.status !== "PENDING") || [];
  
  // Agrupar pendientes por boxLocation
  const groupedPending = pendingHorses.reduce((acc, horse) => {
    const loc = horse.boxLocation || "Sin ubicación";
    if (!acc[loc]) acc[loc] = [];
    acc[loc].push(horse);
    return acc;
  }, {} as Record<string, typeof pendingHorses>);

  return (
    <div className="fixed inset-0 z-[100] bg-muted/20 overflow-y-auto safe-area-bottom pb-20 animate-in slide-in-from-bottom duration-300">
      
      {/* Header Sticky */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-lg border-b border-border/40 px-4 py-3 shadow-sm flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
            <Clock className="h-3 w-3" /> Reparto Activo
          </span>
          <h1 className="text-2xl font-black font-heading text-foreground tracking-tight">Modo Kiosko</h1>
        </div>
        <Button asChild variant="ghost" size="icon" className="rounded-full bg-muted/50 hover:bg-muted text-foreground h-10 w-10 shrink-0">
          <Link href={`/${tenantSlug}/inicio`}>
            <X weight="bold" className="h-5 w-5" />
          </Link>
        </Button>
      </div>
      
      {/* Selector de Comida */}
      <div className="p-4 flex gap-2 overflow-x-auto no-scrollbar">
        {["MAÑANA", "MEDIODIA", "TARDE"].map(meal => (
          <button
            key={meal}
            onClick={() => setMealType(meal)}
            className={`px-5 py-2.5 rounded-full text-sm font-bold tracking-wide transition-all whitespace-nowrap ${
              mealType === meal 
                ? "bg-orange-600 text-white shadow-md scale-105" 
                : "bg-white text-muted-foreground border border-border/40 hover:bg-muted/50"
            }`}
          >
            {meal === "MAÑANA" && "Desayuno"}
            {meal === "MEDIODIA" && "Almuerzo"}
            {meal === "TARDE" && "Cena"}
          </button>
        ))}
      </div>
      
      <div className="px-4 pb-12 max-w-lg mx-auto">
        {pendingHorses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-24 w-24 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
              <CheckCircle weight="fill" className="h-12 w-12 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-black font-heading text-emerald-700">¡Todo repartido!</h2>
            <p className="text-muted-foreground mt-2 font-medium">
              No quedan raciones pendientes para el {mealType.toLowerCase()}.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedPending).map(([location, horsesInLoc]) => (
              <div key={location} className="space-y-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground bg-white px-3 py-1 rounded-lg border border-border/40 shadow-sm inline-block">
                    {location}
                  </h3>
                  <div className="h-px bg-border flex-1" />
                </div>
                
                <div className="space-y-1 relative">
                  {horsesInLoc.map((horse) => (
                    <SwipeableCard
                      key={horse.horseId}
                      horseName={horse.horseName}
                      boxLocation={horse.boxLocation}
                      photoUrl={horse.photoUrl}
                      diet={horse.diet as string[]}
                      status={horse.status as any}
                      onSwipe={(status) => handleSwipe(horse.horseId, status)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Resumen Finalizados */}
        {completedHorses.length > 0 && (
          <div className="mt-12 pt-8 border-t border-border/40">
            <h4 className="text-sm font-bold text-muted-foreground uppercase mb-4 px-2">Ya registrados ({completedHorses.length})</h4>
            <div className="space-y-2 opacity-60">
              {completedHorses.map(horse => (
                  <SwipeableCard
                    key={horse.horseId}
                    horseName={horse.horseName}
                    boxLocation={horse.boxLocation}
                    photoUrl={horse.photoUrl}
                    diet={horse.diet as string[]}
                    status={horse.status as any}
                    onSwipe={() => {}}
                  />
              ))}
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
}
