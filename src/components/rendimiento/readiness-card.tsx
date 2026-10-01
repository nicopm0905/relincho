import dynamic from "next/dynamic";
import {
  CheckCircle,
  HandPalm,
  Warning,
  WarningOctagon,
} from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { READINESS_STYLE } from "./readiness-style";
import {
  LEGS,
  LEG_LABELS,
  WORKLOAD,
  WORKLOAD_ZONE_LABELS,
  dayKey,
  type LimbCheckData,
  type ReadinessLevel,
  type ReadinessResult,
  type WorkloadSummary,
  type WorkloadZone,
} from "@/lib/readiness";

const LimbCheckDialog = dynamic(
  () => import("./limb-check-dialog").then((m) => m.LimbCheckDialog),
  { loading: () => <div className="h-10 w-36 animate-pulse rounded-xl bg-muted/40" aria-busy="true" /> },
);
const RestTodayButton = dynamic(
  () => import("./rest-today-button").then((m) => m.RestTodayButton),
  { loading: () => <div className="h-9 w-64 animate-pulse rounded-xl bg-muted/40" aria-busy="true" /> },
);

function ReadinessIcon({ level, className }: { level: ReadinessLevel; className?: string }) {
  const props = { weight: "fill" as const, className, "aria-hidden": true };
  if (level === "VERDE") return <CheckCircle {...props} />;
  if (level === "AMBAR") return <Warning {...props} />;
  if (level === "ROJO") return <WarningOctagon {...props} />;
  return <HandPalm {...props} />;
}

const ZONE_BADGE: Record<WorkloadZone, "success" | "warning" | "destructive" | "secondary" | "info"> = {
  CALIBRANDO: "secondary",
  BAJA: "info",
  OPTIMA: "success",
  SUBIENDO: "warning",
  PICO: "destructive",
};

const shortDay = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  timeZone: "UTC",
});
const longDay = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

interface Props {
  horseId: string;
  horseName: string;
  data: {
    today: (LimbCheckData & { notes?: string | null }) | null;
    history: (LimbCheckData & { notes?: string | null })[];
    workload: WorkloadSummary;
    readiness: ReadinessResult;
  };
  /** Hay sesión de trabajo prevista hoy en el plan (para ofrecer el descanso). */
  plannedWorkToday: boolean;
  /** Días del mapa de patas. */
  historyDays?: number;
}

export function ReadinessCard({
  horseId,
  horseName,
  data,
  plannedWorkToday,
  historyDays = 14,
}: Props) {
  const { readiness, workload, today } = data;
  const style = READINESS_STYLE[readiness.level];

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Aptitud de hoy</CardTitle>
        <LimbCheckDialog
          horseId={horseId}
          horseName={horseName}
          initial={today}
          triggerVariant={today ? "outline" : "default"}
          triggerSize="sm"
        />
      </CardHeader>
      <CardContent className="min-w-0 space-y-6">
        <div className="grid min-w-0 gap-4 lg:grid-cols-[3fr_2fr]">
          {/* Semáforo */}
          <div className={cn("min-w-0 rounded-xl border px-4 py-4", style.box)}>
            <div className="flex items-center gap-3">
              <ReadinessIcon level={readiness.level} className={cn("h-7 w-7 shrink-0", style.text)} />
              <div>
                <p className={cn("text-lg leading-tight font-semibold", style.text)}>
                  {readiness.label}
                </p>
                <p className="text-[13px] text-foreground/80">{readiness.advice}</p>
              </div>
            </div>
            {readiness.reasons.length > 0 && (
              <ul className="mt-3 space-y-1 pl-10 text-[13px] text-foreground">
                {readiness.reasons.map((reason) => (
                  <li key={reason} className="list-disc">
                    {reason}
                  </li>
                ))}
              </ul>
            )}
            {readiness.notes.length > 0 && (
              <p className="mt-2 pl-10 text-[12.5px] text-muted-foreground">
                {readiness.notes.join(" ")}
              </p>
            )}
            {today?.notes && (
              <p className="mt-2 pl-10 text-[12.5px] text-muted-foreground italic">
                “{today.notes}”
              </p>
            )}
            {readiness.level === "ROJO" && plannedWorkToday && (
              <div className="mt-3 pl-10">
                <RestTodayButton
                  horseId={horseId}
                  reason={`Semáforo en rojo: ${readiness.reasons.join(" ")}`}
                />
              </div>
            )}
            <p className="mt-3 pl-10 text-[11.5px] text-muted-foreground">
              Orientación para el equipo, no un diagnóstico. Ante la duda, veterinario.
            </p>
          </div>

          {/* Carga aguda / crónica */}
          <WorkloadPanel workload={workload} />
        </div>

        <LimbMap history={data.history} days={historyDays} />
      </CardContent>
    </Card>
  );
}

