/**
 * Prueba gratuita de Relincho (sustituye al plan gratis para siempre).
 *
 * Diseño, pensado para que quien prueba acabe pagando:
 *
 * 1. Prueba "al revés": se entra en el plan Rendimiento COMPLETO, no en uno
 *    recortado. Al final duele perder las alertas de tendón o el semáforo de
 *    sus propios caballos (aversión a la pérdida), y Rendimiento queda como
 *    ancla al elegir plan.
 * 2. Sin tarjeta: entra más gente; la conversión la hacen el valor que han
 *    metido y el trato personal, no un cobro automático que pilla por sorpresa.
 * 3. 21 días: lo justo para tres microciclos y para que se active el ratio de
 *    carga (pide 21 días de historial), sin que la prueba se olvide.
 * 4. Al terminar NO se borra nada: la yeguada pasa a modo lectura. Ve sus
 *    caballos y su historial y puede descargar el libro de tratamientos (que
 *    la ley le obliga a guardar 5 años), pero no puede apuntar nada nuevo.
 *    Sus datos están ahí, a un clic de seguir: eso convence más que borrar.
 *
 * Las yeguadas dadas de alta antes de la prueba (sin `trialEndsAt`) se
 * respetan: conservan su plan de la beta como hasta ahora.
 *
 * Módulo puro: sin Prisma ni Stripe, se usa en servidor y en navegador.
 */

import { normalizePlanKey, type PlanKey } from "./pricing";

/** Duración de la prueba. Cambiar aquí si se decide otra. */
export const TRIAL_DAYS = 21;

/** Plan que se prueba: el completo de autoservicio, el que queremos vender. */
export const TRIAL_PLAN: PlanKey = "rendimiento";

/** Últimos días: el aviso pasa a ámbar y enseña lo que se ha construido. */
export const TRIAL_WARN_DAYS = 5;

/** Estados de Stripe con los que la yeguada tiene servicio. */
const LIVE_STRIPE_STATUSES = new Set(["active", "trialing", "past_due"]);

export type AccessKind =
  /** Suscripción viva en Stripe (incluye fundadores en su periodo gratis). */
  | "SUBSCRIBED"
  /** Dentro de la prueba gratuita. */
  | "TRIAL"
  /** La prueba acabó sin suscripción: modo lectura. */
  | "TRIAL_ENDED"
  /** Alta anterior a la prueba: conserva su plan de la beta. */
  | "LEGACY";

export interface TenantAccessFields {
  plan: string;
  stripeStatus: string | null;
  trialEndsAt: Date | null;
}

export interface AccessState {
  kind: AccessKind;
  /** Plan con el que funciona la app ahora mismo. */
  effectivePlan: PlanKey;
  /** true = se puede ver todo, pero no apuntar nada nuevo. */
  readOnly: boolean;
  /** Días que quedan de prueba (redondeo hacia arriba); null si no aplica. */
  daysLeft: number | null;
  trialEndsAt: Date | null;
}

const DAY_MS = 24 * 3600 * 1000;

/** Fin de la prueba para una yeguada que se da de alta ahora. */
export function trialEndFrom(start: Date = new Date()): Date {
  return new Date(start.getTime() + TRIAL_DAYS * DAY_MS);
}

export function trialDaysLeft(endsAt: Date, now: Date = new Date()): number {
  const ms = endsAt.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / DAY_MS);
}

export function accessState(
  tenant: TenantAccessFields,
  now: Date = new Date(),
): AccessState {
  const trialEndsAt = tenant.trialEndsAt ?? null;

  if (tenant.stripeStatus && LIVE_STRIPE_STATUSES.has(tenant.stripeStatus)) {
    return {
      kind: "SUBSCRIBED",
      effectivePlan: normalizePlanKey(tenant.plan),
      readOnly: false,
      daysLeft: null,
      trialEndsAt,
    };
  }

  if (trialEndsAt) {
    const daysLeft = trialDaysLeft(trialEndsAt, now);
    if (daysLeft > 0) {
      return { kind: "TRIAL", effectivePlan: TRIAL_PLAN, readOnly: false, daysLeft, trialEndsAt };
    }
    return {
      kind: "TRIAL_ENDED",
      effectivePlan: normalizePlanKey(tenant.plan),
      readOnly: true,
      daysLeft: 0,
      trialEndsAt,
    };
  }

  return {
    kind: "LEGACY",
    effectivePlan: normalizePlanKey(tenant.plan),
    readOnly: false,
    daysLeft: null,
    trialEndsAt: null,
  };
}

/** Mensaje único para cualquier escritura bloqueada al terminar la prueba. */
export const TRIAL_ENDED_MESSAGE =
  "Tu prueba gratuita ha terminado. Tus caballos y registros siguen aquí, en modo lectura: elige un plan en Ajustes para seguir apuntando.";

/** ¿Toca el aviso de últimos días? */
export function isTrialEnding(state: AccessState): boolean {
  return state.kind === "TRIAL" && (state.daysLeft ?? 0) <= TRIAL_WARN_DAYS;
}

/** Lo que la yeguada ha metido en la app: se enseña al final de la prueba. */
export interface TrialValue {
  horses: number;
  healthEvents: number;
  trainingSessions: number;
  limbChecks: number;
}

/** Frase con lo que ha construido, o null si aún no ha metido nada. */
export function describeTrialValue(value: TrialValue): string | null {
  const parts: string[] = [];
  const add = (n: number, one: string, many: string) => {
    if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`);
  };
  add(value.horses, "caballo", "caballos");
  add(value.healthEvents, "registro de sanidad", "registros de sanidad");
  add(value.trainingSessions, "sesión de trabajo", "sesiones de trabajo");
  add(value.limbChecks, "chequeo de patas", "chequeos de patas");
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}
