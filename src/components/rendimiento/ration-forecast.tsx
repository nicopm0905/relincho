import { format } from "date-fns";
import { es } from "date-fns/locale";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { workTypeShortLabels } from "./labels";

interface ForecastRow {
  id: string;
  date: Date;
  workType: string | null;
  internalLoadUa: number;
  forageKg: unknown;
  concentrateKg: unknown;
  extraConcentrateGrams: number;
  electrolytesGrams: number;
  totalMeals: number;
  isProjection: boolean;
}

/**
 * Dieta dia a dia de los proximos dias. Las filas en previsión salen de la
 * carga planificada; las confirmadas, del reporte real del jinete.
 */
export function RationForecast({ rows }: { rows: ForecastRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        variant="plain"
        title="Sin previsión de dieta"
        description="Se calcula sola en cuanto el caballo tiene plan de entrenamiento."
      />
    );
  }

  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3">
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 text-[12px] font-medium text-muted-foreground">
                Día
              </th>
              <th className="pb-2 text-[12px] font-medium text-muted-foreground">
                Trabajo
              </th>
              <th className="pb-2 text-right text-[12px] font-medium text-muted-foreground">
                Carga
              </th>
              <th className="pb-2 text-right text-[12px] font-medium text-muted-foreground">
                Forraje
              </th>
              <th className="pb-2 text-right text-[12px] font-medium text-muted-foreground">
                Pienso
              </th>
              <th className="pb-2 text-right text-[12px] font-medium text-muted-foreground">
                Tomas
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {rows.map((row) => {
              const isToday = row.date.toISOString().slice(0, 10) === todayKey;
              const isRest = row.workType === "DESCANSO";
              return (
                <tr
                  key={row.id}
                  className={cn("align-baseline", isToday && "bg-muted/50")}
                >
                  <td className="py-2 pr-2">
                    <span
                      className={cn(
                        "text-[13px] capitalize",
                        isToday
                          ? "font-medium text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {format(row.date, "EEE d", { locale: es })}
                    </span>
                    {!row.isProjection && (
                      <span className="ml-1.5 text-[11px] text-emerald-700">
                        confirmada
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-[13px] text-foreground">
                    {row.workType
                      ? (workTypeShortLabels[row.workType] ?? row.workType)
                      : "—"}
                  </td>
                  <td className="py-2 pr-2 text-right text-[12.5px] tabular-nums text-muted-foreground">
                    {isRest ? "—" : `${row.internalLoadUa} UA`}
                  </td>
                  <td className="py-2 pr-2 text-right text-[12.5px] tabular-nums text-foreground">
                    {Number(row.forageKg)} kg
                  </td>
                  <td className="py-2 pr-2 text-right text-[12.5px] tabular-nums text-foreground">
                    {Number(row.concentrateKg)} kg
                    {row.extraConcentrateGrams > 0 && (
                      <span className="ml-1 text-[11.5px] text-amber-700">
                        +{row.extraConcentrateGrams}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right text-[12.5px] tabular-nums text-foreground">
                    {row.totalMeals}
                    {row.electrolytesGrams > 0 && (
                      <span className="ml-1 text-[11.5px] text-amber-700">+E</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[12px] text-muted-foreground">
        Las filas sin marcar son previsión sobre la carga planificada. Al reportar
        la sesión del día, esa fila se recalcula con el trabajo real y queda
        confirmada. <span className="font-medium text-foreground">+E</span> indica
        electrolitos en la toma de después del entreno.
      </p>
    </div>
  );
}