function WorkloadPanel({ workload }: { workload: WorkloadSummary }) {
  const peak = Math.max(1, ...workload.daily.map((d) => d.loadUa));
  const firstAcute = workload.daily.length - WORKLOAD.acuteDays;
  const ratioText =
    workload.ratio != null
      ? workload.ratio.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "—";

  return (
    <div className="min-w-0 rounded-xl border border-border px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12.5px] font-medium text-muted-foreground">
            Carga de esta semana frente a su media
          </p>
          <p className="mt-1 text-[26px] leading-none font-semibold tabular-nums text-foreground">
            {ratioText}
          </p>
        </div>
        <Badge variant={ZONE_BADGE[workload.zone]}>{WORKLOAD_ZONE_LABELS[workload.zone]}</Badge>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
        <div>
          <dt className="text-muted-foreground">Últimos 7 días</dt>
          <dd className="font-semibold tabular-nums text-foreground">{workload.acuteUa} UA</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Media semanal (28 días)</dt>
          <dd className="font-semibold tabular-nums text-foreground">
            {workload.chronicWeeklyUa} UA
          </dd>
        </div>
      </dl>

      {/* 28 barras de carga diaria; la última semana, en color. */}
      <div
        className="mt-4 flex h-16 items-end gap-[2px]"
        role="img"
        aria-label={`Carga diaria de los últimos 28 días. Últimos 7 días: ${workload.acuteUa} UA.`}
      >
        {workload.daily.map((day, index) => {
          const height = day.loadUa > 0 ? Math.max(6, (day.loadUa / peak) * 100) : 0;
          const acute = index >= firstAcute;
          return (
            <div
              key={day.date.toISOString()}
              className="group relative flex h-full flex-1 items-end"
              title={`${longDay.format(day.date)}: ${day.loadUa} UA`}
            >
              {day.loadUa > 0 ? (
                <div
                  className={cn(
                    "w-full rounded-t-[3px]",
                    acute ? "bg-primary" : "bg-primary/30",
                  )}
                  style={{ height: `${height}%` }}
                />
              ) : (
                <div className="h-[2px] w-full rounded-full bg-border" />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>hace 4 semanas</span>
        <span>hoy</span>
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
        {workload.zone === "CALIBRANDO"
          ? `Hacen falta ${WORKLOAD.minHistoryDays} días de sesiones para comparar (lleva ${workload.historyDays}).`
          : "Entre 0,8 y 1,3 la carga progresa sin sobresaltos. Por encima de 1,5 hay un pico: en deportistas es cuando más lesiones aparecen. En caballos es una referencia, no una regla."}
      </p>
    </div>
  );
}

type CellState = "none" | "ok" | "warn" | "bad";

/** En el móvil caben 7 días; el resto se ve en pantallas anchas. */
const MOBILE_DAYS = 7;

const CELL_STYLE: Record<CellState, string> = {
  none: "border border-dashed border-border bg-transparent",
  ok: "bg-green-600/80",
  warn: "bg-amber-500",
  bad: "bg-red-600",
};

const CELL_LABEL: Record<CellState, string> = {
  none: "sin chequeo",
  ok: "normal",
  warn: "calor o hinchazón",
  bad: "dolor o calor e hinchazón",
};

function legState(check: LimbCheckData | undefined, leg: string): CellState {
  if (!check) return "none";
  const heat = check.heatLegs.includes(leg);
  const swelling = check.swellingLegs.includes(leg);
  if (check.painLegs.includes(leg) || (heat && swelling)) return "bad";
  if (heat || swelling) return "warn";
  return "ok";
}

function trotState(check: LimbCheckData | undefined): CellState {
  if (!check) return "none";
  if (check.lameness === "SI") return "bad";
  if (check.lameness === "DUDOSA") return "warn";
  return "ok";
}

/**
 * Mapa de las cuatro patas en los últimos días. Es lo que el veterinario
 * quiere ver: si el calor de la mano izquierda es de hoy o viene de atrás.
 */
function LimbMap({
  history,
  days,
}: {
  history: LimbCheckData[];
  days: number;
}) {
  const now = new Date();
  const end = dayKey(now);
  const columns = Array.from({ length: days }, (_, i) => {
    const key = end - (days - 1 - i) * 24 * 3600 * 1000;
    return { key, date: new Date(key), check: history.find((c) => dayKey(c.date) === key) };
  });
  const checkedDays = columns.filter((c) => c.check).length;

  const rows: { label: string; state: (c: LimbCheckData | undefined) => CellState }[] = [
    ...LEGS.map((leg) => ({ label: LEG_LABELS[leg], state: (c: LimbCheckData | undefined) => legState(c, leg) })),
    { label: "Al trote", state: trotState },
  ];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold text-foreground">
          Patas, últimos <span className="sm:hidden">{MOBILE_DAYS}</span>
          <span className="hidden sm:inline">{days}</span> días
        </p>
        <p className="text-[12px] text-muted-foreground">
          {checkedDays} de {days} días chequeados
        </p>
      </div>
      <div className="min-w-0">
        <table className="w-full table-fixed border-separate border-spacing-[3px] text-[11.5px]">
          <thead>
            <tr>
              <th className="w-24 sm:w-28" />
              {columns.map((col, index) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "overflow-hidden font-normal whitespace-nowrap text-muted-foreground",
                    index < days - MOBILE_DAYS && "hidden sm:table-cell",
                  )}
                >
                  <span className="sm:hidden">{col.date.getUTCDate()}</span>
                  <span className="hidden sm:inline">
                    {shortDay.format(col.date).replace(".", "")}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="pr-2 text-left font-medium whitespace-nowrap text-foreground">
                  {row.label}
                </th>
                {columns.map((col, index) => {
                  const state = row.state(col.check);
                  const label = `${row.label}, ${longDay.format(col.date)}: ${CELL_LABEL[state]}`;
                  return (
                    <td
                      key={col.key}
                      className={cn("p-0", index < days - MOBILE_DAYS && "hidden sm:table-cell")}
                      title={label}
                    >
                      <span className="sr-only">{label}</span>
                      <span
                        aria-hidden
                        className={cn("block h-5 w-full rounded-[4px]", CELL_STYLE[state])}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
        {(["ok", "warn", "bad", "none"] as const).map((state) => (
          <span key={state} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn("inline-block h-3 w-3 rounded-[3px]", CELL_STYLE[state])} />
            {CELL_LABEL[state].charAt(0).toUpperCase() + CELL_LABEL[state].slice(1)}
          </span>
        ))}
      </div>
    </div>
  );
}
