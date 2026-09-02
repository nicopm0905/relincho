"use client";

import { trpc } from "@/lib/trpc/react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Heartbeat, 
  Path, 
  Baby, 
  Barbell, 
  CheckCircle,
  Stethoscope
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface TimelineProps {
  horseId: string;
}

export function HorseTimeline({ horseId }: TimelineProps) {
  const { data: events, isLoading, error } = trpc.horses.timeline.useQuery({ horseId });

  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !events) {
    return <p className="text-sm text-destructive py-4">Error al cargar el historial.</p>;
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground border border-dashed border-border/50 rounded-2xl bg-muted/10">
        <CheckCircle weight="duotone" className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium">No hay eventos recientes registrados</p>
      </div>
    );
  }

  return (
    <div className="relative border-l border-border/60 ml-5 py-4 space-y-8 before:absolute before:inset-0 before:bg-gradient-to-b before:from-transparent before:via-border/60 before:to-transparent">
      {events.map((ev, index) => {
        let Icon = Heartbeat;
        let color = "bg-rose-50 text-rose-500 border-rose-200";
        let title = "";
        let description = "";

        switch (ev._model) {
          case "HealthEvent":
            Icon = Stethoscope;
            color = "bg-rose-50 text-rose-500 border-rose-200";
            title = ev.name;
            // @ts-ignore
            description = ev.notes || ev.type;
            break;
          case "TrainingSession":
            Icon = Barbell;
            color = "bg-blue-50 text-blue-500 border-blue-200";
            // @ts-ignore
            title = ev.type || "Sesión de Entrenamiento";
            // @ts-ignore
            description = `${ev.minutes} min` + (ev.riderName ? ` con ${ev.riderName}` : "");
            break;
          case "Movement":
            Icon = Path;
            color = "bg-amber-50 text-amber-500 border-amber-200";
            // @ts-ignore
            title = ev.direction === "IN" ? "Entrada a Cuadra" : "Salida de Cuadra";
            // @ts-ignore
            description = ev.reason || "Movimiento registrado";
            break;
          case "Covering":
            Icon = Baby;
            color = "bg-pink-50 text-pink-500 border-pink-200";
            // @ts-ignore
            title = "Cubrición / Salto";
            // @ts-ignore
            description = ev.stallion ? `Con ${ev.stallion.name}` : ev.method;
            break;
          case "Foaling":
            Icon = Baby;
            color = "bg-purple-50 text-purple-500 border-purple-200";
            title = "Parto";
            // @ts-ignore
            description = ev.alive ? "Potro vivo" : "Complicaciones";
            break;
        }

        return (
          <div key={`${ev._model}-${ev.id}`} className="relative pl-8 animate-in slide-in-from-left-4 fade-in-0" style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}>
            <div className={cn(
              "absolute -left-5 top-0.5 h-10 w-10 rounded-full flex items-center justify-center border-2 shadow-sm bg-white ring-4 ring-white z-10",
              color
            )}>
              <Icon weight="duotone" className="h-5 w-5" />
            </div>
            
            <div className="bg-white border border-border/50 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                <h4 className="font-bold text-foreground">{title}</h4>
                <time className="text-xs font-semibold text-muted-foreground bg-muted/50 px-2 py-1 rounded-md w-fit">
                  {format(new Date(ev.date), "d MMM yyyy, HH:mm", { locale: es })}
                </time>
              </div>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
