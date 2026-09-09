import "server-only";
import ExcelJS from "exceljs";
import { HorseStatus, Sex } from "@prisma/client";
import {
  IMPORT_COLUMNS,
  type ImportColumnKey,
  normalizeLabel,
  SEX_LABELS,
  STATUS_LABELS,
} from "./import-columns";

export interface ParsedHorse {
  name: string;
  sex: Sex;
  status: HorseStatus;
  breed?: string;
  coat?: string;
  birthDate?: Date;
  uelnCode?: string;
  microchip?: string;
  hierro?: string;
  boxLocation?: string;
}

export interface RowError {
  /** Numero de fila tal cual lo ve el usuario en Excel (la cabecera es la 1). */
  row: number;
  messages: string[];
}

export interface ParseResult {
  valid: ParsedHorse[];
  errors: RowError[];
  /** Filas con datos que se han mirado (sin contar cabecera ni filas vacias). */
  totalRows: number;
}

/** Se lanza cuando el fichero no tiene la forma de la plantilla. */
export class ImportFormatError extends Error {}

const MAX_ROWS = 1000;

/** Texto plano de una celda, sea cual sea la forma interna que use ExcelJS. */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value).trim();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("formula" in value) return "";
  }
  return String(value).trim();
}

function parseDate(value: ExcelJS.CellValue): Date | null {
  if (value instanceof Date) return value;
  const text = cellText(value);
  if (!text) return null;

  // dd/mm/aaaa o dd-mm-aaaa
  const dmy = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const date = new Date(Date.UTC(year, Number(m) - 1, Number(d)));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // aaaa-mm-dd
  const ymd = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/**
 * Lee un Excel rellenado con la plantilla de caballos y separa las filas
 * validas de las que tienen errores. No escribe nada: solo valida.
 */
export async function parseHorseImport(
  buffer: ArrayBuffer,
): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs trae sus propios tipos de Buffer (de un @types/node antiguo) que
    // chocan con los de Node 20; el valor en tiempo de ejecucion es correcto.
    await workbook.xlsx.load(
      Buffer.from(new Uint8Array(buffer)) as unknown as Parameters<
        typeof workbook.xlsx.load
      >[0],
    );
  } catch {
    throw new ImportFormatError(
      "No se ha podido leer el archivo. Asegurate de subir el Excel (.xlsx) de la plantilla.",
    );
  }

  const sheet =
    workbook.getWorksheet("Caballos") ?? workbook.worksheets[0];
  if (!sheet) {
    throw new ImportFormatError("El archivo no tiene ninguna hoja de datos.");
  }

  // Cabecera -> indice de columna (1-based, como ExcelJS).
  const headerRow = sheet.getRow(1);
  const columnByKey = new Map<ImportColumnKey, number>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    // La plantilla marca las obligatorias con " *"; lo quitamos al comparar.
    const normalized = normalizeLabel(cellText(cell.value)).replace(
      /\s*\*$/,
      "",
    );
    const match = IMPORT_COLUMNS.find(
      (col) => normalizeLabel(col.header) === normalized,
    );
    if (match && !columnByKey.has(match.key)) {
      columnByKey.set(match.key, colNumber);
    }
  });

  const missingRequired = IMPORT_COLUMNS.filter(
    (col) => col.required && !columnByKey.has(col.key),
  );
  if (missingRequired.length > 0) {
    throw new ImportFormatError(
      `Faltan columnas obligatorias en la plantilla: ${missingRequired
        .map((col) => col.header)
        .join(", ")}.`,
    );
  }

  const get = (row: ExcelJS.Row, key: ImportColumnKey): ExcelJS.CellValue => {
    const col = columnByKey.get(key);
    return col ? row.getCell(col).value : null;
  };

  const valid: ParsedHorse[] = [];
  const errors: RowError[] = [];
  let totalRows = 0;

  const lastRow = Math.min(sheet.rowCount, MAX_ROWS + 1);
  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber++) {
    const row = sheet.getRow(rowNumber);

    const values: Record<ImportColumnKey, string> = {
      name: cellText(get(row, "name")),
      sex: cellText(get(row, "sex")),
      status: cellText(get(row, "status")),
      breed: cellText(get(row, "breed")),
      coat: cellText(get(row, "coat")),
      birthDate: cellText(get(row, "birthDate")),
      uelnCode: cellText(get(row, "uelnCode")),
      microchip: cellText(get(row, "microchip")),
      hierro: cellText(get(row, "hierro")),
      boxLocation: cellText(get(row, "boxLocation")),
    };

    const isEmpty = Object.values(values).every((v) => v === "");
    if (isEmpty) continue;

    totalRows++;
    const messages: string[] = [];

    if (!values.name) messages.push("Falta el nombre.");

    let sex: Sex | undefined;
    if (!values.sex) {
      messages.push("Falta el sexo.");
    } else {
      sex = SEX_LABELS[normalizeLabel(values.sex)];
      if (!sex) messages.push(`Sexo no reconocido: "${values.sex}".`);
    }

    let status: HorseStatus = HorseStatus.ACTIVE;
    if (values.status) {
      const matched = STATUS_LABELS[normalizeLabel(values.status)];
      if (!matched) messages.push(`Estado no reconocido: "${values.status}".`);
      else status = matched;
    }

    let birthDate: Date | undefined;
    if (values.birthDate) {
      const parsed = parseDate(get(row, "birthDate"));
      if (!parsed) {
        messages.push(
          `Fecha de nacimiento no valida: "${values.birthDate}" (usa dd/mm/aaaa).`,
        );
      } else {
        birthDate = parsed;
      }
    }

    if (messages.length > 0) {
      errors.push({ row: rowNumber, messages });
      continue;
    }

    valid.push({
      name: values.name,
      sex: sex!,
      status,
      breed: values.breed || undefined,
      coat: values.coat || undefined,
      birthDate,
      uelnCode: values.uelnCode || undefined,
      microchip: values.microchip || undefined,
      hierro: values.hierro || undefined,
      boxLocation: values.boxLocation || undefined,
    });
  }

  return { valid, errors, totalRows };
}
