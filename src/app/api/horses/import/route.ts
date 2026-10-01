import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import {
  ImportFormatError,
  parseHorseImport,
} from "@/lib/horses/parse-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

/**
 * Lee un Excel o CSV de caballos y devuelve una vista previa:
 * filas válidas + filas con errores. NO crea ningún caballo; eso lo hace
 * después la mutación horses.bulkImport cuando el usuario confirma.
 *
 * POST /api/horses/import  (multipart/form-data, campo "file")
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "La peticion no es un formulario valido." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Adjunta el archivo Excel o CSV en el campo \"file\"." },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "El archivo esta vacio." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera los 4 MB." },
      { status: 413 },
    );
  }
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  if (extension !== "xlsx" && extension !== "csv") {
    return NextResponse.json(
      { error: "Sube un archivo .xlsx o .csv." },
      { status: 400 },
    );
  }

  try {
    const result = await parseHorseImport(
      await file.arrayBuffer(),
      extension === "csv" ? "csv" : "xlsx",
    );
    return NextResponse.json({
      valid: result.valid.map((horse) => ({
        ...horse,
        birthDate: horse.birthDate
          ? horse.birthDate.toISOString()
          : undefined,
      })),
      errors: result.errors,
      unmappedColumns: result.unmappedColumns,
      truncatedRows: result.truncatedRows,
      totalRows: result.totalRows,
    });
  } catch (error) {
    if (error instanceof ImportFormatError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("horse import parse failed", error);
    return NextResponse.json(
      { error: "No se ha podido procesar el archivo." },
      { status: 500 },
    );
  }
}
