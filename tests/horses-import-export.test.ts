import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { ImportFormatError, parseHorseImport } from "../src/lib/horses/parse-import";
import { buildHorsesCsv, type HorseExportRow } from "../src/lib/horses/export-horses";

async function workbookBuffer(
  headers: string[],
  rows: unknown[][],
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Caballos");
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer).slice().buffer;
}

test("el CSV de ejemplo ficticio mapea sus columnas y avisa de las no compatibles", async () => {
  const csv = await readFile("docs/ejemplo-importacion-caballos.csv");
  const result = await parseHorseImport(new Uint8Array(csv).slice().buffer, "csv");

  assert.equal(result.valid.length, 4);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.unmappedColumns, ["Yeguada anterior"]);
  assert.equal(result.valid[0]?.name, "Lucero del Alba");
  assert.equal(result.valid[0]?.sex, "FEMALE");
  assert.equal(result.valid[0]?.lgNumber, "PRE-20219");
  assert.equal(result.valid[1]?.status, "IN_TRAINING");
  assert.equal(result.valid[3]?.sex, "GELDING");
});

test("importa cabeceras habituales y conserva UELN y Libro Genealógico por separado", async () => {
  const file = await workbookBuffer(
    ["Nombre del caballo", "Género", "Color", "Nacimiento", "UELN", "Nº Libro Genealógico PRE", "Nº microchip"],
    [["Luna", "Yegua", "Torda", "14/03/2019", "724001512345678", "PRE-123", "941000012345678"]],
  );

  const result = await parseHorseImport(file);
  assert.equal(result.valid.length, 1);
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid[0]?.sex, "FEMALE");
  assert.equal(result.valid[0]?.birthDate?.toISOString(), "2019-03-14T00:00:00.000Z");
  assert.equal(result.valid[0]?.uelnCode, "724001512345678");
  assert.equal(result.valid[0]?.lgNumber, "PRE-123");
  assert.equal(result.valid[0]?.microchip, "941000012345678");
});

test("la columna antigua UELN / LG PRE mantiene ambos tipos de dato", async () => {
  const file = await workbookBuffer(
    ["Nombre", "Sexo", "UELN / LG PRE"],
    [
      ["Lucero", "Semental", "724001512345678"],
      ["Candela", "Yegua", "PRE-7788"],
    ],
  );

  const result = await parseHorseImport(file);
  assert.equal(result.valid[0]?.uelnCode, "724001512345678");
  assert.equal(result.valid[0]?.lgNumber, undefined);
  assert.equal(result.valid[1]?.uelnCode, undefined);
  assert.equal(result.valid[1]?.lgNumber, "PRE-7788");
});

test("encuentra la tabla aunque tenga un título por encima y use alias de Excel habitual", async () => {
  const workbook = new ExcelJS.Workbook();
  const instructions = workbook.addWorksheet("Instrucciones");
  instructions.addRow(["Guía de inventario"]);
  instructions.addRow(["No es la tabla de caballos"]);

  const sheet = workbook.addWorksheet("Listado de la yeguada");
  sheet.addRow(["Inventario equino · temporada 2026"]);
  sheet.addRow([]);
  sheet.addRow(["Nombre del ejemplar", "Género", "F. nac.", "UELN", "Nº LG PRE", "Nº transpondedor", "Yeguada anterior"]);
  sheet.addRow(["Alba", "H", "2018-06-20", "724001512345678", "PRE-912", "941000012345678", "Rancho Antiguo"]);

  const buffer = await workbook.xlsx.writeBuffer();
  const result = await parseHorseImport(new Uint8Array(buffer).slice().buffer);
  assert.equal(result.valid.length, 1);
  assert.equal(result.valid[0]?.sex, "FEMALE");
  assert.equal(result.valid[0]?.lgNumber, "PRE-912");
  assert.deepEqual(result.unmappedColumns, ["Yeguada anterior"]);
});

test("reimporta el CSV de exportación y conserva los campos de ficha", async () => {
  const horse: HorseExportRow = {
    name: "Luna, la Torda",
    sex: "FEMALE",
    status: "ACTIVE",
    breed: "PRE",
    coat: "Torda; clara",
    birthDate: new Date("2019-03-14T00:00:00.000Z"),
    uelnCode: "724001512345678",
    lgNumber: "PRE-123",
    microchip: "941000012345678",
    hierro: "Yeguada del Sur",
    boxLocation: "Box 4",
    sire: { name: "Semental de prueba" },
    dam: { name: "Madre de prueba" },
    owner: { name: "Cliente de prueba" },
  };

  const csv = buildHorsesCsv([horse]);
  const buffer = new TextEncoder().encode(csv).buffer;
  const result = await parseHorseImport(buffer, "csv");

  assert.equal(result.valid.length, 1);
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid[0]?.name, horse.name);
  assert.equal(result.valid[0]?.sex, horse.sex);
  assert.equal(result.valid[0]?.status, horse.status);
  assert.equal(result.valid[0]?.coat, horse.coat);
  assert.equal(result.valid[0]?.birthDate?.toISOString(), "2019-03-14T00:00:00.000Z");
  assert.equal(result.valid[0]?.uelnCode, horse.uelnCode);
  assert.equal(result.valid[0]?.lgNumber, horse.lgNumber);
  assert.equal(result.valid[0]?.microchip, horse.microchip);
  assert.equal(result.valid[0]?.hierro, horse.hierro);
  assert.equal(result.valid[0]?.boxLocation, horse.boxLocation);
  assert.deepEqual(result.unmappedColumns, ["Padre", "Madre", "Propietario"]);
});

