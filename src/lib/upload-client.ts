"use client";

import { getUploadUrlAction } from "@/server/actions/storage";
import type { UploadFolder, UploadKind } from "@/lib/uploads";

/**
 * Subida de un archivo en tres pasos: el servidor comprueba permiso y tipo y
 * firma una URL, el navegador sube el fichero directo al bucket, y solo
 * entonces se registra. Vive aqui para que la ficha del caballo y el gestor
 * documental no mantengan dos copias del mismo protocolo.
 */
export type UploadOutcome =
  | {
      ok: true;
      storageKey: string | null;
      fileUrl: string | null;
      mimeType: string;
      sizeBytes: number;
    }
  | { ok: false; error: string };

export async function uploadFile(opts: {
  tenantId: string;
  file: File;
  folder: UploadFolder;
  kind: UploadKind;
}): Promise<UploadOutcome> {
  const signed = await getUploadUrlAction({
    tenantId: opts.tenantId,
    filename: opts.file.name,
    contentType: opts.file.type,
    sizeBytes: opts.file.size,
    kind: opts.kind,
    folder: opts.folder,
  });

  if (signed.error || !signed.uploadUrl) {
    return { ok: false, error: signed.error ?? "No se ha podido preparar la subida" };
  }

  const put = await fetch(signed.uploadUrl, {
    method: "PUT",
    body: opts.file,
    headers: { "Content-Type": opts.file.type },
  });

  if (!put.ok) {
    return { ok: false, error: "No se ha podido subir el archivo" };
  }

  return {
    ok: true,
    storageKey: signed.key ?? null,
    fileUrl: signed.publicUrl ?? null,
    mimeType: opts.file.type,
    sizeBytes: opts.file.size,
  };
}
