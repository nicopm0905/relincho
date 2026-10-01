import { HorseStatus, Sex } from "@prisma/client";

/**
 * Definición compartida de la plantilla descargable y el lector de Excel.
 * Los alias ayudan a adaptar hojas existentes sin exigir rehacerlas.
 */
export type ImportColumnKey =
  | "name"
  | "sex"
  | "status"
  | "breed"
  | "coat"
  | "birthDate"
  | "uelnCode"
  | "lgNumber"
  | "microchip"
  | "hierro"
  | "boxLocation";

export interface ImportColumn {
  key: ImportColumnKey;
  /** Cabecera que usa la plantilla descargable. */
  header: string;
  /** Nombres habituales en hojas existentes (normalizados al comparar). */
  aliases?: string[];
  required: boolean;
  kind: "text" | "sex" | "status" | "date";
  /** Texto de la fila de ejemplo. */
  example: string;
  /** Ayuda corta que se vuelca en la hoja de instrucciones. */
  help: string;
  width: number;
}

/** Etiqueta en castellano o inglés -> valor del enum. */
export const SEX_LABELS: Record<string, Sex> = {
  semental: Sex.MALE,
  macho: Sex.MALE,
  entero: Sex.MALE,
  stallion: Sex.MALE,
  male: Sex.MALE,
  m: Sex.MALE,
  "caballo entero": Sex.MALE,
  "male horse": Sex.MALE,
  yegua: Sex.FEMALE,
  hembra: Sex.FEMALE,
  mare: Sex.FEMALE,
  female: Sex.FEMALE,
  potra: Sex.FEMALE,
  "female horse": Sex.FEMALE,
  h: Sex.FEMALE,
  f: Sex.FEMALE,
  castrado: Sex.GELDING,
  castrada: Sex.GELDING,
  gelding: Sex.GELDING,
  "castrado male": Sex.GELDING,
  g: Sex.GELDING,
};

export const STATUS_LABELS: Record<string, HorseStatus> = {
  activo: HorseStatus.ACTIVE,
  active: HorseStatus.ACTIVE,
  "en doma": HorseStatus.IN_TRAINING,
  doma: HorseStatus.IN_TRAINING,
  "in training": HorseStatus.IN_TRAINING,
  vendido: HorseStatus.SOLD,
  sold: HorseStatus.SOLD,
  retirado: HorseStatus.RETIRED,
  retired: HorseStatus.RETIRED,
  fallecido: HorseStatus.DEAD,
  muerto: HorseStatus.DEAD,
  deceased: HorseStatus.DEAD,
};

/** Opciones que se ofrecen como desplegable en el Excel (valores canónicos). */
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
    aliases: [
      "Nombre del caballo",
      "Nombre caballo",
      "Nombre del ejemplar",
      "Nombre ejemplar",
      "Ejemplar",
      "Caballo",
      "Name",
      "Horse name",
    ],
    required: true,
    kind: "text",
    example: "Espartero III",
    help: "Obligatorio. Nombre del caballo.",
    width: 24,
  },
  {
    key: "sex",
    header: "Sexo",
    aliases: ["Género", "Sexo del animal", "Sex", "Gender"],
    required: true,
    kind: "sex",
    example: "Semental",
    help: `Obligatorio. Uno de: ${SEX_OPTIONS.join(", ")}.`,
    width: 14,
  },
  {
    key: "status",
    header: "Estado",
    aliases: ["Situación", "Estado actual", "Situación administrativa", "Status", "Estado del animal"],
    required: false,
    kind: "status",
    example: "Activo",
    help: `Opcional (por defecto Activo). Uno de: ${STATUS_OPTIONS.join(", ")}.`,
    width: 14,
  },
  {
    key: "breed",
    header: "Raza",
    aliases: ["Breed"],
    required: false,
    kind: "text",
    example: "PRE",
    help: "Opcional.",
    width: 14,
  },
  {
    key: "coat",
    header: "Capa",
    aliases: ["Color", "Capa / color", "Pelaje", "Coat"],
    required: false,
    kind: "text",
    example: "Tordo",
    help: "Opcional.",
    width: 14,
  },
  {
    key: "birthDate",
    header: "Fecha de nacimiento",
    aliases: [
      "Fecha nacimiento",
      "Fecha nac.",
      "F. nacimiento",
      "F. nac.",
      "Nacimiento",
      "Birth date",
      "Date of birth",
      "Foaling date",
    ],
    required: false,
    kind: "date",
    example: "14/03/2019",
    help: "Opcional. Formato dd/mm/aaaa (o una fecha de Excel).",
    width: 18,
  },
  {
    key: "uelnCode",
    header: "UELN",
    aliases: ["Código UELN", "Codigo UELN", "Ueln code", "UELN code"],
    required: false,
    kind: "text",
    example: "724001512345678",
    help: "Opcional. UELN (identificador equino universal).",
    width: 20,
  },
  {
    key: "lgNumber",
    header: "Nº Libro Genealógico PRE",
    aliases: [
      "Libro Genealógico",
      "Libro Genealogico",
      "Nº LG",
      "Nº LG PRE",
      "LG PRE",
      "Número LG",
      "Numero LG",
      "Nº Registro PRE",
      "Nº de registro PRE",
      "Nº de libro genealógico",
      "Nº del libro genealógico",
      "PRE number",
    ],
    required: false,
    kind: "text",
    example: "PRE-123456",
    help: "Opcional. Inscripción en el Libro Genealógico PRE (no es el UELN).",
    width: 24,
  },
  {
    key: "microchip",
    header: "Microchip",
    aliases: [
      "Nº microchip",
      "Nº de microchip",
      "Numero de microchip",
      "Identificación electrónica",
      "Identificacion electronica",
      "Nº de identificación electrónica",
      "Número de microchip / transpondedor",
      "Nº transpondedor",
      "Transponder number",
      "Chip",
      "Transponder",
    ],
    required: false,
    kind: "text",
    example: "724098100123456",
    help: "Opcional. Número de microchip (15 dígitos).",
    width: 20,
  },
  {
    key: "hierro",
    header: "Hierro del criador",
    aliases: ["Hierro", "Hierro de la yeguada", "Hierro del ganadero", "Marca", "Breeder brand"],
    required: false,
    kind: "text",
    example: "ER",
    help: "Opcional. Hierro o marca de la ganadería de origen.",
    width: 16,
  },
  {
    key: "boxLocation",
    header: "Box / Ubicación",
    aliases: [
      "Box",
      "Box actual",
      "Ubicación actual",
      "Ubicacion actual",
      "Localización",
      "Localizacion",
      "Alojamiento",
      "Cuadra",
      "Box location",
    ],
    required: false,
    kind: "text",
    example: "Box 3",
    help: "Opcional. Dónde está alojado el caballo.",
    width: 16,
  },
];

/** Normaliza tildes, puntuación, ordinales y espacios para comparar etiquetas. */
export function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[º°]/g, "o")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
