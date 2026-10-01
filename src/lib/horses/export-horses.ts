import type { Sex, HorseStatus } from "@prisma/client";

export interface HorseExportRow {
  name: string;
  sex: Sex;
  status: HorseStatus;
  breed: string | null;
  coat: string | null;
  birthDate: Date | null;
  uelnCode: string | null;
  lgNumber: string | null;
  microchip: string | null;
  hierro: string | null;
  boxLocation: string | null;
  sire: { name: string } | null;
  dam: { name: string } | null;
  owner: { name: string } | null;
}

const HEADERS = [
  "Nombre",
  "Sexo",
  "Estado",
  "Raza",
  "Capa",
  "Fecha de nacimiento",
  "UELN",
  "Nº Libro Genealógico PRE",
  "Microchip",
  "Hierro del criador",
  "Box / Ubicación",
  "Padre",
  "Madre",
  "Propietario",
] as const;

const SEX_LABELS: Record<Sex, string> = {
  MALE: "Semental",
  FEMALE: "Yegua",
  GELDING: "Castrado",
};

const STATUS_LABELS: Record<HorseStatus, string> = {
  ACTIVE: "Activo",
  IN_TRAINING: "En doma",
  SOLD: "Vendido",
  RETIRED: "Retirado",
  DEAD: "Fallecido",
};

function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * CSV con separador y fecha compatibles con Excel en español. Los IDs son
 * texto (no se pierden ceros) y los campos que pudieran ser fórmulas se escapan.
 */
export function buildHorsesCsv(horses: HorseExportRow[]): string {
  const rows = [HEADERS.map(csvCell).join(";")];

  for (const horse of horses) {
    const birthDate = horse.birthDate
      ? horse.birthDate.toISOString().slice(0, 10)
      : "";

    rows.push(
      [
        horse.name,
        SEX_LABELS[horse.sex],
        STATUS_LABELS[horse.status],
        horse.breed,
        horse.coat,
        birthDate,
        horse.uelnCode,
        horse.lgNumber,
        horse.microchip,
        horse.hierro,
        horse.boxLocation,
        horse.sire?.name,
        horse.dam?.name,
        horse.owner?.name,
      ]
        .map(csvCell)
        .join(";"),
    );
  }

  return `\uFEFF${rows.join("\r\n")}\r\n`;
}
