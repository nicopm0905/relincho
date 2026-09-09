import "server-only";
import ExcelJS from "exceljs";
import {
  IMPORT_COLUMNS,
  SEX_OPTIONS,
  STATUS_OPTIONS,
} from "./import-columns";

const DATA_ROWS = 1000;

/** Genera el Excel de ejemplo que el cliente descarga, rellena y vuelve a subir. */
export async function buildHorseImportTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Equigest";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Caballos", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = IMPORT_COLUMNS.map((col) => ({
    header: col.required ? `${col.header} *` : col.header,
    key: col.key,
    width: col.width,
  }));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" },
  };
  header.alignment = { vertical: "middle" };
  header.height = 20;

  IMPORT_COLUMNS.forEach((col, index) => {
    const colNumber = index + 1;

    if (col.kind === "sex" || col.kind === "status") {
      const options = col.kind === "sex" ? SEX_OPTIONS : STATUS_OPTIONS;
      const rule: ExcelJS.DataValidation = {
        type: "list",
        allowBlank: !col.required,
        formulae: [`"${options.join(",")}"`],
        showErrorMessage: true,
        errorStyle: "warning",
        errorTitle: "Valor fuera de la lista",
        error: `Usa uno de: ${options.join(", ")}.`,
      };
      for (let row = 2; row <= DATA_ROWS + 1; row++) {
        sheet.getCell(row, colNumber).dataValidation = rule;
      }
    }

    if (col.kind === "date") {
      sheet.getColumn(colNumber).numFmt = "dd/mm/yyyy";
    }

    // UELN y microchip son numeros largos: como texto no pierden digitos.
    if (col.key === "uelnCode" || col.key === "microchip") {
      sheet.getColumn(colNumber).numFmt = "@";
    }
  });

  buildInstructionsSheet(workbook);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function buildInstructionsSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet("Instrucciones");
  sheet.getColumn(1).width = 26;
  sheet.getColumn(2).width = 70;
  sheet.getColumn(3).width = 22;

  const title = sheet.addRow(["Como rellenar esta plantilla"]);
  title.font = { bold: true, size: 14 };
  sheet.addRow([]);
  sheet.addRow([
    "1. Escribe un caballo por fila en la hoja \"Caballos\".",
  ]);
  sheet.addRow([
    "2. No cambies ni borres la fila de cabeceras.",
  ]);
  sheet.addRow([
    "3. Las columnas con * son obligatorias. El resto puedes dejarlas en blanco.",
  ]);
  sheet.addRow([
    "4. Guarda el archivo y subelo en Caballos > Importar desde Excel.",
  ]);
  sheet.addRow([]);

  const head = sheet.addRow(["Columna", "Que poner", "Ejemplo"]);
  head.font = { bold: true };

  IMPORT_COLUMNS.forEach((col) => {
    sheet.addRow([
      col.required ? `${col.header} *` : col.header,
      col.help,
      col.example,
    ]);
  });
}
