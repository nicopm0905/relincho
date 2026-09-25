/**
 * Única fuente de verdad de los precios de Relincho.
 *
 * Todo lo que enseña un precio (web, /precios, ajustes) o lo cobra (Stripe)
 * sale de aquí. Este módulo es puro: no importa Stripe ni Prisma, así que se
 * puede usar en el navegador y se prueba sin configuración.
 *
 * Origen de las cifras: "Arquitectura de precios propuesta" (19 sep 2026) del
 * proyecto, que sustituye al 0 / 79 / "a medida" anterior.
 *
 * Reglas estructurales (no cambiar sin hablarlo):
 *  1. Se cobra por cuadra y por caballo, NUNCA por usuario: el mayoral tiene
 *     que tener cuenta o nadie apunta y el producto se queda sin dato.
 *  2. Nunca se bloquea el alta de un caballo por pasarse del límite: se avisa
 *     al 80 % y se ofrece un bloque extra.
 *  3. Los precios de lista son SIN IVA (el cliente es profesional).
 */

export type PlanKey = "cuaderno" | "cuadra" | "rendimiento" | "yeguada";
export type BillingInterval = "month" | "year";

/** Plan gratuito al que vuelve una yeguada que cancela. */
export const FREE_PLAN: PlanKey = "cuaderno";

export const PLAN_ORDER: readonly PlanKey[] = [
  "cuaderno",
  "cuadra",
  "rendimiento",
  "yeguada",
];

/** Anual = pagas 10 meses y usas 12 ("paga 10, usa 12"). */
export const ANNUAL_MONTHS_CHARGED = 10;

/** Los precios de lista no incluyen IVA. */
export const VAT_RATE = 0.21;
export const PRICES_INCLUDE_VAT = false;
export const CURRENCY = "EUR";

export interface PlanDefinition {
  key: PlanKey;
  /** Precio de lista mensual en € (sin IVA). 0 = gratuito. */
  monthly: number;
  /** Caballos incluidos. null = sin límite. */
  maxHorses: number | null;
  /** Usuarios incluidos. null = sin límite. */
  maxUsers: number | null;
  /** true si el precio es "desde" (Yeguada crece con el tamaño). */
  startsAt: boolean;
  /** El que se destaca en la web. */
  highlighted: boolean;
  /** Se contrata solo con tarjeta/SEPA desde la app. */
  selfServe: boolean;
  /** Pupilaje y Facturación Veri*Factu incluidos sin módulo aparte. */
  includesBilling: boolean;
}

export const PLAN_DEFINITIONS: Record<PlanKey, PlanDefinition> = {
  cuaderno: {
    key: "cuaderno",
    monthly: 0,
    maxHorses: 5,
    maxUsers: 1,
    startsAt: false,
    highlighted: false,
    selfServe: false,
    includesBilling: false,
  },
  cuadra: {
    key: "cuadra",
    monthly: 69,
    maxHorses: 20,
    maxUsers: 3,
    startsAt: false,
    highlighted: false,
    selfServe: true,
    includesBilling: false,
  },
  rendimiento: {
    key: "rendimiento",
    monthly: 149,
    maxHorses: 50,
    maxUsers: 10,
    startsAt: false,
    highlighted: true,
    selfServe: true,
    includesBilling: false,
  },
  yeguada: {
    key: "yeguada",
    monthly: 349,
    maxHorses: null,
    maxUsers: null,
    startsAt: true,
    highlighted: false,
    selfServe: true,
    includesBilling: true,
  },
};

/** Precio anual de un plan: 10 mensualidades. */
export function annualPrice(monthly: number): number {
  return monthly * ANNUAL_MONTHS_CHARGED;
}

/** Equivalente mensual de pagar en anual, redondeado a céntimos. */
export function annualMonthlyEquivalent(monthly: number): number {
  return Math.round((annualPrice(monthly) / 12) * 100) / 100;
}

/** Precio de un plan para un intervalo (lo que se cobra en cada ciclo). */
export function planPrice(key: PlanKey, interval: BillingInterval): number {
  const { monthly } = PLAN_DEFINITIONS[key];
  return interval === "year" ? annualPrice(monthly) : monthly;
}

/**
 * Coste por caballo y mes con el plan lleno: es el ancla de venta
 * (Cuadra = 3,45 €/caballo/mes ≈ 1 % de lo que cuesta mantener ese caballo).
 * null cuando no hay límite que dividir o el plan es gratuito.
 */
