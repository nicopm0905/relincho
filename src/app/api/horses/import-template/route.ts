import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { buildHorseImportTemplate } from "@/lib/horses/build-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Plantilla Excel para dar de alta caballos en lote.
 *
 * GET /api/horses/import-template -> descarga plantilla_caballos.xlsx
 *
 * El cliente la rellena y la vuelve a subir en POST /api/horses/import.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const buffer = await buildHorseImportTemplate();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla_caballos.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
