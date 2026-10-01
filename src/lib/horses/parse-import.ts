import "server-only";
import ExcelJS from "exceljs";
import { HorseStatus, Sex } from "@prisma/client";
import { isValidMicrochip, isValidUeln, normalizeCode } from "../identifiers";
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
  lgNumber?: string;
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
  /** Columnas no reconocidas: se muestran para no dar por importado lo omitido. */
  unmappedColumns: string[];
  /** Filas que superan el límite de lectura y no se procesaron. */
  truncatedRows: number;
  /** Filas con datos que se han mirado (sin contar cabecera ni filas vacias). */
  totalRows: number;
}

/** Se lanza cuando el fichero no tiene la forma de la plantilla. */
export class ImportFormatError extends Error {}

const MAX_ROWS = 1000;
const HEADER_SCAN_ROWS = 10;
export type HorseImportFormat = "xlsx" | "csv";

interface HeaderResolution {
  sheet: ExcelJS.Worksheet;
  headerRowNumber: number;
  columnByKey: Map<ImportColumnKey, number>;
  legacyIdentifierColumn: number | null;
  unmappedColumns: string[];
  score: number;
}

function resolveHeaderRow(sheet: ExcelJS.Worksheet): HeaderResolution | null {
  let best: HeaderResolution | null = null;
  const lastHeaderRow = Math.min(sheet.rowCount, HEADER_SCAN_ROWS);

  for (let rowNumber = 1; rowNumber <= lastHeaderRow; rowNumber++) {
    const columnByKey = new Map<ImportColumnKey, number>();
    const unmappedColumns: string[] = [];
    let legacyIdentifierColumn: number | null = null;
    const row = sheet.getRow(rowNumber);

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const label = cellText(cell.value);
      const normalized = normalizeLabel(label);
      if (!normalized) return;

      // Compatibilidad con versiones anteriores de la plantilla que mezclaban
      // el UELN y el número de Libro Genealógico PRE en una sola columna.
      if (normalized === normalizeLabel("UELN / LG PRE")) {
        legacyIdentifierColumn = colNumber;
        return;
      }

      const match = IMPORT_COLUMNS.find((column) =>
        [column.header, ...(column.aliases ?? [])].some(
          (alias) => normalizeLabel(alias) === normalized,
        ),
      );
      if (!match) {
        unmappedColumns.push(label);
        return;
      }
      if (columnByKey.has(match.key)) {
        unmappedColumns.push(`${label} (columna duplicada)`);
        return;
      }
      columnByKey.set(match.key, colNumber);
    });

    const score = columnByKey.size + (legacyIdentifierColumn === null ? 0 : 1);
    if (
      score >= 2 &&
      columnByKey.has("name") &&
      columnByKey.has("sex") &&
      (!best || score > best.score)
    ) {
      best = {
        sheet,
        headerRowNumber: rowNumber,
        columnByKey,
        legacyIdentifierColumn,
        unmappedColumns,
        score,
      };
    }
  }

  return best;
}

function resolveDataSheet(workbook: ExcelJS.Workbook): HeaderResolution {
  const candidates = workbook.worksheets
    .map((sheet) => resolveHeaderRow(sheet))
    .filter((candidate): candidate is HeaderResolution => candidate !== null)
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.sheet.name === "Caballos") return -1;
      if (b.sheet.name === "Caballos") return 1;
      return 0;
    });
  const best = candidates[0];
  if (!best) {
    throw new ImportFormatError(
      "No se han encontrado las columnas obligatorias Nombre y Sexo en las primeras 10 filas de ninguna hoja.",
    );
  }
  return best;
}

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
    return validUtcDate(year, Number(m) - 1, Number(d));
  }

  // aaaa-mm-dd
  const ymd = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return validUtcDate(Number(y), Number(m) - 1, Number(d));
  }

  return null;
}

function validUtcDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Lee un Excel de caballos y separa las filas validas de las que tienen
 * errores. Reconoce cabeceras comunes de exportaciones y la plantilla propia.
 * No escribe nada: solo valida.
 */
