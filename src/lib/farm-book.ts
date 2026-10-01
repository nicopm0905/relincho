/**
 * Libro de registro de la explotación equina.
 *
 * Normativa que se sigue (y que el código cita donde aplica):
 * - Real Decreto 804/2011, art. 6 y anexo IV: contenido mínimo del libro,
 *   electrónico admitido, actualizado "rápidamente" y accesible durante al
 *   menos 3 años desde la última anotación.
 * - Orden de 29 de abril de 2015 (Junta de Andalucía), art. 6, 11 y 12 y su
 *   anexo IV: modelo andaluz del libro (hojas de actualización de animales,
 *   incidencias en la identificación, censo, inspecciones), códigos oficiales,
 *   baja por muerte en 7 días hábiles y censo a 31 de diciembre antes del 1 de
 *   marzo.
 * - Real Decreto 676/2016, art. 9.1 y 24.4: identificar al potro antes de que
 *   cumpla un año (y antes de salir de la explotación) y comunicar la muerte al
 *   organismo emisor del documento de identificación en 15 días.
 * - Real Decreto 577/2014: salidas temporales de menos de 30 días con tarjeta
 *   de movimiento equina, anotadas en el libro.
 *
 * Módulo puro (sin Prisma): se usa en la pantalla, en el PDF y en los tests.
 */

// ---------------------------------------------------------------------------
// Códigos oficiales (anexo IV de la Orden andaluza de 29/04/2015)
// ---------------------------------------------------------------------------

export type EquineSpecies = "CABALLAR" | "ASNAL" | "MULAR" | "BURDEGANO";
export const SPECIES_CODES: Record<EquineSpecies, string> = {
  CABALLAR: "C",
  ASNAL: "A",
  MULAR: "M",
  BURDEGANO: "B",
};
export const SPECIES_LABELS: Record<EquineSpecies, string> = {
  CABALLAR: "Caballar",
  ASNAL: "Asnal",
  MULAR: "Mular",
  BURDEGANO: "Burdégano",
};

export type HorseSex = "MALE" | "FEMALE" | "GELDING";
export const SEX_CODES: Record<HorseSex, string> = { FEMALE: "H", MALE: "M", GELDING: "MC" };
export const SEX_LABELS: Record<HorseSex, string> = {
  FEMALE: "Hembra",
  MALE: "Macho",
  GELDING: "Macho castrado",
};

export const BREED_CODES = {
  PRE: "Pura Raza Española",
  PSI: "Pura Sangre Inglés",
  "Á": "Pura Raza Árabe",
  "A.a": "Angloárabe",
  AHa: "Anglohispanoárabe",
  Ha: "Hispanoárabe",
  A: "Andaluz",
  Z: "Zamorano",
  C: "Catalán",
  X: "Otras",
} as const;
export type BreedCode = keyof typeof BREED_CODES;

