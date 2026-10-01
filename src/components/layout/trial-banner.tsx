import Link from "next/link";
import { Hourglass, LockSimple } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/formatters";
import {
  TRIAL_DAYS,
  describeTrialValue,
  isTrialEnding,
  type AccessState,
  type TrialValue,
} from "@/lib/trial";

interface Props {
  tenantSlug: string;
  state: AccessState;
  /** Lo construido en la prueba; solo se pide en los últimos días y al acabar. */
  value?: TrialValue | null;
  /** Hay plazas de fundador libres: se ofrece al decidir. */
  founderOpen?: boolean;
}

/**
 * Aviso de la prueba gratuita dentro del panel.
 *
 * - Durante la prueba: discreto, con los días que quedan y una barra que se
 *   va llenando (sin agobiar: el valor lo tiene que ver solo).
 * - Últimos días: ámbar y con lo que ya ha metido en la app. Perder algo
 *   propio pesa más que no ganar algo nuevo.
 * - Terminada: modo lectura, sin borrar nada, y un botón para seguir.
 */
export function TrialBanner({ tenantSlug, state, value, founderOpen }: Props) {
  if (state.kind !== "TRIAL" && state.kind !== "TRIAL_ENDED") return null;

  const ended = state.kind === "TRIAL_ENDED";
  const ending = isTrialEnding(state);
  const daysLeft = state.daysLeft ?? 0;
  const progress = Math.min(100, Math.max(0, ((TRIAL_DAYS - daysLeft) / TRIAL_DAYS) * 100));
  const built = value ? describeTrialValue(value) : null;
  const plansHref = `/${tenantSlug}/ajustes#plan`;

  return (
    <div
      role={ended || ending ? "alert" : "status"}
      className={cn(
        "mb-6 rounded-xl border px-4 py-3",
        ended
          ? "border-red-300/70 bg-red-50/60 dark:bg-red-500/10"
          : ending
            ? "border-amber-300/70 bg-amber-50/60 dark:bg-amber-500/10"
            : "border-primary/30 bg-primary/5",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {ended ? (
            <LockSimple weight="fill" className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
          ) : (
            <Hourglass
              weight="fill"
              className={cn("mt-0.5 h-4 w-4 shrink-0", ending ? "text-amber-700" : "text-primary-ink")}
            />
          )}
          <div className="min-w-0 text-[13px] leading-relaxed text-foreground">
            {ended ? (
              <p>
                <span className="font-semibold">Tu prueba gratuita ha terminado.</span>{" "}
                No se ha borrado nada: puedes ver tus caballos y descargar el libro de
                tratamientos, pero para seguir apuntando hay que elegir plan.
              </p>
            ) : (
              <p>
                <span className="font-semibold">
                  Prueba de Rendimiento: {daysLeft === 1 ? "queda 1 día" : `quedan ${daysLeft} días`}
                </span>
                {state.trialEndsAt && (
                  <span className="text-muted-foreground">
                    {" "}
                    (hasta el {formatDate(state.trialEndsAt)})
                  </span>
                )}
                {ending
                  ? ". Elige plan para no perder las alertas y el semáforo de tus caballos."
                  : ". Tienes todo el plan completo, sin tarjeta."}
              </p>
            )}
            {(ended || ending) && built && (
              <p className="mt-0.5 text-muted-foreground">
                Ya tienes en Relincho {built}.
              </p>
            )}
            {(ended || ending) && founderOpen && (
              <p className="mt-0.5 font-medium text-primary-ink">
                Aún quedan plazas de fundador: −40 % de por vida.
              </p>
            )}
          </div>
        </div>
        <Button asChild size="sm" variant={ended || ending ? "default" : "outline"} className="shrink-0">
          <Link href={plansHref}>{ended ? "Elegir plan y seguir" : "Ver planes"}</Link>
        </Button>
      </div>
      {!ended && (
        <div
          className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Días de prueba usados"
          aria-valuemin={0}
          aria-valuemax={TRIAL_DAYS}
          aria-valuenow={TRIAL_DAYS - daysLeft}
        >
          <div
            className={cn("h-full rounded-full", ending ? "bg-amber-500" : "bg-primary")}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