test("el lector CSV soporta comas decimales/formato con comillas y celdas multilínea", async () => {
  const csv = [
    '"Nombre";"Sexo";"Estado";"Capa";"Microchip"',
    '"Luna;\nla Torda";"Hembra";"Activo";"Torda, clara";"941000012345678"',
  ].join("\r\n");
  const result = await parseHorseImport(new TextEncoder().encode(csv).buffer, "csv");
  assert.equal(result.valid.length, 1);
  assert.equal(result.valid[0]?.name, "Luna;\nla Torda");
  assert.equal(result.valid[0]?.coat, "Torda, clara");
});

test("el lector CSV detecta separadores coma y tabulador", async () => {
  const cases = [
    { delimiter: ",", row: '"Luna, la Torda",Yegua,PRE', name: "Luna, la Torda" },
    { delimiter: "\t", row: "Luna la Torda\tYegua\tPRE", name: "Luna la Torda" },
  ];

  for (const { delimiter, row, name } of cases) {
    const csv = `Nombre${delimiter}Sexo${delimiter}Raza\r\n${row}`;
    const result = await parseHorseImport(new TextEncoder().encode(csv).buffer, "csv");
    assert.equal(result.valid.length, 1);
    assert.equal(result.valid[0]?.name, name);
    assert.equal(result.valid[0]?.breed, "PRE");
  }
});

test("el lector CSV informa comillas sin cerrar y codificación no válida", async () => {
  const invalidQuotes = new TextEncoder().encode('"Nombre";"Sexo"\r\n"Luna;Yegua').buffer;
  await assert.rejects(
    parseHorseImport(invalidQuotes, "csv"),
    (error: unknown) => error instanceof ImportFormatError && /comillas sin cerrar/i.test(error.message),
  );

  await assert.rejects(
    parseHorseImport(new Uint8Array([0xff, 0xfe]).buffer, "csv"),
    (error: unknown) => error instanceof ImportFormatError && /CSV UTF-8/i.test(error.message),
  );
});

test("marca identificadores duplicados en el propio Excel y solo acepta la primera fila", async () => {
  const file = await workbookBuffer(
    ["Nombre", "Sexo", "UELN", "Microchip"],
    [
      ["Alba", "Yegua", "724001512345678", "941000012345678"],
      ["Alba II", "Yegua", "724-001-512345678", "941 000 012 345 678"],
    ],
  );

  const result = await parseHorseImport(file);
  assert.equal(result.valid.length, 1);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0]?.messages.join(" ") ?? "", /UELN ya aparece en la fila 2/);
  assert.match(result.errors[0]?.messages.join(" ") ?? "", /microchip ya aparece en la fila 2/i);
});

test("rechaza fechas imposibles e identificadores con formato incorrecto", async () => {
  const file = await workbookBuffer(
    ["Nombre", "Sexo", "Fecha nacimiento", "UELN", "Microchip"],
    [["Luna", "Yegua", "31/02/2019", "123", "chip"]],
  );

  const result = await parseHorseImport(file);
  assert.equal(result.valid.length, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0]?.messages.join(" ") ?? "", /Fecha de nacimiento no válida/);
  assert.match(result.errors[0]?.messages.join(" ") ?? "", /UELN no válido/);
  assert.match(result.errors[0]?.messages.join(" ") ?? "", /Microchip no válido/);
});

test("no permite importar parcialmente un archivo que supera el máximo de filas", async () => {
  const headers = ["Nombre", "Sexo"];
  const rows = Array.from({ length: 1001 }, (_, index) => [`Caballo ${index + 1}`, "Yegua"]);
  const file = await workbookBuffer(headers, rows);
  const result = await parseHorseImport(file);

  assert.equal(result.totalRows, 1000);
  assert.equal(result.valid.length, 1000);
  assert.equal(result.truncatedRows, 1);
});

test("localiza la hoja de datos por encima de instrucciones y prioriza la hoja Caballos", async () => {
  const workbook = new ExcelJS.Workbook();
  const instructions = workbook.addWorksheet("Instrucciones");
  instructions.addRow(["Nombre", "Sexo", "Notas"]);
  instructions.addRow(["Esto no es una ficha", "Yegua", "Guía"]);

  const horses = workbook.addWorksheet("Caballos");
  horses.addRow(["Nombre", "Sexo", "UELN"]);
  horses.addRow(["Luna", "Yegua", "724001512345678"]);

  const buffer = await workbook.xlsx.writeBuffer();
  const result = await parseHorseImport(new Uint8Array(buffer).slice().buffer);
  assert.equal(result.valid.length, 1);
  assert.equal(result.valid[0]?.name, "Luna");
  assert.deepEqual(result.unmappedColumns, []);
});

test("el CSV de caballos funciona en Excel español y neutraliza fórmulas", () => {
  const row: HorseExportRow = {
    name: "=HYPERLINK(1)",
    sex: "FEMALE",
    status: "ACTIVE",
    breed: "PRE",
    coat: "Torda; clara",
    birthDate: new Date("2019-03-14T00:00:00.000Z"),
    uelnCode: "724001512345678",
    lgNumber: "PRE-123",
    microchip: "941000012345678",
    hierro: null,
    boxLocation: "Box 1",
    sire: null,
    dam: { name: "Lucero" },
    owner: { name: "Ana \"la cuadra\"" },
  };

  const csv = buildHorsesCsv([row]);
  assert.ok(csv.startsWith("\uFEFFNombre;Sexo;Estado;"));
  assert.ok(csv.includes("'=HYPERLINK(1);Yegua;Activo;PRE;\"Torda; clara\";2019-03-14;"));
  assert.ok(csv.includes('"Ana ""la cuadra"""'));
  assert.ok(csv.includes("Lucero"));
  assert.ok(csv.endsWith("\r\n"));
});