function parseDelimitedText(text: string): { rows: string[][]; overflowRows: number } {
  const normalizedText = text.replace(/^\uFEFF/, "").replace(/\0/g, "");
  let delimiter: ";" | "," | "\t" = ";";
  const delimitersOnFirstRecord = { ";": 0, ",": 0, "\t": 0 };
  let inHeaderQuotes = false;
  for (let index = 0; index < normalizedText.length; index++) {
    const char = normalizedText[index]!;
    if (char === '"') {
      if (inHeaderQuotes && normalizedText[index + 1] === '"') index++;
      else inHeaderQuotes = !inHeaderQuotes;
    } else if (!inHeaderQuotes && (char === ";" || char === "," || char === "\t")) {
      delimitersOnFirstRecord[char]++;
    } else if (!inHeaderQuotes && (char === "\n" || char === "\r")) {
      break;
    }
  }
  if (delimitersOnFirstRecord[","] > delimitersOnFirstRecord[";"] && delimitersOnFirstRecord[","] > 0) {
    delimiter = ",";
  } else if (
    delimitersOnFirstRecord["\t"] > delimitersOnFirstRecord[";"] &&
    delimitersOnFirstRecord["\t"] > delimitersOnFirstRecord[","]
  ) {
    delimiter = "\t";
  }

  const rows: string[][] = [];
  const maxBufferedRows = MAX_ROWS + HEADER_SCAN_ROWS + 1;
  let overflowRows = 0;
  const storeRow = (values: string[]) => {
    if (!values.some((value) => value.trim() !== "")) return;
    if (rows.length < maxBufferedRows) rows.push(values);
    else overflowRows++;
  };
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let index = 0; index < normalizedText.length; index++) {
    const char = normalizedText[index]!;
    if (char === '"') {
      if (inQuotes && normalizedText[index + 1] === '"') {
        field += '"';
        index++;
      } else if (inQuotes) {
        if (
          index + 1 < normalizedText.length &&
          normalizedText[index + 1] !== delimiter &&
          normalizedText[index + 1] !== "\r" &&
          normalizedText[index + 1] !== "\n"
        ) {
          throw new ImportFormatError("El CSV contiene comillas mal colocadas.");
        }
        inQuotes = false;
      } else if (field.length === 0) {
        inQuotes = true;
      } else {
        throw new ImportFormatError("El CSV contiene comillas mal colocadas.");
      }
    } else if (!inQuotes && char === delimiter) {
      row.push(field);
      field = "";
    } else if (!inQuotes && (char === "\n" || char === "\r")) {
      row.push(field);
      storeRow(row);
      row = [];
      field = "";
      if (char === "\r" && normalizedText[index + 1] === "\n") index++;
    } else {
      field += char;
    }
  }

  if (inQuotes) throw new ImportFormatError("El CSV contiene comillas sin cerrar.");
  row.push(field);
  storeRow(row);
  if (rows.length === 0) throw new ImportFormatError("El archivo CSV está vacío.");
  return { rows, overflowRows };
}

