import "server-only";

import { withTenant } from "@/server/db/prisma";
import { normalizeDocumentKind } from "@/lib/documents";
import {
  deleteObject,
  getPresignedDownloadUrl,
  isStorageConfigured,
} from "@/server/services/storage/r2";

/** Cuota de almacenamiento por yeguada. Configurable para el plan de pago. */
export function documentQuotaBytes(): number {
  const mb = Number(process.env.DOCUMENTS_QUOTA_MB ?? 512);
  return (Number.isFinite(mb) && mb > 0 ? mb : 512) * 1024 * 1024;
}

type DocumentLike = {
  storageKey: string | null;
  fileUrl: string | null;
};

/**
 * URL con la que el navegador abre el documento: firmada y temporal cuando el
 * fichero esta en el bucket privado. `fileUrl` solo se usa en el almacenamiento
 * local de desarrollo.
 */
export async function documentDownloadUrl(
  doc: DocumentLike,
  expiresIn = 300,
): Promise<string | null> {
  if (doc.storageKey && isStorageConfigured()) {
    try {
      return await getPresignedDownloadUrl(doc.storageKey, expiresIn);
    } catch {
      // Si el bucket no responde, es mejor devolver null y que la interfaz lo
      // muestre deshabilitado que romper la pagina entera.
      return null;
    }
  }
  return doc.fileUrl ?? null;
}

/**
 * Añade a cada documento su URL temporal y si está caducado, en una sola
 * pasada.
 *
 * La caducidad se calcula aquí y no en el navegador a propósito: leer la fecha
 * actual durante el render de un componente de cliente es una función impura y
 * el resultado cambiaría sin que cambie nada más.
 */
export async function withDownloadUrls<
  T extends DocumentLike & { expiresAt: Date | null },
>(docs: T[]): Promise<(T & { url: string | null; expired: boolean })[]> {
  const now = Date.now();
  return Promise.all(
    docs.map(async (doc) => ({
      ...doc,
      url: await documentDownloadUrl(doc),
      expired: doc.expiresAt ? doc.expiresAt.getTime() < now : false,
    })),
  );
}

export async function listDocuments(
  tenantId: string,
  opts: {
    horseId?: string;
    kind?: string;
    /** Solo documentos de estos caballos (miembros externos). `null`: todos. */
    allowedHorseIds?: string[] | null;
  } = {},
) {
  return withTenant(tenantId, (tx) =>
    tx.document.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(opts.horseId ? { horseId: opts.horseId } : {}),
        ...(opts.allowedHorseIds ? { horseId: { in: opts.allowedHorseIds } } : {}),
        ...(opts.kind ? { kind: opts.kind } : {}),
      },
      include: { horse: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  );
}

export async function documentUsage(tenantId: string) {
  const usage = await withTenant(tenantId, (tx) =>
    tx.document.aggregate({
      where: { tenantId, deletedAt: null },
      _sum: { sizeBytes: true },
      _count: true,
    }),
  );
  return {
    bytes: usage._sum.sizeBytes ?? 0,
    count: usage._count,
    quotaBytes: documentQuotaBytes(),
  };
}

export async function createDocumentRow(input: {
  tenantId: string;
  horseId?: string | null;
  kind: string;
  name: string;
  storageKey: string | null;
  fileUrl?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  uploadedById?: string | null;
  expiresAt?: Date | null;
}) {
  const { tenantId, ...rest } = input;
  return withTenant(tenantId, (tx) =>
    tx.document.create({
      data: { tenantId, ...rest, kind: normalizeDocumentKind(rest.kind) },
    }),
  );
}

export async function updateDocumentRow(
  tenantId: string,
  id: string,
  data: {
    name?: string;
    kind?: string;
    horseId?: string | null;
    expiresAt?: Date | null;
  },
) {
  return withTenant(tenantId, (tx) =>
    tx.document.update({
      where: { id, tenantId },
      data: {
        ...data,
        ...(data.kind ? { kind: normalizeDocumentKind(data.kind) } : {}),
      },
    }),
  );
}

/**
 * Borrado logico y, si el fichero esta en el bucket, borrado fisico. Se
 * conserva la fila para poder auditar que existio (y para no perder el nombre
 * si el borrado fue un error).
 */
export async function softDeleteDocument(tenantId: string, id: string) {
  const doc = await withTenant(tenantId, (tx) =>
    tx.document.findFirst({ where: { id, tenantId } }),
  );
  if (!doc) return null;

  if (doc.storageKey && isStorageConfigured()) {
    try {
      await deleteObject(doc.storageKey);
    } catch {
      // El objeto puede no existir ya: el borrado logico manda.
    }
  }

  return withTenant(tenantId, (tx) =>
    tx.document.update({
      where: { id, tenantId },
      data: { deletedAt: new Date() },
    }),
  );
}

export async function findDocument(tenantId: string, id: string) {
  return withTenant(tenantId, (tx) =>
    tx.document.findFirst({ where: { id, tenantId, deletedAt: null } }),
  );
}

/** Documentos de un caballo, listos para resolver su URL de descarga. */
export async function documentsForHorse(tenantId: string, horseId: string) {
  return withTenant(tenantId, (tx) =>
    tx.document.findMany({
      where: { tenantId, horseId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    }),
  );
}
