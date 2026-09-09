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
 * Lee el Excel rellenado con la plantilla y devuelve una vista previa:
 * filas validas + filas con errores. NO crea ningun caballo; eso lo hace
 * despues la mutacion horses.bulkImport cuando el usuario confirma.
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
      { error: "Adjunta el archivo Excel en el campo \"file\"." },
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
  if (!/\.xlsx$/i.test(file.name)) {
    return NextResponse.json(
      { error: "Sube el archivo en formato .xlsx (Excel)." },
      { status: 400 },
    );
  }

  try {
    const result = await parseHorseImport(await file.arrayBuffer());
    return NextResponse.json({
      valid: result.valid.map((horse) => ({
        ...horse,
        birthDate: horse.birthDate
          ? horse.birthDate.toISOString()
          : undefined,
      })),
      errors: result.errors,
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
