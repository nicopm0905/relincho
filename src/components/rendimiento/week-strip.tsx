"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";
import {
  dayStatusDot,
  dayStatusLabels,
  dayStatusTone,
  phaseBarColor,
  workTypeShortLabels,
} from "./labels";

interface DayRow {
  id: string;
  date: Date;
  workType: string;
  rpeTarget: number;
  durationMinutes: number;
  plannedLoadUa: number;
  impactSurfaceMinutes: number;
  status: string;
  actualLoadUa: number | null;
  adjustmentReason: string | null;
}

interface Props {
  horseId: string;
  days: DayRow[];
  /** Fase del mesociclo, que da color a las barras de carga. */
  phase?: string | null;
}

/**
 * Microciclo en curso. La barra lavada es la carga planificada y la solida la
 * que el caballo ha hecho de verdad, asi que una sesion pasada de vueltas se ve
 * sobresalir. El color es el de la fase; el estado va en el punto de la esquina.
 */
export function WeekStrip({ horseId, days, phase }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const markMissed = trpc.performance.markMissedDay.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.adjustments.length > 0
          ? `Día marcado como perdido. ${result.adjustments.length} días reajustados.`
          : "Día marcado como perdido. No quedaba margen para repartir la carga.",
      );
      setPendingId(null);
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message || "No se pudo recalcular");
      setPendingId(null);
    },
  });

  const barColor = phaseBarColor[phase ?? ""] ?? "bg-foreground/40";
  const peak = Math.max(
    1,
    ...days.map((d) => Math.max(d.plannedLoadUa, d.actualLoadUa ?? 0)),
  );
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((day) => {
        const isToday = day.date.toISOString().slice(0, 10) === todayKey;
        const isRest = day.workType === "DESCANSO";
        const canMiss = day.status === "PLANNED" || day.status === "ADJUSTED";
        const plannedPct = Math.round((day.plannedLoadUa / peak) * 100);
        const actualPct =
          day.actualLoadUa != null
            ? Math.round((day.actualLoadUa / peak) * 100)
            : null;

        return (
          <div
            key={day.id}
            className={cn(
              "flex min-h-[150px] flex-col rounded-lg border p-3 transition-colors",
              isRest ? "border-dashed bg-transparent" : "border-border bg-card",
              isToday && "border-foreground/25 bg-muted/50",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "text-[12px] font-medium capitalize",
                  isToday ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {format(day.date, "EEE d", { locale: es })}
              </span>
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  dayStatusDot[day.status] ?? "bg-border",
                )}
                aria-hidden
              />
            </div>

            <div className="mt-2 text-[13px] leading-snug font-medium text-foreground">
              {workTypeShortLabels[day.workType] ?? day.workType}
            </div>

            {!isRest && (
              <>
                <div className="mt-0.5 text-[12px] tabular-nums text-muted-foreground">
                  {day.durationMinutes} min · Intensidad {day.rpeTarget}/10
                </div>

                <div className="mt-2.5 flex items-end gap-2">
                  <div
                    className="relative flex h-10 w-6 items-end"
                    title={`${day.plannedLoadUa} UA planificadas${
                      day.actualLoadUa != null
                        ? ` · ${day.actualLoadUa} UA reales`
                        : ""
                    }`}
                  >
                    <div
                      className={cn("w-full rounded-t opacity-25", barColor)}
                      style={{ height: `${Math.max(6, plannedPct)}%` }}
                    />
                    {actualPct != null && (
                      <div
                        className={cn("absolute bottom-0 w-full rounded-t", barColor)}
                        style={{ height: `${Math.max(4, actualPct)}%` }}
                      />
                    )}
                  </div>
                  <span className="pb-0.5 text-[11.5px] tabular-nums text-muted-foreground">
                    {day.actualLoadUa ?? day.plannedLoadUa} UA
                  </span>
                </div>
              </>
            )}

            {day.adjustmentReason && (
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                {day.adjustmentReason}
              </p>
            )}

            <div className="mt-auto pt-2">
              {canMiss && !isRest ? (
                <button
                  type="button"
                  disabled={markMissed.isPending && pendingId === day.id}
                  onClick={() => {
                    setPendingId(day.id);
                    markMissed.mutate({ horseId, date: day.date });
                  }}
                  className="text-[11.5px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
                >
                  Marcar perdido
                </button>
              ) : (
                <span
                  className={cn(
                    "text-[11.5px] font-medium",
                    dayStatusTone[day.status] ?? "text-muted-foreground",
                  )}
                >
                  {isRest && day.status === "PLANNED"
                    ? "Libre"
                    : (dayStatusLabels[day.status] ?? day.status)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
