"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReportSessionDialog } from "./report-session-dialog";
import { workTypeLabels } from "./labels";

interface PendingSession {
  dailyLoadId: string;
  horseId: string;
  horseName: string;
  date: Date;
  workType: string;
  rpeTarget: number;
  durationMinutes: number;
  plannedLoadUa: number;
}

interface Props {
  sessions: PendingSession[];
}

/** "Ayer" / "Hace 3 días" — el dia pesa mas que la fecha exacta. */
function whenLabel(date: Date): string {
  if (isYesterday(date)) return "Ayer";
  if (isToday(date)) return "Hoy";
  return format(date, "EEEE d 'de' MMMM", { locale: es });
}

/**
 * Cierre de las sesiones ya pasadas que nadie ha confirmado. Sin este dato la
 * carga real se queda a cero, el microciclo no se reajusta y la racion se
 * recalcula a ciegas, asi que el aviso vive donde se abre la app: el inicio.
 */
export function SessionCheckIn({ sessions }: Props) {
  const router = useRouter();

  const markMissed = trpc.performance.markMissedDay.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.adjustments.length > 0
          ? `Sesión descartada. ${result.adjustments.length} días reajustados.`
          : "Sesión descartada. No quedaba margen para repartir la carga.",
      );
      router.refresh();
    },
    onError: (error) =>
      toast.error(error.message || "No se pudo actualizar la sesión"),
  });

  if (sessions.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle>¿Se hizo la sesión?</CardTitle>
        <CardDescription>
          Confirmarla mantiene la carga de la semana y la ración al día.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {sessions.map((session) => (
          <div
            key={session.dailyLoadId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3.5 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium text-foreground">
                {session.horseName}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {whenLabel(session.date)} ·{" "}
                {workTypeLabels[session.workType] ?? session.workType} ·{" "}
                {session.durationMinutes} min · intensidad {session.rpeTarget}/10
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <ReportSessionDialog
                horseId={session.horseId}
                horseName={session.horseName}
                plannedMinutes={session.durationMinutes}
                plannedRpe={session.rpeTarget}
                sessionDate={session.date}
                triggerLabel="Sí, se hizo"
              />
              <Button
                variant="outline"
                disabled={markMissed.isPending}
                onClick={() =>
                  markMissed.mutate({
                    horseId: session.horseId,
                    date: session.date,
                  })
                }
              >
                No se hizo
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
