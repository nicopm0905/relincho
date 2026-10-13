"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Baby, Barbell, CheckCircle, Path, Stethoscope, type Icon } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EditTrainingDialog } from "./record-edit-dialogs";

interface TimelineProps {
  horseId: string;
}

/** Cada tipo de registro con su tono de estado: ninguno inventa color propio. */
const kinds: Record<string, { icon: Icon; tone: string }> = {
  HealthEvent: { icon: Stethoscope, tone: "bg-state-ok-soft text-state-ok-ink" },
  TrainingSession: { icon: Barbell, tone: "bg-state-covered-soft text-state-covered-ink" },
  Movement: { icon: Path, tone: "bg-state-empty-soft text-state-empty-ink" },
  Covering: { icon: Baby, tone: "bg-state-heat-soft text-state-heat-ink" },
  Foaling: { icon: Baby, tone: "bg-state-foaled-soft text-state-foaled-ink" },
};

export function HorseTimeline({ horseId }: TimelineProps) {
  const t = useTranslations("horseDetail.timeline");
  const tType = useTranslations("home.healthTypes");
  const format = useFormatter();
  const { data: events, isLoading, error } = trpc.horses.timeline.useQuery({ horseId });

  if (isLoading) {
    return (
      <div className="space-y-4 py-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !events) {
    return <p className="py-4 text-body text-destructive">{t("error")}</p>;
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
        <CheckCircle aria-hidden className="mb-3 h-8 w-8 text-muted-foreground/60" />
        <p className="text-body">{t("empty")}</p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-1 before:absolute before:top-4 before:bottom-4 before:left-[17px] before:w-px before:bg-border">
      {events.map((ev) => {
        const kind = kinds[ev._model] ?? kinds.HealthEvent!;
        let title = "";
        let description = "";
        switch (ev._model) {
          case "HealthEvent":
            title = ev.name;
            description = ev.notes || tType(ev.type);
            break;
          case "TrainingSession":
            title = ev.type || t("training");
            description = ev.riderName
              ? t("withRider", { minutes: ev.minutes, rider: ev.riderName })
              : t("minutes", { minutes: ev.minutes });
            break;
          case "Movement":
            title = ev.direction === "IN" ? t("movementIn") : t("movementOut");
            description = ev.reason || t("movement");
            break;
          case "Covering":
            title = t("covering");
            description = ev.stallion ? t("coveringWith", { stallion: ev.stallion.name }) : "";
            break;
          case "Foaling":
            title = t("foaling");
            description = ev.alive ? t("foalAlive") : t("foalComplications");
            break;
        }
        const Icon = kind.icon;

        return (
          <li key={`${ev._model}-${ev.id}`} className="relative flex gap-4 py-2.5">
            <span
              aria-hidden
              className={cn(
                "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-card",
                kind.tone,
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="truncate text-body font-semibold text-foreground">{title}</p>
                {description && <p className="text-label text-muted-foreground">{description}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <time className="text-caption tabular-nums text-muted-foreground">
                  {format.dateTime(new Date(ev.date), { day: "numeric", month: "short", year: "numeric" })}
                </time>
                {ev._model === "TrainingSession" && (
                  <EditTrainingDialog
                    session={{
                      id: ev.id,
                      date: ev.date,
                      minutes: ev.minutes,
                      type: ev.type,
                      riderName: ev.riderName,
                      notes: ev.notes,
                    }}
                  />
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
