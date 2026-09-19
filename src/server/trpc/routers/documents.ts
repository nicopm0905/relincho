import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure, roleProcedure } from "../init";
import {
  createDocumentRow,
  documentDownloadUrl,
  documentUsage,
  findDocument,
  listDocuments,
  softDeleteDocument,
  updateDocumentRow,
  withDownloadUrls,
} from "@/server/services/documents";
import { DOCUMENT_KINDS, ownsDocumentKey } from "@/lib/documents";

/** Igual que en caballos: escribir es cosa de propietario y encargado. */
const managerProcedure = roleProcedure("OWNER", "MANAGER");

const kindSchema = z.enum(DOCUMENT_KINDS);

export const documentsRouter = createTRPCRouter({
  /**
   * Documentos de la yeguada. `tenantId` se devuelve aqui porque la interfaz lo
   * necesita para firmar la subida y no hay otra via limpia de tenerlo en el
   * cliente sin exponer la sesion entera.
   */
  list: tenantProcedure
    .input(
      z
        .object({
          horseId: z.string().uuid().optional(),
          kind: kindSchema.optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const rows = await listDocuments(ctx.tenantId, input ?? {});
      const documents = await withDownloadUrls(rows);
      const usage = await documentUsage(ctx.tenantId);
      return { tenantId: ctx.tenantId, documents, usage };
    }),

  /**
   * Registra un documento ya subido. La clave debe estar dentro de la carpeta
   * de esta yeguada: si no, seria posible enganchar el fichero de otra.
   */
  create: managerProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        kind: kindSchema.default("OTHER"),
        horseId: z.string().uuid().nullish(),
        storageKey: z.string().min(3).max(400).nullish(),
        fileUrl: z.string().max(600).nullish(),
        mimeType: z.string().max(150).nullish(),
        sizeBytes: z.number().int().nonnegative().nullish(),
        expiresAt: z.coerce.date().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.storageKey) {
        if (!ownsDocumentKey(ctx.tenantId, input.storageKey)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      } else if (!input.fileUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Falta el archivo del documento",
        });
      }

      // La cuota se comprueba aqui y no en el navegador: es la unica forma de
      // que no se pueda burlar subiendo ficheros de uno en uno.
      const usage = await documentUsage(ctx.tenantId);
      const incoming = input.sizeBytes ?? 0;
      if (usage.bytes + incoming > usage.quotaBytes) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "La yeguada ha agotado su espacio de documentos",
        });
      }

      return createDocumentRow({
        tenantId: ctx.tenantId,
        horseId: input.horseId ?? null,
        kind: input.kind,
        name: input.name,
        storageKey: input.storageKey ?? null,
        fileUrl: input.fileUrl ?? null,
        mimeType: input.mimeType ?? null,
        sizeBytes: input.sizeBytes ?? null,
        uploadedById: ctx.user.id,
        expiresAt: input.expiresAt ?? null,
      });
    }),

  update: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
        kind: kindSchema.optional(),
        horseId: z.string().uuid().nullish(),
        expiresAt: z.coerce.date().nullish(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return updateDocumentRow(ctx.tenantId, id, data);
    }),

  remove: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const removed = await softDeleteDocument(ctx.tenantId, input.id);
      if (!removed) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),

  /**
   * URL temporal de descarga. Se pide al abrir el documento y no se guarda en
   * el HTML, para que un enlace filtrado deje de servir en minutos.
   */
  downloadUrl: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const doc = await findDocument(ctx.tenantId, input.id);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      const url = await documentDownloadUrl(doc);
      if (!url) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "El archivo de este documento no está disponible",
        });
      }
      return { url, name: doc.name, mimeType: doc.mimeType };
    }),
});
