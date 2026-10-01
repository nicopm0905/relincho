import Link from "next/link";
import { Sun, ThermometerHot, Warning, WarningOctagon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { HEAT_LABELS, heatSummary, type HeatLevel } from "@/lib/heat";
import type { FarmHeat } from "@/server/services/weather";

/** Color + icono + texto, nunca el color solo (igual que el semáforo). */
const HEAT_STYLE: Record<HeatLevel, { box: string; text: string; cell: string }> = {
  NORMAL: {
    box: "border-border bg-card",
    text: "text-foreground",
    cell: "bg-green-500/25 text-green-900 dark:text-green-200",
  },
  VIGILAR: {
    box: "border-yellow-300/70 bg-yellow-50/60 dark:bg-yellow-500/10",
    text: "text-yellow-900 dark:text-yellow-200",
    cell: "bg-yellow-400/45 text-yellow-950 dark:text-yellow-100",
  },
  PRECAUCION: {
    box: "border-amber-300/70 bg-amber-50/60 dark:bg-amber-500/10",
    text: "text-amber-900 dark:text-amber-300",
    cell: "bg-orange-500/55 text-orange-950 dark:text-orange-50",
  },
  PELIGRO: {
    box: "border-red-300/70 bg-red-50/60 dark:bg-red-500/10",
    text: "text-red-800 dark:text-red-300",
    cell: "bg-red-600/80 text-white",
  },
};

function HeatIcon({ level, className }: { level: HeatLevel; className?: string }) {
  const props = { weight: "fill" as const, className, "aria-hidden": true };
  if (level === "PELIGRO") return <WarningOctagon {...props} />;
  if (level === "PRECAUCION") return <Warning {...props} />;
  if (level === "VIGILAR") return <ThermometerHot {...props} />;
  return <Sun {...props} />;
}

const dayName = new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: "UTC" });
const weekday = (date: string) => dayName.format(new Date(`${date}T12:00:00Z`));

const SOURCE_TEXT = {
  COORDENADAS: "coordenadas de la explotación",
  MUNICIPIO: "municipio de la cuenta",
  POR_DEFECTO: "no hay municipio en la cuenta",
} as const;

interface Props {
  heat: FarmHeat | null;
  tenantSlug: string;
  /** En el inicio, un día sin calor ocupa una sola línea. */
  collapseWhenNormal?: boolean;
  className?: string;
}

/**
 * Calor de hoy en la finca, sin que nadie apunte nada: la ubicación sale de la
 * cuenta y la previsión hora a hora de MET Norway (hay que citarla).
 */