export async function parseHorseImport(
  buffer: ArrayBuffer,
  format: HorseImportFormat = "xlsx",
): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  let csvOverflowRows = 0;
  try {
    if (format === "csv") {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(
        new Uint8Array(buffer),
      );
      const parsedCsv = parseDelimitedText(text);
      csvOverflowRows = parsedCsv.overflowRows;
      const sheet = workbook.addWorksheet("Caballos");
      parsedCsv.rows.forEach((row) => sheet.addRow(row));
    } else {
      // exceljs trae sus propios tipos de Buffer (de un @types/node antiguo) que
      // chocan con los de Node 20; el valor en tiempo de ejecucion es correcto.
      await workbook.xlsx.load(
        Buffer.from(new Uint8Array(buffer)) as unknown as Parameters<
          typeof workbook.xlsx.load
        >[0],
      );
    }
  } catch (error) {
    if (error instanceof ImportFormatError) throw error;
    throw new ImportFormatError(
      format === "csv"
        ? error instanceof ImportFormatError
          ? error.message
          : "No se ha podido leer el CSV. Guárdalo como CSV UTF-8 separado por punto y coma, coma o tabulador."
        : "No se ha podido leer el archivo. Sube un libro de Excel (.xlsx) con los datos en la primera hoja.",
    );
  }

  const header = resolveDataSheet(workbook);
  const { sheet, columnByKey, legacyIdentifierColumn, unmappedColumns } = header;
  const get = (row: ExcelJS.Row, key: ImportColumnKey): ExcelJS.CellValue => {
    const col = columnByKey.get(key);
    return col ? row.getCell(col).value : null;
  };

  const valid: ParsedHorse[] = [];
  const errors: RowError[] = [];
  let totalRows = 0;
  const seenUeln = new Map<string, number>();
  const seenMicrochip = new Map<string, number>();

  const lastRow = Math.min(sheet.rowCount, header.headerRowNumber + MAX_ROWS);
  const truncatedRows = csvOverflowRows + Math.max(0, sheet.rowCount - lastRow);
  for (let rowNumber = header.headerRowNumber + 1; rowNumber <= lastRow; rowNumber++) {
    const row = sheet.getRow(rowNumber);

    const values: Record<ImportColumnKey, string> = {
      name: cellText(get(row, "name")),
      sex: cellText(get(row, "sex")),
      status: cellText(get(row, "status")),
      breed: cellText(get(row, "breed")),
      coat: cellText(get(row, "coat")),
      birthDate: cellText(get(row, "birthDate")),
      uelnCode: cellText(get(row, "uelnCode")),
      lgNumber: cellText(get(row, "lgNumber")),
      microchip: cellText(get(row, "microchip")),
      hierro: cellText(get(row, "hierro")),
      boxLocation: cellText(get(row, "boxLocation")),
    };

    if (legacyIdentifierColumn !== null) {
      const legacyValue = cellText(row.getCell(legacyIdentifierColumn).value);
      if (legacyValue && isValidUeln(legacyValue)) {
        if (!columnByKey.has("uelnCode")) values.uelnCode = legacyValue;
      } else if (legacyValue && !columnByKey.has("lgNumber")) {
        values.lgNumber = legacyValue;
      }
    }

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
          `Fecha de nacimiento no válida: "${values.birthDate}" (usa dd/mm/aaaa).`,
        );
      } else {
        birthDate = parsed;
      }
    }

    if (values.uelnCode && !isValidUeln(values.uelnCode)) {
      messages.push(`UELN no válido: "${values.uelnCode}" (debe tener 15 caracteres).`);
    }
    if (values.microchip && !isValidMicrochip(values.microchip)) {
      messages.push(`Microchip no válido: "${values.microchip}" (debe tener 15 dígitos).`);
    }
    if (values.lgNumber.length > 40) {
      messages.push("El número de Libro Genealógico no puede superar 40 caracteres.");
    }

    if (values.uelnCode && isValidUeln(values.uelnCode)) {
      const previousRow = seenUeln.get(normalizeCode(values.uelnCode));
      if (previousRow) {
        messages.push(`El UELN ya aparece en la fila ${previousRow}.`);
      }
    }
    if (values.microchip && isValidMicrochip(values.microchip)) {
      const previousRow = seenMicrochip.get(normalizeCode(values.microchip));
      if (previousRow) {
        messages.push(`El microchip ya aparece en la fila ${previousRow}.`);
      }
    }

    if (messages.length > 0) {
      errors.push({ row: rowNumber, messages });
      continue;
    }

    if (values.uelnCode) seenUeln.set(normalizeCode(values.uelnCode), rowNumber);
    if (values.microchip) seenMicrochip.set(normalizeCode(values.microchip), rowNumber);

    valid.push({
      name: values.name,
      sex: sex!,
      status,
      breed: values.breed || undefined,
      coat: values.coat || undefined,
      birthDate,
      uelnCode: values.uelnCode ? normalizeCode(values.uelnCode) : undefined,
      lgNumber: values.lgNumber || undefined,
      microchip: values.microchip ? normalizeCode(values.microchip) : undefined,
      hierro: values.hierro || undefined,
      boxLocation: values.boxLocation || undefined,
    });
  }

  return { valid, errors, unmappedColumns, truncatedRows, totalRows };
}