function plain(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Lleva la raza escrita a mano en la ficha al código oficial del libro. */
export function breedCode(breed: string | null | undefined): BreedCode {
  if (!breed) return "X";
  const b = ` ${plain(breed)} `;
  if (/ pre | p r e | pura raza espanol/.test(b)) return "PRE";
  if (/ psi | pura sangre ingl| purasangre ingl| thoroughbred /.test(b)) return "PSI";
  if (/anglo ?hispano ?arabe| aha /.test(b)) return "AHa";
  if (/anglo ?arabe| aa /.test(b)) return "A.a";
  if (/hispano ?arabe| ha /.test(b)) return "Ha";
  if (/ arabe |pura raza arabe|pura sangre arabe|purasangre arabe| pra /.test(b)) return "Á";
  if (/ andaluz/.test(b)) return "A";
  if (/zamoran/.test(b)) return "Z";
  if (/catalan/.test(b)) return "C";
  return "X";
}

// ---------------------------------------------------------------------------
// Causas de alta y baja
// ---------------------------------------------------------------------------

export type MovementCause =
  | "APERTURA"
  | "NACIMIENTO"
  | "COMPRA"
  | "RETORNO"
  | "TRASLADO_PROVISIONAL"
  | "VENTA"
  | "SACRIFICIO"
  | "MUERTE";

export type Direction = "IN" | "OUT";

export const ENTRY_CAUSES: readonly MovementCause[] = ["COMPRA", "NACIMIENTO", "RETORNO", "APERTURA"];
export const EXIT_CAUSES: readonly MovementCause[] = [
  "VENTA",
  "TRASLADO_PROVISIONAL",
  "MUERTE",
  "SACRIFICIO",
];

/** Códigos del anexo IV. El retorno de un traslado provisional se anota TP. */
export const CAUSE_CODES: Record<MovementCause, string> = {
  APERTURA: "A",
  NACIMIENTO: "N",
  COMPRA: "C",
  RETORNO: "TP",
  TRASLADO_PROVISIONAL: "TP",
  VENTA: "V",
  SACRIFICIO: "S",
  MUERTE: "M",
};

export const CAUSE_LABELS: Record<MovementCause, string> = {
  APERTURA: "Apertura del libro",
  NACIMIENTO: "Nacimiento",
  COMPRA: "Compra / entrada",
  RETORNO: "Retorno de traslado provisional",
  TRASLADO_PROVISIONAL: "Traslado provisional",
  VENTA: "Venta en vida",
  SACRIFICIO: "Sacrificio",
  MUERTE: "Muerte",
};

export function causeDirection(cause: MovementCause): Direction {
  return (ENTRY_CAUSES as readonly string[]).includes(cause) ? "IN" : "OUT";
}

/**
 * Causa de un movimiento. Los anotados antes de este libro no la tienen: se
 * deduce del motivo escrito y se marca como deducida para pedir que se revise.
 */
export function resolveCause(m: {
  direction: string;
  cause?: MovementCause | null;
  reason?: string | null;
}): { cause: MovementCause; inferred: boolean } {
  if (m.cause) return { cause: m.cause, inferred: false };
  const r = plain(m.reason ?? "");
  if (m.direction === "IN") {
    if (/nacim/.test(r)) return { cause: "NACIMIENTO", inferred: true };
    if (/retorno|vuelta|regres/.test(r)) return { cause: "RETORNO", inferred: true };
    return { cause: "COMPRA", inferred: true };
  }
  if (/muerte|fallec|muri/.test(r)) return { cause: "MUERTE", inferred: true };
  if (/sacrific|matadero/.test(r)) return { cause: "SACRIFICIO", inferred: true };
  if (/venta|vendid/.test(r)) return { cause: "VENTA", inferred: true };
  return { cause: "TRASLADO_PROVISIONAL", inferred: true };
}

// ---------------------------------------------------------------------------
// Documentación del traslado
// ---------------------------------------------------------------------------

export const DOCUMENT_TYPES = {
  GUIA: "Guía de origen y sanidad pecuaria",
  CERTIFICADO_SANITARIO: "Certificado sanitario de traslado",
  DOCUMENTO_MOVIMIENTO: "Documento de movimiento de équidos (RD 728/2007)",
  TME: "Tarjeta de movimiento equina (TME) + DIE",
  DIE: "Documento de identificación equina (DIE)",
  OTRO: "Otro documento",
} as const;
export type DocumentType = keyof typeof DOCUMENT_TYPES;

export const DISPOSAL_METHODS = {
  RECOGIDA: "Recogida por gestor de subproductos (SANDACH)",
  ENTERRAMIENTO: "Enterramiento autorizado",
  OTRO: "Otro",
} as const;
export type DisposalMethod = keyof typeof DISPOSAL_METHODS;

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 3600 * 1000;

/** Día natural en UTC (misma convención que el resto de la app). */
export function dayKey(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Suma días hábiles (lunes a viernes). No descuenta festivos. */
export function addBusinessDays(date: Date, days: number): Date {
  let d = new Date(dayKey(date));
  let left = days;
  while (left > 0) {
    d = addDays(d, 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

export function addYears(date: Date, years: number): Date {
  const d = new Date(date.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}

export function ageInYears(birth: Date, at: Date): number {
  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  const m = at.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

// ---------------------------------------------------------------------------
// Animales presentes, balance y censo
// ---------------------------------------------------------------------------

export interface BookMovement {
  id: string;
  horseId: string;
  direction: Direction;
  date: Date;
  cause: MovementCause;
  /** Para ordenar dos movimientos del mismo día. */
  createdAt?: Date;
}

export interface BookHorse {
  id: string;
  sex: HorseSex;
  birthDate: Date | null;
}

export function sortMovements<T extends BookMovement>(movements: T[]): T[] {
  return [...movements].sort((a, b) => {
    const d = dayKey(a.date) - dayKey(b.date);
    if (d !== 0) return d;
    const t = a.date.getTime() - b.date.getTime();
    if (t !== 0) return t;
    return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
  });
}

/** Caballos presentes al final del día `date`, según el libro. */
export function presentAt(movements: BookMovement[], date: Date): Set<string> {
  const limit = dayKey(date);
  const state = new Map<string, boolean>();
  for (const m of sortMovements(movements)) {
    if (dayKey(m.date) > limit) break;
    state.set(m.horseId, m.direction === "IN");
  }
  return new Set([...state].filter(([, present]) => present).map(([id]) => id));
}

export interface Balance {
  females: number;
  males: number;
  total: number;
}

function balanceOf(ids: Iterable<string>, horses: Map<string, BookHorse>): Balance {
  let females = 0;
  let males = 0;
  for (const id of ids) {
    const h = horses.get(id);
    if (!h) continue;
    if (h.sex === "FEMALE") females++;
    else males++;
  }
  return { females, males, total: females + males };
}

/** Hoja de actualización: cada movimiento con el balance (hembras/machos) que deja. */
export function withRunningBalance<T extends BookMovement>(
  movements: T[],
  horses: BookHorse[],
): (T & { balance: Balance })[] {
  const byId = new Map(horses.map((h) => [h.id, h]));
  const present = new Set<string>();
  return sortMovements(movements).map((m) => {
    if (m.direction === "IN") present.add(m.horseId);
    else present.delete(m.horseId);
    return { ...m, balance: balanceOf(present, byId) };
  });
}

export type CensusCategory =
  | "MACHO_REPRODUCTOR"
  | "HEMBRA_REPRODUCTORA"
  | "ENGORDE"
  | "REPOSICION"
  | "OTROS";

export const CENSUS_LABELS: Record<CensusCategory, string> = {
  MACHO_REPRODUCTOR: "Macho reproductor",
  HEMBRA_REPRODUCTORA: "Hembra reproductora",
  ENGORDE: "Engorde",
  REPOSICION: "Reposición",
  OTROS: "Otros",
};

/** Edad desde la que se cuenta como reproductor (antes, reposición). */
export const BREEDING_AGE_YEARS = 3;

/**
 * Categoría del censo. Criterio aplicado (revisable por el titular): enteros
 * de 3 años o más = reproductores; menores de 3 = reposición; castrados y
 * animales sin fecha de nacimiento = otros. Engorde solo en explotaciones de
 * cebo, que Relincho no contempla.
 */
export function censusCategory(horse: BookHorse, at: Date): CensusCategory {
  if (horse.sex === "GELDING" || !horse.birthDate) return "OTROS";
  if (ageInYears(horse.birthDate, at) < BREEDING_AGE_YEARS) return "REPOSICION";
  return horse.sex === "MALE" ? "MACHO_REPRODUCTOR" : "HEMBRA_REPRODUCTORA";
}

export interface Census {
  date: Date;
  total: number;
  balance: Balance;
  byCategory: Record<CensusCategory, number>;
}

export function censusAt(
  movements: BookMovement[],
  horses: BookHorse[],
  date: Date,
): Census {
  const byId = new Map(horses.map((h) => [h.id, h]));
  const present = presentAt(movements, date);
  const byCategory: Record<CensusCategory, number> = {
    MACHO_REPRODUCTOR: 0,
    HEMBRA_REPRODUCTORA: 0,
    ENGORDE: 0,
    REPOSICION: 0,
    OTROS: 0,
  };
  for (const id of present) {
    const h = byId.get(id);
    if (h) byCategory[censusCategory(h, date)]++;
  }
  const balance = balanceOf(present, byId);
  return { date, total: balance.total, balance, byCategory };
}

/** Censo medio de un año: media de animales presentes cada día. */
export function averageCensus(movements: BookMovement[], year: number): number {
  const sorted = sortMovements(movements);
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year, 11, 31);
  const state = new Map<string, boolean>();
  let i = 0;
  let sum = 0;
  let days = 0;
  for (let d = start; d <= end; d += DAY_MS) {
    while (i < sorted.length && dayKey(sorted[i].date) <= d) {
      state.set(sorted[i].horseId, sorted[i].direction === "IN");
      i++;
    }
    let count = 0;
    for (const present of state.values()) if (present) count++;
    sum += count;
    days++;
  }
  return Math.round((sum / days) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Comunidad autónoma
// ---------------------------------------------------------------------------

const ANDALUSIAN_PROVINCES = [
  "almeria",
  "cadiz",
  "cordoba",
  "granada",
  "huelva",
  "jaen",
  "malaga",
  "sevilla",
];

/**
 * ¿La explotación está en Andalucía? Por la provincia o, si no está, por el
 * REGA (ES + 2 dígitos de provincia: 04, 11, 14, 18, 21, 23, 29, 41).
 */
export function isAndalusia(province?: string | null, rega?: string | null): boolean {
  if (province && ANDALUSIAN_PROVINCES.includes(plain(province))) return true;
  const code = rega?.replace(/[\s.-]/g, "").toUpperCase().match(/^ES(\d{2})/)?.[1];
  return code ? ["04", "11", "14", "18", "21", "23", "29", "41"].includes(code) : false;
}

// ---------------------------------------------------------------------------
// Datos que faltan en un movimiento
// ---------------------------------------------------------------------------

export interface MovementDetail {
  direction: Direction;
  cause: MovementCause;
  originRega?: string | null;
  destinationRega?: string | null;
  documentNumber?: string | null;
  transporterName?: string | null;
  vehiclePlate?: string | null;
  disposalMethod?: string | null;
  disposalPlace?: string | null;
  notifiedAt?: Date | null;
}

const filled = (v: string | null | undefined) => Boolean(v && v.trim());

/** Lo que pide el anexo IV para cada tipo de anotación y aún no está. */
export function missingMovementFields(m: MovementDetail): string[] {
  const missing: string[] = [];
  if (m.direction === "IN" && (m.cause === "COMPRA" || m.cause === "RETORNO")) {
    if (!filled(m.originRega)) missing.push("REGA de procedencia");
    if (!filled(m.documentNumber)) missing.push("nº de guía o documento");
    if (!filled(m.transporterName)) missing.push("transportista");
    if (!filled(m.vehiclePlate)) missing.push("matrícula del vehículo");
  }
  if (m.direction === "OUT" && m.cause !== "MUERTE") {
    if (!filled(m.destinationRega)) missing.push("REGA de destino");
    if (!filled(m.documentNumber)) missing.push("nº de guía o documento");
  }
  if (m.cause === "MUERTE") {
    if (!filled(m.disposalMethod)) missing.push("destino del cadáver");
    if (m.disposalMethod === "ENTERRAMIENTO" && !filled(m.disposalPlace)) {
      missing.push("lugar de enterramiento");
    }
    if (!m.notifiedAt) missing.push("fecha de comunicación de la baja");
  }
  return missing;
}

// ---------------------------------------------------------------------------
// Avisos de cumplimiento
// ---------------------------------------------------------------------------

export type AlertLevel = "critical" | "warning" | "info";

export interface ComplianceAlert {
  key: string;
  level: AlertLevel;
  title: string;
  detail: string;
  /** Fecha límite, si la hay. */
  dueDate?: Date;
  horseId?: string;
  movementId?: string;
  /** Norma que lo pide. */
  rule: string;
}

export interface FarmIdentity {
  regaCode?: string | null;
  holderName?: string | null;
  nif?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
}

export interface AlertHorse extends BookHorse {
  name: string;
  status: string;
  uelnCode?: string | null;
  microchip?: string | null;
}

export interface AlertMovement extends BookMovement, MovementDetail {
  inferred?: boolean;
  expectedReturnDate?: Date | null;
}

/** Tiempo máximo de una salida temporal sin guía (TME + DIE, RD 577/2014). */
export const TEMPORARY_EXIT_DAYS = 30;
/** Días hábiles para comunicar una muerte a la OCA (Orden andaluza, art. 6.3). */
export const DEATH_NOTICE_BUSINESS_DAYS = 7;
/** Días para comunicar la muerte al emisor del DIE (RD 676/2016, art. 24.4). */
export const DEATH_DIE_DAYS = 15;
/** Años de conservación (RD 804/2011, art. 6.2). */
export const RETENTION_YEARS = 3;

const fmt = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;

export function complianceAlerts(input: {
  farm: FarmIdentity;
  horses: AlertHorse[];
  movements: AlertMovement[];
  now?: Date;
}): ComplianceAlert[] {
  const now = input.now ?? new Date();
  const today = dayKey(now);
  const andalusia = isAndalusia(input.farm.province, input.farm.regaCode);
  const alerts: ComplianceAlert[] = [];
  const horseName = new Map(input.horses.map((h) => [h.id, h.name]));

  // 1. Datos de la explotación (anexo IV a-c).
  const farmMissing: string[] = [];
  if (!input.farm.regaCode || !/^ES\d{12}$/.test(input.farm.regaCode.replace(/[\s.-]/g, "").toUpperCase())) {
    farmMissing.push("código REGA válido");
  }
  if (!filled(input.farm.holderName)) farmMissing.push("titular");
  if (!filled(input.farm.nif)) farmMissing.push("NIF del titular");
  if (!filled(input.farm.address) || !filled(input.farm.city)) farmMissing.push("dirección");
  if (farmMissing.length) {
    alerts.push({
      key: "farm-data",
      level: "warning",
      title: "Faltan datos de la explotación",
      detail: `Completa: ${farmMissing.join(", ")}.`,
      rule: "RD 804/2011, anexo IV a-c",
    });
  }

  // 2. Caballos en la cuadra que no están en el libro.
  const inBook = new Set(input.movements.map((m) => m.horseId));
  const present = presentAt(input.movements, now);
  const notInBook = input.horses.filter(
    (h) => !inBook.has(h.id) && h.status !== "SOLD" && h.status !== "DEAD",
  );
  if (notInBook.length) {
    alerts.push({
      key: "not-in-book",
      level: "critical",
      title:
        notInBook.length === 1
          ? `${notInBook[0].name} no está dado de alta en el libro`
          : `${notInBook.length} caballos no están dados de alta en el libro`,
      detail:
        "Todo animal presente debe figurar en el libro. Si empiezas ahora, usa \"Abrir el libro\" y quedan anotados con causa A (apertura).",
      rule: "RD 804/2011, anexo IV d",
    });
  }

  // 3. Identificación: antes del año de vida y antes de salir (RD 676/2016).
  for (const h of input.horses) {
    if (!present.has(h.id) && inBook.has(h.id)) continue;
    if (h.status === "SOLD" || h.status === "DEAD") continue;
    if (filled(h.uelnCode) || filled(h.microchip)) continue;
    const due = h.birthDate ? addYears(h.birthDate, 1) : undefined;
    const overdue = due ? dayKey(due) < today : true;
    alerts.push({
      key: `ident-${h.id}`,
      level: overdue ? "critical" : due && dayKey(due) - today <= 60 * DAY_MS ? "warning" : "info",
      title: `${h.name} sin identificar (microchip y DIE)`,
      detail: due
        ? overdue
          ? `Tenía que estar identificado antes del ${fmt(due)}. Y no puede salir de la explotación sin identificar.`
          : `Identifícalo antes del ${fmt(due)} (un año de vida) y siempre antes de que salga de la explotación.`
        : "Sin fecha de nacimiento ni identificación: añade el microchip y el UELN del DIE en su ficha.",
      dueDate: due,
      horseId: h.id,
      rule: "RD 676/2016, art. 9.1",
    });
  }

  // 4. Movimientos: datos que faltan, causa deducida, muertes y retornos.
  const sorted = sortMovements(input.movements);
  for (const m of sorted) {
    const name = horseName.get(m.horseId) ?? "Caballo";
    const missing = missingMovementFields(m);
    if (m.inferred) {
      alerts.push({
        key: `cause-${m.id}`,
        level: "info",
        title: `Revisa la causa del movimiento de ${name} (${fmt(m.date)})`,
        detail: `Se anotó antes del libro completo y se ha supuesto "${CAUSE_LABELS[m.cause]}".`,
        movementId: m.id,
        horseId: m.horseId,
        rule: "Orden 29/04/2015 (Andalucía), anexo IV",
      });
    }
    if (m.cause === "MUERTE" && !m.notifiedAt) {
      const oca = addBusinessDays(m.date, DEATH_NOTICE_BUSINESS_DAYS);
      const die = addDays(new Date(dayKey(m.date)), DEATH_DIE_DAYS);
      const due = andalusia ? oca : die;
      alerts.push({
        key: `death-${m.id}`,
        level: dayKey(due) < today ? "critical" : "warning",
        title: `Comunica la baja por muerte de ${name}`,
        detail: andalusia
          ? `A la Oficina Comarcal Agraria con el DIE antes del ${fmt(oca)} (7 días hábiles) y al emisor del DIE antes del ${fmt(die)}. Anota la fecha de comunicación en el movimiento.`
          : `Al organismo emisor del DIE antes del ${fmt(die)}. Anota la fecha de comunicación en el movimiento.`,
        dueDate: due,
        movementId: m.id,
        horseId: m.horseId,
        rule: andalusia ? "Orden 29/04/2015, art. 6.3 · RD 676/2016, art. 24.4" : "RD 676/2016, art. 24.4",
      });
    }
    const otherMissing = missing.filter((f) => f !== "fecha de comunicación de la baja");
    if (otherMissing.length) {
      alerts.push({
        key: `missing-${m.id}`,
        level: "warning",
        title: `Faltan datos en ${CAUSE_LABELS[m.cause].toLowerCase()} de ${name} (${fmt(m.date)})`,
        detail: `Añade: ${otherMissing.join(", ")}.`,
        movementId: m.id,
        horseId: m.horseId,
        rule: "RD 804/2011, anexo IV i-j",
      });
    }
  }

  // Traslados provisionales sin retorno.
  const lastByHorse = new Map<string, AlertMovement>();
  for (const m of sorted) lastByHorse.set(m.horseId, m);
  for (const m of lastByHorse.values()) {
    if (m.cause !== "TRASLADO_PROVISIONAL") continue;
    const limit = addDays(new Date(dayKey(m.date)), TEMPORARY_EXIT_DAYS);
    const expected = m.expectedReturnDate ?? limit;
    const name = horseName.get(m.horseId) ?? "Caballo";
    if (dayKey(expected) < today) {
      alerts.push({
        key: `return-${m.id}`,
        level: dayKey(limit) < today ? "critical" : "warning",
        title: `${name} sigue fuera desde el ${fmt(m.date)}`,
        detail:
          dayKey(limit) < today
            ? `Han pasado más de ${TEMPORARY_EXIT_DAYS} días: la tarjeta de movimiento equina ya no cubre la salida. Anota el retorno o regulariza con guía (o como venta).`
            : "Pasó la fecha de vuelta prevista: anota el retorno cuando llegue.",
        dueDate: limit,
        movementId: m.id,
        horseId: m.horseId,
        rule: "RD 577/2014 · Orden 29/04/2015, art. 7",
      });
    }
  }

  // 5. Censo a 31 de diciembre, antes del 1 de marzo (Andalucía).
  if (andalusia) {
    const year = now.getUTCFullYear();
    const deadline = Date.UTC(year, 2, 1);
    if (today < deadline) {
      alerts.push({
        key: `census-${year - 1}`,
        level: deadline - today <= 21 * DAY_MS ? "warning" : "info",
        title: `Declara el censo a 31/12/${year - 1} antes del 1 de marzo`,
        detail:
          "En la Oficina Comarcal Agraria o por SIGGAN. Tienes el dato calculado en la pestaña Censo y en el PDF.",
        dueDate: new Date(deadline),
        rule: "Orden 29/04/2015, art. 11.5",
      });
    }
  }

  const order: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort(
    (a, b) =>
      order[a.level] - order[b.level] ||
      (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity),
  );
}

/** Periodo por defecto del PDF: los 3 años que hay que conservar. */
export function defaultBookPeriod(now: Date = new Date()): { from: Date; to: Date } {
  const to = new Date(dayKey(now));
  const from = addYears(to, -RETENTION_YEARS);
  return { from, to };
}

export { fmt as formatBookDate };
