/**
 * Libro de registro de tratamientos veterinarios (RD 666/2023, art. 41).
 *
 * Los équidos cuentan como animales de producción para la normativa de
 * medicamentos. La explotación tiene que poder enseñar en una inspección, y
 * durante 5 años, qué se le ha puesto a cada caballo. Por cada tratamiento se
 * anota:
 *
 *  - fecha de la primera administración       → `date`
 *  - denominación del medicamento             → `name`
 *  - cantidad administrada                    → `dose`
 *  - proveedor y prueba de la compra          → `supplier`, `purchaseReference`
 *  - identificación del animal                → UELN o microchip del caballo
 *  - veterinario prescriptor, en su caso      → `vetContactId`
 *  - tiempo de espera, aunque sea cero        → `withdrawalDays`
 *  - duración del tratamiento                 → `durationDays`
 *
 * Si todo eso ya figura en la copia de la receta, basta con anotar la fecha de
 * la primera administración y el número de receta (y guardar la copia).
 *
 * Este módulo es puro: sin Prisma ni React, para usarlo en pantallas, PDF y
 * pruebas por igual.
 */

export const MEDICINAL_TYPES = ["VACCINE", "DEWORMING", "TREATMENT"] as const;
export type MedicinalType = (typeof MEDICINAL_TYPES)[number];

/** Años que hay que conservar el libro para inspección. */
export const RETENTION_YEARS = 5;


export function isMedicinal(type: string): type is MedicinalType {
  return (MEDICINAL_TYPES as readonly string[]).includes(type);
}

export interface TreatmentRecord {
  type: string;
  date: Date;
  name: string;
  dose?: string | null;
  prescriptionNumber?: string | null;
  withdrawalDays?: number | null;
  durationDays?: number | null;
  supplier?: string | null;
  purchaseReference?: string | null;
}

export interface HorseIdentity {
  uelnCode?: string | null;
  microchip?: string | null;
  excludedFromFoodChain?: boolean | null;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Con `setDate` y no sumando milisegundos: el cambio de hora no descuadra el día. */
function addDays(date: Date, days: number): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Último día de administración. Un tratamiento de 5 días que empieza el día 1
 * termina el día 5. Sin duración, se toma una sola administración.
 */
export function lastAdministrationDate(record: Pick<TreatmentRecord, "date" | "durationDays">): Date {
  const days = Math.max(1, Math.floor(record.durationDays ?? 1));
  return addDays(record.date, days - 1);
}

/**
 * Primer día en que el caballo vuelve a estar libre de tiempo de espera:
 * fecha de la última administración + días de espera. Con 0 días, libre ese
 * mismo día. `null` si el tiempo de espera no se ha anotado.
 */
export function withdrawalEndDate(
  record: Pick<TreatmentRecord, "date" | "durationDays" | "withdrawalDays">,
): Date | null {
  if (record.withdrawalDays === null || record.withdrawalDays === undefined) return null;
  const days = Math.max(0, Math.floor(record.withdrawalDays));
  return addDays(lastAdministrationDate(record), days);
}

export type WithdrawalStatus =
  /** El caballo está excluido de la cadena alimentaria: no aplica. */
  | "not_applicable"
  /** No es un medicamento (herrador, dental...). */
  | "not_medicinal"
  /** Medicamento sin tiempo de espera anotado. */
  | "unknown"
  /** Todavía en tiempo de espera. */
  | "active"
  | "finished";

export function withdrawalStatus(
  record: TreatmentRecord,
  horse: HorseIdentity,
  now: Date = new Date(),
): { status: WithdrawalStatus; until: Date | null } {
  if (!isMedicinal(record.type)) return { status: "not_medicinal", until: null };
  if (horse.excludedFromFoodChain) return { status: "not_applicable", until: null };
  const until = withdrawalEndDate(record);
  if (!until) return { status: "unknown", until: null };
  return { status: now.getTime() < until.getTime() ? "active" : "finished", until };
}

export type BookField =
  | "horseIdentity"
  | "dose"
  | "withdrawalDays"
  | "durationDays"
  | "supplier"
  | "purchaseReference";

export const BOOK_FIELD_LABELS: Record<BookField, string> = {
  horseIdentity: "UELN o microchip del caballo",
  dose: "cantidad administrada",
  withdrawalDays: "tiempo de espera",
  durationDays: "duración",
  supplier: "proveedor",
  purchaseReference: "prueba de compra",
};

const filled = (value: string | null | undefined) => Boolean(value && value.trim());

/**
 * Qué le falta a un tratamiento para estar completo en el libro. Vacío si está
 * completo o no es un medicamento. Con nº de receta, lo demás consta en la
 * receta y solo se exige identificar al caballo.
 */
export function missingBookFields(record: TreatmentRecord, horse: HorseIdentity): BookField[] {
  if (!isMedicinal(record.type)) return [];
  const missing: BookField[] = [];
  if (!filled(horse.uelnCode) && !filled(horse.microchip)) missing.push("horseIdentity");
  if (filled(record.prescriptionNumber)) return missing;

  if (!filled(record.dose)) missing.push("dose");
  if (record.withdrawalDays === null || record.withdrawalDays === undefined) {
    missing.push("withdrawalDays");
  }
  if (!record.durationDays) missing.push("durationDays");
  if (!filled(record.supplier)) missing.push("supplier");
  if (!filled(record.purchaseReference)) missing.push("purchaseReference");
  return missing;
}

/** Texto corto para un aviso: "falta tiempo de espera y proveedor". */
export function describeMissing(fields: BookField[]): string {
  const labels = fields.map((f) => BOOK_FIELD_LABELS[f]);
  if (labels.length === 0) return "";
  if (labels.length === 1) return `Falta ${labels[0]}`;
  return `Falta ${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}

/** Fecha desde la que el libro tiene que seguir disponible. */
export function retentionStart(now: Date = new Date()): Date {
  const d = startOfDay(now);
  d.setFullYear(d.getFullYear() - RETENTION_YEARS);
  return d;
}

export interface BookPeriod {
  /** Valor para la URL: "2026" o "5a" (los 5 años que exige la ley). */
  key: string;
  label: string;
  from: Date;
  to: Date;
}

/**
 * Periodo del libro a partir del parámetro de la URL. Por defecto, el año en
 * curso. Solo se aceptan los años dentro del plazo de conservación: pedir uno
 * más antiguo o un valor raro vuelve al año en curso.
 */
export function bookPeriod(param: string | null | undefined, now: Date = new Date()): BookPeriod {
  const year = now.getFullYear();
  if (param === "5a") {
    const to = new Date(year, 11, 31, 23, 59, 59, 999);
    return { key: "5a", label: `Últimos ${RETENTION_YEARS} años`, from: retentionStart(now), to };
  }
  const asked = Number(param);
  const chosen =
    Number.isInteger(asked) && asked <= year && asked >= year - (RETENTION_YEARS - 1) ? asked : year;
  return {
    key: String(chosen),
    label: `Año ${chosen}`,
    from: new Date(chosen, 0, 1),
    to: new Date(chosen, 11, 31, 23, 59, 59, 999),
  };
}

/** Opciones del selector: los años que hay que conservar y "5 años". */
export function bookPeriodOptions(now: Date = new Date()): { key: string; label: string }[] {
  const year = now.getFullYear();
  const years = Array.from({ length: RETENTION_YEARS }, (_, i) => String(year - i));
  return [
    ...years.map((y) => ({ key: y, label: y })),
    { key: "5a", label: `${RETENTION_YEARS} años` },
  ];
}
