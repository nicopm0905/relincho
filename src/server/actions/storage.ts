"use server";

import { auth } from "@/server/auth";
import { requireTenantAccess } from "@/server/services/access";
import {
  getPresignedUploadUrl,
  getPublicUrl,
  isStorageConfigured,
} from "@/server/services/storage/r2";
import { isAllowedUpload, UPLOAD_FOLDERS, maxBytesFor } from "@/lib/uploads";
import { reportError } from "@/lib/observability";
import { z } from "zod";
import { randomUUID } from "crypto";

const schema = z.object({
  tenantId: z.string().uuid(),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(3).max(150),
  sizeBytes: z.number().int().nonnegative().default(0),
  folder: z.enum(UPLOAD_FOLDERS),
  /** Las fotos son imagenes; los documentos admiten mas formatos. */
  kind: z.enum(["image", "document"]).default("image"),
});

export async function getUploadUrlAction(input: z.infer<typeof schema>) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Datos de subida inválidos" };
  const { tenantId, contentType, sizeBytes, folder, kind } = parsed.data;

  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  // El `tenantId` llega del navegador: sin esta comprobacion cualquiera con
  // cuenta podia pedir una URL firmada hacia la carpeta de otra yeguada.
  const access = await requireTenantAccess(session.user.id, tenantId);
  if (!access) return { error: "No tienes permiso sobre esta yeguada" };

  const check = isAllowedUpload(kind, contentType, sizeBytes);
  if (!check.ok) {
    return {
      error:
        check.reason === "type"
          ? "Ese tipo de archivo no está permitido"
          : `El archivo supera el máximo de ${Math.round(check.maxBytes / (1024 * 1024))} MB`,
    };
  }

  if (!isStorageConfigured()) {
    await reportError("Almacenamiento no configurado", {
      scope: "storage.uploadUrl",
      tenantId,
      folder,
    });
    // Sin bucket no hay forma de guardar nada en produccion: decirlo claro en
    // vez de devolver una URL que fallara al subir.
    if (process.env.NODE_ENV === "production") {
      return { error: "El almacenamiento de archivos no está configurado" };
    }
  }

  // La clave siempre vive dentro del prefijo de la yeguada del usuario.
  const key = `${tenantId}/${folder}/${randomUUID()}.${check.ext}`;

  if (!isStorageConfigured()) {
    return {
      uploadUrl: `/api/upload?key=${encodeURIComponent(key)}`,
      publicUrl: `/uploads/${key}`,
      key,
      maxBytes: maxBytesFor(kind),
      local: true,
    };
  }

  const uploadUrl = await getPresignedUploadUrl(key, contentType);
  const publicUrl = getPublicUrl(key);

  return { uploadUrl, publicUrl, key, maxBytes: maxBytesFor(kind) };
}
