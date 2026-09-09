import { HorseStatus, Sex } from "@prisma/client";

/**
 * Definicion unica de la plantilla de importacion de caballos.
 *
 * La usan tanto la ruta que genera el Excel de ejemplo como el parser que lo
 * vuelve a leer, para que las cabeceras y los valores admitidos no se separen.
 */

export type ImportColumnKey =
  | "name"
  | "sex"
  | "status"
  | "breed"
  | "coat"
  | "birthDate"
  | "uelnCode"
  | "microchip"
  | "hierro"
  | "boxLocation";

export interface ImportColumn {
  key: ImportColumnKey;
  /** Cabecera tal cual aparece en la primera fila del Excel. */
  header: string;
  required: boolean;
  kind: "text" | "sex" | "status" | "date";
  /** Texto de la fila de ejemplo. */
  example: string;
  /** Ayuda corta que se vuelca en la hoja de instrucciones. */
  help: string;
  width: number;
}

/** Etiqueta en castellano -> valor del enum. Las claves se normalizan al comparar. */
export const SEX_LABELS: Record<string, Sex> = {
  semental: Sex.MALE,
  macho: Sex.MALE,
  yegua: Sex.FEMALE,
  hembra: Sex.FEMALE,
  castrado: Sex.GELDING,
};

export const STATUS_LABELS: Record<string, HorseStatus> = {
  activo: HorseStatus.ACTIVE,
  "en doma": HorseStatus.IN_TRAINING,
  doma: HorseStatus.IN_TRAINING,
  vendido: HorseStatus.SOLD,
  retirado: HorseStatus.RETIRED,
  fallecido: HorseStatus.DEAD,
  muerto: HorseStatus.DEAD,
};

/** Opciones que se ofrecen como desplegable en el Excel (valores "canonicos"). */
export const SEX_OPTIONS = ["Semental", "Yegua", "Castrado"] as const;
export const STATUS_OPTIONS = [
  "Activo",
  "En doma",
  "Vendido",
  "Retirado",
  "Fallecido",
] as const;

export const IMPORT_COLUMNS: ImportColumn[] = [
  {
    key: "name",
    header: "Nombre",
    required: true,
    kind: "text",
    example: "Espartero III",
    help: "Obligatorio. Nombre del caballo.",
    width: 24,
  },
  {
    key: "sex",
    header: "Sexo",
    required: true,
    kind: "sex",
    example: "Semental",
    help: `Obligatorio. Uno de: ${SEX_OPTIONS.join(", ")}.`,
    width: 14,
  },
  {
    key: "status",
    header: "Estado",
    required: false,
    kind: "status",
    example: "Activo",
    help: `Opcional (por defecto Activo). Uno de: ${STATUS_OPTIONS.join(", ")}.`,
    width: 14,
  },
  {
    key: "breed",
    header: "Raza",
    required: false,
    kind: "text",
    example: "PRE",
    help: "Opcional.",
    width: 14,
  },
  {
    key: "coat",
    header: "Capa",
    required: false,
    kind: "text",
    example: "Tordo",
    help: "Opcional.",
    width: 14,
  },
  {
    key: "birthDate",
    header: "Fecha de nacimiento",
    required: false,
    kind: "date",
    example: "14/03/2019",
    help: "Opcional. Formato dd/mm/aaaa (o una fecha de Excel).",
    width: 18,
  },
  {
    key: "uelnCode",
    header: "UELN / LG PRE",
    required: false,
    kind: "text",
    example: "724001512345678",
    help: "Opcional. Codigo UELN o numero de Libro Genealogico.",
    width: 20,
  },
  {
    key: "microchip",
    header: "Microchip",
    required: false,
    kind: "text",
    example: "724098100123456",
    help: "Opcional. Numero de microchip (15 digitos).",
    width: 20,
  },
  {
    key: "hierro",
    header: "Hierro del criador",
    required: false,
    kind: "text",
    example: "ER",
    help: "Opcional. Hierro o marca de la ganaderia de origen.",
    width: 16,
  },
  {
    key: "boxLocation",
    header: "Box / Ubicacion",
    required: false,
    kind: "text",
    example: "Box 3",
    help: "Opcional. Donde esta alojado el caballo.",
    width: 16,
  },
];

/** Quita acentos, pasa a minusculas y colapsa espacios para comparar etiquetas. */
export function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
