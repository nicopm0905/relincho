import { Warning } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/formatters";
import {
  HENNEKE,
  WEIGHT_METHOD_LABELS,
  WEIGH_EVERY_DAYS,
  fmtScore,
  hennekeName,
  type ConditionStatus,
} from "@/lib/body-condition";
import type { BodyConditionSummary } from "@/server/services/body-condition";
import { WeighDialog } from "./weigh-dialog";
import { DeleteMeasurementButton } from "./delete-measurement-button";

const STATUS_STYLE: Record<ConditionStatus, string> = {
  OK: "border-green-300/70 bg-green-50/60 text-green-900 dark:bg-green-500/10 dark:text-green-200",
  BAJA: "border-amber-300/70 bg-amber-50/60 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200",
  ALTA: "border-amber-300/70 bg-amber-50/60 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200",
  MUY_BAJA: "border-red-300/70 bg-red-50/60 text-red-900 dark:bg-red-500/10 dark:text-red-200",
  MUY_ALTA: "border-red-300/70 bg-red-50/60 text-red-900 dark:bg-red-500/10 dark:text-red-200",
};

const kg = (value: number) => `${value.toLocaleString("es-ES", { maximumFractionDigits: 1 })} kg`;
const signed = (value: number, unit: string) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toLocaleString("es-ES", { maximumFractionDigits: 1 })}${unit}`;

function ago(days: number | null) {
  if (days == null) return "";
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

interface Props {
  data: BodyConditionSummary;
  birthDate?: Date | null;
  canRecord: boolean;
  canManage: boolean;
}

/**
 * Peso real y condición corporal del caballo. El último peso alimenta solo la
 * ración del día, la de cría y la dosis del desparasitante.
 */
export function BodyConditionCard({ data, birthDate, canRecord, canManage }: Props) {
  const { lastWeight, lastCondition, target, assessment, trend } = data;
  const recent = [...data.measurements].reverse().slice(0, 6);

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-foreground">Peso y condición corporal</h2>
          <p className="text-[12.5px] text-muted-foreground">
            El último peso es el que usan la ración y la dosis del desparasitante.
          </p>
        </div>
        {canRecord && (
          <WeighDialog
            horseId={data.horse.id}
            horseName={data.horse.name}
            birthDate={birthDate}
            lastMethod={lastWeight?.method ?? null}
          />
        )}
      </div>

      <div className="space-y-4 px-5 py-4">
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-[12px] font-medium text-muted-foreground">Peso</dt>
            <dd className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
              {data.weightKg != null ? kg(data.weightKg) : "—"}
            </dd>
            <dd className="text-[12px] text-muted-foreground">
              {lastWeight
                ? `${WEIGHT_METHOD_LABELS[lastWeight.method]} · ${formatDate(lastWeight.date)} (${ago(data.daysSinceWeighed)})`
                : data.weightFromProfileOnly
                  ? "De la ficha veterinaria: aún sin pesajes"
                  : "Sin pesar: la ración usa 500 kg de referencia"}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-medium text-muted-foreground">Condición (Henneke 1-9)</dt>
            <dd className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
              {lastCondition ? fmtScore(lastCondition.bodyCondition) : "—"}
              {lastCondition && (
                <span className="ml-1.5 text-[14px] font-medium text-muted-foreground">
                  {hennekeName(lastCondition.bodyCondition)}
                </span>
              )}
            </dd>
            <dd className="text-[12px] text-muted-foreground">
              Objetivo {fmtScore(target.min)}-{fmtScore(target.max)}
              {lastCondition ? ` · ${formatDate(lastCondition.date)}` : ""}
            </dd>
          </div>
        </dl>

        {assessment && (
          <div className={cn("rounded-xl border px-3.5 py-2.5 text-[13px]", STATUS_STYLE[assessment.status])}>
            <p className="font-medium">{assessment.text}</p>
            <p className="mt-0.5 text-[12px] opacity-80">{target.reason}</p>
          </div>
        )}

        <ul className="space-y-1.5 text-[13px] text-foreground">
          {trend && (
            <li className={cn(trend.alert && "flex items-start gap-1.5 font-medium text-amber-800 dark:text-amber-300")}>
              {trend.alert && <Warning weight="fill" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
              <span>
                En {trend.days} días: {signed(trend.changeKg, " kg")} ({signed(trend.changePct, " %")}).
                {trend.alert === "PIERDE" &&
                  " Más del 5 % en un mes: revisa ración, dientes y parásitos; si no hay explicación, al veterinario."}
                {trend.alert === "GANA" &&
                  " Más del 5 % en un mes: normal si está creciendo o en el último tercio de gestación; si no, ajusta el concentrado."}
              </span>
            </li>
          )}
          {data.weighingDue && (
            <li className="text-muted-foreground">
              {data.daysSinceWeighed == null
                ? "Sin pesajes todavía: con la cinta se tarda un minuto."
                : `Toca pesar: lo ideal es una vez cada ${WEIGH_EVERY_DAYS} días.`}
            </li>
          )}
          {data.dewormerDoseKg != null && (
            <li className="text-muted-foreground">
              Para desparasitar, dosifica para{" "}
              <span className="font-semibold text-foreground">{data.dewormerDoseKg} kg</span>: su peso
              redondeado hacia arriba (quedarse corto crea resistencias).
            </li>
          )}
        </ul>

        {recent.length > 0 && (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[22rem] text-[13px]">
              <caption className="sr-only">Últimos pesajes</caption>
              <thead>
                <tr className="border-b border-border/70 text-left text-[12px] text-muted-foreground">
                  <th scope="col" className="py-1.5 pr-3 font-medium">Fecha</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Peso</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Cómo</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Condición</th>
                  {canManage && (
                    <th scope="col" className="py-1.5 font-medium">
                      <span className="sr-only">Acciones</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {recent.map((m) => (
                  <tr key={m.id} className="border-b border-border/40 last:border-b-0">
                    <td className="py-1.5 pr-3 tabular-nums">{formatDate(m.date)}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{m.weightKg != null ? kg(m.weightKg) : "—"}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">
                      {m.method ? WEIGHT_METHOD_LABELS[m.method] : "—"}
                      {m.method === "MEDIDAS" && m.girthCm && m.lengthCm
                        ? ` (${m.girthCm} × ${m.lengthCm} cm)`
                        : ""}
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {m.bodyCondition != null ? fmtScore(m.bodyCondition) : "—"}
                    </td>
                    {canManage && (
                      <td className="py-1 text-right">
                        <DeleteMeasurementButton id={m.id} label={`pesaje del ${formatDate(m.date)}`} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <details className="rounded-lg border border-border/70 px-3 py-2 text-[12.5px]">
          <summary className="cursor-pointer font-medium text-foreground">Cómo puntuar la condición</summary>
          <ol className="mt-2 space-y-1.5">
            {HENNEKE.map((h) => (
              <li key={h.score}>
                <span className="font-semibold text-foreground">
                  {h.score} · {h.name}.
                </span>{" "}
                <span className="text-muted-foreground">{h.description}</span>
              </li>
            ))}
          </ol>
        </details>
      </div>
    </Card>
  );
}