export function HeatCard({ heat, tenantSlug, collapseWhenNormal = false, className }: Props) {
  if (!heat) return null;
  const { today, upcoming, location } = heat;
  const day = today.heat;
  const style = HEAT_STYLE[day.level];
  const settingsHref = `/${tenantSlug}/ajustes`;

  const where = (
    <p className="text-[11.5px] text-muted-foreground">
      Tiempo de {location.place} ({SOURCE_TEXT[location.source]}), se actualiza solo. Previsión:{" "}
      <a
        href="https://api.met.no/"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        MET Norway
      </a>{" "}
      (
      <a
        href="https://creativecommons.org/licenses/by/4.0/"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        CC BY 4.0
      </a>
      ).
      {location.source === "POR_DEFECTO" && (
        <>
          {" "}
          Usamos Jerez:{" "}
          <Link href={settingsHref} className="font-medium text-foreground underline underline-offset-2">
            pon el municipio de la finca en Ajustes
          </Link>
          .
        </>
      )}
    </p>
  );

  if (collapseWhenNormal && day.level === "NORMAL") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card px-4 py-2.5",
          className,
        )}
      >
        <Sun weight="fill" className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
        <p className="text-[13px] text-foreground">
          <span className="font-medium">Hoy en {location.place}:</span>{" "}
          {[day.maxTempC != null ? `máx. ${day.maxTempC} °C` : null, "sin restricciones por calor"]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    );
  }

  return (
    <section
      aria-label="Calor del día"
      className={cn("min-w-0 rounded-2xl border p-4 sm:p-5", style.box, className)}
    >
      <div className="flex items-start gap-3">
        <HeatIcon level={day.level} className={cn("mt-0.5 h-7 w-7 shrink-0", style.text)} />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-medium text-muted-foreground">
            Calor hoy en {location.place} · {HEAT_LABELS[day.level]}
          </p>
          <p className={cn("text-lg leading-snug font-semibold", style.text)}>{day.headline}</p>
          <p className="mt-0.5 text-[12.5px] text-foreground/80">
            {[
              day.maxTempC != null ? `Máx. ${day.maxTempC} °C` : null,
              day.minTempC != null ? `mín. ${day.minTempC} °C` : null,
              day.peak
                ? `lo más duro a las ${String(day.peak.hour).padStart(2, "0")}:00 (${Math.round(day.peak.tempC)} °C, ${Math.round(day.peak.rh)} % de humedad)`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      {day.hours.length > 0 && (
        <div className="mt-4">
          <p className="sr-only">Nivel de calor por horas</p>
          <ol className="grid grid-cols-7 gap-1 sm:grid-cols-14" aria-label="Horas de trabajo">
            {day.hours.map((h) => (
              <li
                key={h.hour}
                className={cn(
                  "flex flex-col items-center rounded-md px-0.5 py-1 text-center",
                  HEAT_STYLE[h.level].cell,
                )}
                title={`${h.hour}:00 · ${Math.round(h.tempC)} °C · ${Math.round(h.rh)} % · ${HEAT_LABELS[h.level]}`}
              >
                <span className="text-[11px] leading-none font-semibold tabular-nums">{h.hour}h</span>
                <span className="mt-0.5 text-[10.5px] leading-none tabular-nums">{Math.round(h.tempC)}°</span>
                <span className="sr-only">{HEAT_LABELS[h.level]}</span>
              </li>
            ))}
          </ol>
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-hidden>
            {(["NORMAL", "VIGILAR", "PRECAUCION", "PELIGRO"] as HeatLevel[]).map((lvl) => (
              <span key={lvl} className="inline-flex items-center gap-1">
                <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", HEAT_STYLE[lvl].cell)} />
                {lvl === "NORMAL" ? "Sin riesgo" : HEAT_LABELS[lvl]}
              </span>
            ))}
          </p>
        </div>
      )}

      {/* Lo básico a la vista; el resto, a un toque, para no llenar el móvil. */}
      {day.tips.length > 0 && (
        <ul className="mt-3 space-y-1 pl-5 text-[13px] text-foreground">
          {day.tips.slice(0, 2).map((tip) => (
            <li key={tip} className="list-disc">
              {tip}
            </li>
          ))}
        </ul>
      )}
      {day.tips.length > 2 && (
        <details className="mt-1.5 text-[13px]">
          <summary className="cursor-pointer font-medium text-foreground">
            {day.tips.length - 2} consejos más para hoy
          </summary>
          <ul className="mt-1 space-y-1 pl-5 text-foreground">
            {day.tips.slice(2).map((tip) => (
              <li key={tip} className="list-disc">
                {tip}
              </li>
            ))}
          </ul>
        </details>
      )}

      {upcoming.length > 0 && (
        <dl className="mt-3 grid gap-1 border-t border-border/60 pt-3 text-[12.5px] sm:grid-cols-2">
          {upcoming.map((d, i) => (
            <div key={d.date} className="flex flex-wrap gap-x-1.5">
              <dt className="font-medium text-foreground capitalize">
                {i === 0 ? "Mañana" : weekday(d.date)}:
              </dt>
              <dd className="text-muted-foreground">
                {heatSummary(d.heat)}
                {d.heat.level !== "NORMAL" && ` · ${d.heat.headline}`}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-3">{where}</div>
    </section>
  );
}