export function pricePerHorseMonth(key: PlanKey): number | null {
  const { monthly, maxHorses } = PLAN_DEFINITIONS[key];
  if (!maxHorses || monthly === 0) return null;
  return Math.round((monthly / maxHorses) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Precio de fundador
// ---------------------------------------------------------------------------

export const FOUNDER = {
  /** Descuento de por vida mientras no se cancele; sobrevive a subidas de lista. */
  discount: 0.4,
  /** Plazas totales del programa. */
  slots: 30,
  /** Gratis hasta esta fecha (primer cobro el 1 ene 2027, con aviso 30 días antes). */
  freeUntil: "2027-01-01T00:00:00+01:00",
  /** Días de aviso antes del primer cobro. */
  noticeDays: 30,
} as const;

/** Precio mensual de fundador: 41 / 89 / 209 €. Redondeo al euro más cercano. */
export function founderMonthly(key: PlanKey): number {
  const { monthly } = PLAN_DEFINITIONS[key];
  return Math.round(monthly * (1 - FOUNDER.discount));
}

/** Anual de fundador: 10 mensualidades de fundador. */
export function founderPrice(key: PlanKey, interval: BillingInterval): number {
  const monthly = founderMonthly(key);
  return interval === "year" ? annualPrice(monthly) : monthly;
}

/** ¿Sigue abierta la oferta de fundador? Depende de la fecha y de las plazas. */
export function isFounderOfferOpen(taken: number, now: Date = new Date()): boolean {
  return taken < FOUNDER.slots && now.getTime() < new Date(FOUNDER.freeUntil).getTime();
}

// ---------------------------------------------------------------------------
// Módulos y extras
// ---------------------------------------------------------------------------

export const ADDONS = {
  /** Pupilaje + Facturación Veri*Factu. Incluido en Yeguada. */
  billing: {
    monthly: 39,
    includedIn: ["yeguada"] as PlanKey[],
    availableOn: ["cuadra", "rendimiento"] as PlanKey[],
  },
  /** Bloque de caballos por encima del límite del plan. */
  extraHorses: {
    monthly: 25,
    blockSize: 10,
    availableOn: ["cuadra", "rendimiento"] as PlanKey[],
    /** Se avisa al llegar a este porcentaje del límite. Nunca se bloquea el alta. */
    warnAtRatio: 0.8,
  },
  /** Migración "Trae tu Excel": pago único. Gratis en anual y en Yeguada. */
  migration: {
    oneTime: 149,
    freeOnAnnual: true,
    freeOn: ["yeguada"] as PlanKey[],
  },
  /** Carteles QR impresos por caballo, a precio de coste. */
  qrPrint: {
    perHorse: 3,
  },
} as const;

/** Precio del módulo de facturación para un intervalo. */
export function billingAddonPrice(interval: BillingInterval): number {
  return interval === "year"
    ? annualPrice(ADDONS.billing.monthly)
    : ADDONS.billing.monthly;
}

/** Precio de los bloques extra de caballos para un intervalo. */
export function extraHorsesPrice(blocks: number, interval: BillingInterval): number {
  const monthly = ADDONS.extraHorses.monthly * Math.max(0, Math.floor(blocks));
  return interval === "year" ? annualPrice(monthly) : monthly;
}

/** ¿La migración va gratis con este plan/intervalo? */
export function isMigrationFree(key: PlanKey, interval: BillingInterval): boolean {
  return (
    (interval === "year" && ADDONS.migration.freeOnAnnual) ||
    (ADDONS.migration.freeOn as readonly PlanKey[]).includes(key)
  );
}

/** Coste de imprimir carteles QR para n caballos. */
export function qrPrintPrice(horses: number): number {
  return ADDONS.qrPrint.perHorse * Math.max(0, Math.floor(horses));
}

/** ¿Hay que enseñar el aviso de "casi lleno"? */
export function isNearHorseLimit(horses: number, limit: number | null): boolean {
  if (limit === null || limit <= 0) return false;
  return horses >= Math.floor(limit * ADDONS.extraHorses.warnAtRatio);
}

// ---------------------------------------------------------------------------
// Qué incluye cada plan (matriz de funciones)
// ---------------------------------------------------------------------------

export type FeatureKey =
  | "fichas"
  | "documentos"
  | "sanidad"
  | "tareas"
  | "importExcel"
  | "reproduccion"
  | "voz"
  | "nutricion"
  | "movimientos"
  | "qr"
  | "fichaVenta"
  | "periodizacion"
  | "cargaInterna"
  | "alertasTendon"
  | "racionDinamica"
  | "informeSemanal"
  | "panelVeterinario"
  | "nfc"
  | "roles"
  | "pupilajeFacturacion"
  | "multiFinca"
  | "comparativas"
  | "vetExterno"
  | "onboarding"
  | "soportePrioritario"
  | "soporteTelefono";

const CUADERNO: FeatureKey[] = [
  "fichas",
  "documentos",
  "sanidad",
  "tareas",
  "importExcel",
];
const CUADRA: FeatureKey[] = [
  ...CUADERNO,
  "reproduccion",
  "voz",
  "nutricion",
  "movimientos",
  "qr",
  "fichaVenta",
];
const RENDIMIENTO: FeatureKey[] = [
  ...CUADRA,
  "periodizacion",
  "cargaInterna",
  "alertasTendon",
  "racionDinamica",
  "informeSemanal",
  "panelVeterinario",
  "nfc",
  "roles",
  "soportePrioritario",
];
const YEGUADA: FeatureKey[] = [
  ...RENDIMIENTO,
  "pupilajeFacturacion",
  "multiFinca",
  "comparativas",
  "vetExterno",
  "onboarding",
  "soporteTelefono",
];

export const PLAN_FEATURES: Record<PlanKey, readonly FeatureKey[]> = {
  cuaderno: CUADERNO,
  cuadra: CUADRA,
  rendimiento: RENDIMIENTO,
  yeguada: YEGUADA,
};

/**
 * Funciones del plan que todavía no están en la app. La web las enseña con la
 * etiqueta "Próximamente": vender algo que no existe es la forma más rápida de
 * perder la confianza de una yeguada. Se quitan de aquí el día que se publican.
 */
export const COMING_SOON: ReadonlySet<FeatureKey> = new Set<FeatureKey>([
  "voz",
  "multiFinca",
  "comparativas",
]);

export function isComingSoon(feature: FeatureKey): boolean {
  return COMING_SOON.has(feature);
}

/** Funciones que SOLO aporta cada plan respecto al anterior (para la web). */
export function newFeaturesOf(key: PlanKey): FeatureKey[] {
  const idx = PLAN_ORDER.indexOf(key);
  if (idx <= 0) return [...PLAN_FEATURES[key]];
  const previous = new Set(PLAN_FEATURES[PLAN_ORDER[idx - 1]]);
  return PLAN_FEATURES[key].filter((f) => !previous.has(f));
}

// ---------------------------------------------------------------------------
// Planes heredados de la beta
// ---------------------------------------------------------------------------

/**
 * Las yeguadas de la beta se respetan: quien entró con "gratis hasta 15
 * caballos" conserva su límite mientras no cambie de plan. Estos valores
 * viven en base de datos (`Tenant.plan`) y no se pueden renombrar.
 */
export const LEGACY_PLANS: Record<
  string,
  { label: string; maps: PlanKey; maxHorses: number | null }
> = {
  starter: { label: "Cuaderno (beta)", maps: "cuaderno", maxHorses: 15 },
  pro: { label: "Rendimiento (beta)", maps: "rendimiento", maxHorses: 60 },
  enterprise: { label: "Yeguada (beta)", maps: "yeguada", maxHorses: null },
};

export function isPlanKey(value: string): value is PlanKey {
  return (PLAN_ORDER as readonly string[]).includes(value);
}

/** Lleva cualquier valor guardado (nuevo o heredado) a un plan actual. */
export function normalizePlanKey(value: string | null | undefined): PlanKey {
  if (!value) return FREE_PLAN;
  if (isPlanKey(value)) return value;
  return LEGACY_PLANS[value]?.maps ?? FREE_PLAN;
}

/** Límite de caballos: null = sin límite. Respeta el límite de la beta. */
export function horseLimitFor(
  value: string | null | undefined,
  extraBlocks = 0,
): number | null {
  const base =
    value && LEGACY_PLANS[value]
      ? LEGACY_PLANS[value].maxHorses
      : PLAN_DEFINITIONS[normalizePlanKey(value)].maxHorses;
  if (base === null) return null;
  return base + Math.max(0, Math.floor(extraBlocks)) * ADDONS.extraHorses.blockSize;
}

/**
 * Formatea euros sin decimales inútiles: 69 → "69 €", 3,45 → "3,45 €".
 * El espacio es de no separación: el símbolo nunca baja solo a otra línea.
 */
export function formatEuro(amount: number, locale = "es-ES"): string {
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)}\u00A0€`;
}
