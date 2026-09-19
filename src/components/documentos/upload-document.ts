"use client";

import { getUploadUrlAction } from "@/server/actions/storage";

export interface PushDocumentInput {
  tenantId: string;
  file: File;
  kind?: "document" | "image";
}

export interface PushedDocument {
  ok: boolean;
  error?: string;
  storageKey?: string | null;
  fileUrl?: string | null;
}

/**
 * Protocolo de subida en tres pasos, compartido por el gestor documental y la
 * ficha del caballo:
 *
 *  1. el servidor comprueba permisos y tipo de archivo y firma una subida,
 *  2. el navegador sube el fichero directamente al bucket,
 *  3. solo entonces se registra el documento.
 *
 * Separarlo evita que las dos pantallas se desincronicen si mañana cambia el
 * almacenamiento.
 */
export async function pushDocument({
  tenantId,
  file,
  kind = "document",
}: PushDocumentInput): Promise<PushedDocument> {
  const signed = await getUploadUrlAction({
    tenantId,
    filename: file.name,
    contentType: file.type,
    sizeBytes: file.size,
    kind,
    folder: "documents",
  });

  if (signed.error || !signed.uploadUrl) {
    return { ok: false, error: signed.error ?? "No se ha podido preparar la subida" };
  }

  const response = await fetch(signed.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });

  if (!response.ok) {
    return { ok: false, error: "No se ha podido subir el archivo" };
  }

  return { ok: true, storageKey: signed.key ?? null, fileUrl: signed.publicUrl ?? null };
}
