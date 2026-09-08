import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Warning } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { phaseBarColor, phaseDescriptions, phaseLabels } from "./labels";

interface MicrocycleRow {
  id: string;
  weekNumber: number;
  startDate: Date;
  plannedLoadUa: number;
  actualLoadUa: number;
  bufferStatus: string;
  isCurrent: boolean;
}

interface MesocycleRow {
  id: string;
  phase: string;
  weeks: number;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  microcycles: MicrocycleRow[];
}

/**
 * Mapa de la temporada: una columna por semana, agrupadas por mesociclo y
 * coloreadas por fase. Las semanas ya vividas van en color pleno y las que
 * quedan por delante en el mismo tono lavado, para que se lea de un vistazo
 * por donde va la temporada.
 */
export function MesocycleTimeline({ mesocycles }: { mesocycles: MesocycleRow[] }) {
  const peak = Math.max(
    1,
    ...mesocycles.flatMap((m) => m.microcycles.map((w) => w.plannedLoadUa)),
  );
  const totalWeeks = mesocycles.reduce((acc, m) => acc + m.weeks, 0);
  const current = mesocycles.find((m) => m.isCurrent);
  const phasesUsed = mesocycles.map((m) => m.phase).filter(
    (phase, index, all) => all.indexOf(phase) === index,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-stretch gap-3">
        {mesocycles.map((meso) => (
          <div
            key={meso.id}
            className="min-w-0 space-y-2"
            style={{ flexGrow: meso.weeks, flexBasis: 0 }}
          >
            {/* 2px de separacion entre columnas: el hueco separa, no un borde. */}
            <div className="flex h-28 items-end gap-0.5">
              {meso.microcycles.map((week) => {
                const height = Math.round((week.plannedLoadUa / peak) * 100);
                const done = week.actualLoadUa > 0;
                const exhausted = week.bufferStatus === "exhausted";
                return (
                  <div
                    key={week.id}
                    className="flex h-full min-w-0 flex-1 flex-col justify-end"
                    title={`Semana ${week.weekNumber} · ${phaseLabels[meso.phase]} · ${
                      week.plannedLoadUa
                    } UA planificadas${
                      done ? ` · ${week.actualLoadUa} UA reales` : ""
                    }${exhausted ? " · margen agotado" : ""}`}
                  >
                    {exhausted && (
                      <Warning
                        weight="fill"
                        className="mx-auto mb-1 h-3 w-3 shrink-0 text-amber-500"
                      />
                    )}
                    <div
                      className={cn(
                        "mx-auto w-full max-w-[24px] rounded-t",
                        phaseBarColor[meso.phase] ?? "bg-foreground/30",
                        done ? "opacity-100" : "opacity-40",
                      )}
                      style={{ height: `${Math.max(6, height)}%` }}
                    />
                    <div
                      className={cn(
                        "mx-auto mt-1 h-0.5 w-full max-w-[24px] rounded-full",
                        week.isCurrent ? "bg-foreground" : "bg-transparent",
                      )}
                      aria-hidden
                    />
                  </div>
                );
              })}
            </div>

            <div
              className={cn(
                "border-t pt-2",
                meso.isCurrent ? "border-foreground/30" : "border-border",
              )}
            >
              <div
                className={cn(
                  "truncate text-[12.5px] font-medium",
                  meso.isCurrent ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {phaseLabels[meso.phase] ?? meso.phase}
              </div>
              <div className="truncate text-[11.5px] tabular-nums text-muted-foreground">
                {meso.weeks} sem · {format(meso.startDate, "d MMM", { locale: es })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3">
        {phasesUsed.map((phase) => (
          <span key={phase} className="flex items-center gap-1.5">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                phaseBarColor[phase] ?? "bg-foreground/30",
              )}
              aria-hidden
            />
            <span className="text-[12px] text-muted-foreground">
              {phaseLabels[phase] ?? phase}
            </span>
          </span>
        ))}
        <span className="text-[12px] text-muted-foreground">
          Tono claro: semanas por venir
        </span>
      </div>

      {current && (
        <p className="text-[12.5px] text-muted-foreground">
          <span className="font-medium text-foreground">
            {phaseLabels[current.phase]}
          </span>{" "}
          · {phaseDescriptions[current.phase]} · {totalWeeks} semanas de temporada
        </p>
      )}
    </div>
  );
}
