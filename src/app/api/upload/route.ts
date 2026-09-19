import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { auth } from "@/server/auth";
import { requireTenantAccess } from "@/server/services/access";
import { UPLOAD_RULES } from "@/lib/uploads";

/**
 * Almacenamiento local de desarrollo, solo cuando no hay bucket R2.
 *
 * En produccion el sistema de ficheros de Vercel es de solo lectura, asi que
 * este endpoint no sirve para nada ahi: se cierra con un 404 en vez de intentar
 * escribir y devolver un 500 opaco. Ademas exige sesion y que la clave empiece
 * por una yeguada del usuario, para que nadie use el servidor como almacen
 * publico de ficheros arbitrarios.
 */

/** Clave firmada: <tenantId>/<carpeta>/<uuid>.<ext>. Nada mas entra. */
const KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(horses|documents)\/[A-Za-z0-9_-]{1,64}\.[A-Za-z0-9]{1,7}$/;

export async function PUT(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!KEY_PATTERN.test(key)) {
    return NextResponse.json({ error: "Clave inválida" }, { status: 400 });
  }

  const [tenantId] = key.split("/");
  const access = await requireTenantAccess(session.user.id, tenantId);
  if (!access) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const maxBytes = Math.max(
    UPLOAD_RULES.image.maxBytes,
    UPLOAD_RULES.document.maxBytes,
  );
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    return NextResponse.json({ error: "Archivo demasiado grande" }, { status: 413 });
  }

  try {
    const buffer = await req.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      return NextResponse.json(
        { error: "Archivo demasiado grande" },
        { status: 413 },
      );
    }

    const destPath = path.join(process.cwd(), "public", "uploads", key);
    await mkdir(path.dirname(destPath), { recursive: true });
    await writeFile(destPath, Buffer.from(buffer));

    return NextResponse.json({ success: true, key });
  } catch (error) {
    console.error("Local upload error:", error);
    return NextResponse.json(
      { error: "No se pudo guardar el archivo" },
      { status: 500 },
    );
  }
}
