import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";

import { createTRPCRouter, roleProcedure, staffProcedure } from "../init";
import { allowedHorseIds, assertHorseAccess } from "../access";
import { prisma, withTenant } from "@/server/db/prisma";
import {
  acknowledge,
  addUpdate,
  followUp,
  IncidentError,
  markRead,
  openIncident,
  resolve,
  type Incident,
} from "@/lib/incidents";
import { incidentPhotoKey, isAllowedUpload, isIncidentPhotoKeyFor } from "@/lib/uploads";
import { incidentPhotoReadUrl, signIncidentPhotoUpload } from "@/server/services/incidents/photos";
import { deliverIncidentEmails } from "@/server/services/incidents/deliver";
import {
  centerManagers,
  findIncident,
  INCIDENT_CATEGORY_LABEL,
  notify,
  saveTransition,
  toMotor,
} from "@/server/services/incidents/store";

/**
 * Incidencias con confirmación de lectura (E5). El personal las abre y las
 * resuelve; el propietario las lee y las confirma. El ciclo de vida es el
 * motor puro `src/lib/incidents.ts`. Un externo solo ve las de sus caballos
 * (`HorseAccess`) y a cualquier otra responde NOT_FOUND, no FORBIDDEN.
 */

const CATEGORIES = ["INJURY", "LAMENESS", "NOT_EATING", "COLIC_SIGNS", "EQUIPMENT", "BEHAVIOR", "OTHER"] as const;
const SEVERITIES = ["LOW", "MEDIUM", "HIGH"] as const;
const MAX_PHOTOS = 6;

const ownerProcedure = roleProcedure("OWNER_EXTERNAL");
const viewerProcedure = roleProcedure("OWNER", "MANAGER", "GROOM", "OWNER_EXTERNAL");

type Ctx = { tenantId: string; membershipId: string; role: Parameters<typeof assertHorseAccess>[0]["role"] };

/** La incidencia, si este miembro puede verla. */
async function visible(ctx: Ctx, id: string) {
  const row = await findIncident(prisma, ctx.tenantId, id);
  if (!row) throw new TRPCError({ code: "NOT_FOUND" });
  await assertHorseAccess(ctx, row.horseId);
  return row;
}

/**
 * Aplica una transición del motor y la guarda, traduciendo sus errores. Se lee
 * con la fila bloqueada (FOR UPDATE): si dos propietarios confirman a la vez,
 * el segundo ve el acuse del primero y la incidencia pasa a ACKNOWLEDGED.
 */
async function transition(ctx: Ctx, id: string, step: (incident: Incident) => Incident) {
  await visible(ctx, id);
  return withTenant(ctx.tenantId, async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "Incident" WHERE "id" = ${id} AND "tenantId" = ${ctx.tenantId} FOR UPDATE`;
    const row = await findIncident(tx, ctx.tenantId, id);
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    const before = toMotor(row);
    const after = motorStep(() => step(before));
    await saveTransition(tx, before, after);
    for (const u of after.updates.slice(before.updates.length)) {
      await tx.incidentUpdate.create({
        data: { incidentId: id, authorMembershipId: u.authorMembershipId, text: u.text, createdAt: u.at },
      });
    }
    return { id, status: after.status };
  });
}

const MOTOR_ERROR = { NOT_RECIPIENT: "NOT_FOUND", FORBIDDEN: "FORBIDDEN", INVALID_TRANSITION: "BAD_REQUEST" } as const;

function motorStep<T>(step: () => T): T {
  try {
    return step();
  } catch (error) {
    if (error instanceof IncidentError) throw new TRPCError({ code: MOTOR_ERROR[error.code], message: error.code });
    throw error;
  }
}

interface OpenInput {
  horseId: string;
  category?: (typeof CATEGORIES)[number];
  severity?: (typeof SEVERITIES)[number];
  description: string;
  photoKeys: string[];
  clientMutationId?: string;
  /** Incidencia resuelta de la que esta es continuación (`followUp`). */
  follows?: Incident;
}

/**
 * Abre una incidencia (o su continuación) y avisa: a sus propietarios o, si
 * no hay ninguno con cuenta, al centro para que llame. Idempotente por
 * `clientMutationId`, también con dos reintentos a la vez. El email sale
 * después de guardar: si cae, la incidencia queda y la entrega, FAILED.
 */
async function openAndNotify(ctx: Ctx, input: OpenInput): Promise<{ id: string; callOwner: boolean }> {
  const replay = async () => {
    if (!input.clientMutationId) return null;
    const prev = await prisma.incident.findFirst({
      where: { tenantId: ctx.tenantId, clientMutationId: input.clientMutationId },
      select: { id: true, _count: { select: { receipts: true } } },
    });
    return prev ? { id: prev.id, callOwner: prev._count.receipts === 0 } : null;
  };
  const previous = await replay();
  if (previous) return previous;

  if (!input.photoKeys.every((key) => isIncidentPhotoKeyFor({ tenantId: ctx.tenantId, horseId: input.horseId }, key))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "INVALID_PHOTO" });
  }

  let created: { id: string; callOwner: boolean };
  try {
    created = await withTenant(ctx.tenantId, async (tx) => {
      const horse = await tx.horse.findFirst({
        where: { id: input.horseId, tenantId: ctx.tenantId },
        select: { name: true, tenant: { select: { slug: true } } },
      });
      if (!horse) throw new TRPCError({ code: "NOT_FOUND" });

      const owners = await tx.membership.findMany({
        where: { tenantId: ctx.tenantId, role: "OWNER_EXTERNAL", horseAccess: { some: { horseId: input.horseId } } },
        select: { id: true, role: true, userId: true },
      });
      const opening = {
        createdBy: { membershipId: ctx.membershipId, role: ctx.role },
        owners: owners.map((o) => ({ membershipId: o.id, role: o.role })),
        description: input.description,
        at: new Date(),
        ...(input.category ? { category: input.category } : {}),
        ...(input.severity ? { severity: input.severity } : {}),
      };
      const follows = input.follows;
      const { incident, callOwner } = follows
        ? motorStep(() => followUp(follows, opening))
        : openIncident({ ...opening, category: input.category!, severity: input.severity! });

      await tx.incident.create({
        data: {
          id: incident.id,
          tenantId: ctx.tenantId,
          horseId: input.horseId,
          createdByMembershipId: ctx.membershipId,
          category: incident.category,
          severity: incident.severity,
          description: incident.description,
          photoKeys: input.photoKeys,
          status: incident.status,
          occurredAt: incident.occurredAt,
          followsId: incident.followsId,
          clientMutationId: input.clientMutationId ?? null,
          receipts: { create: incident.receipts.map((r) => ({ membershipId: r.membershipId, notifiedAt: r.notifiedAt })) },
        },
      });

      const what = `${INCIDENT_CATEGORY_LABEL[incident.category]} de ${horse.name}`;
      const slug = horse.tenant.slug;
      // Sin propietarios con cuenta nadie la confirmará: el centro tiene que llamar.
      await notify(tx, {
        tenantId: ctx.tenantId,
        userIds: callOwner ? (await centerManagers(tx, ctx.tenantId)).map((m) => m.userId) : owners.map((o) => o.userId),
        kind: "INCIDENT",
        title: callOwner ? `${what}: llama al propietario` : what,
        body: incident.description,
        url: callOwner ? `/${slug}/incidencias` : `/${slug}/portal/incidencias/${incident.id}`,
        dedupeKey: `incident:${incident.id}`,
      });
      return { id: incident.id, callOwner };
    });
  } catch (error) {
    // Dos reintentos a la vez: el segundo choca con el único y devuelve el primero.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await replay();
      if (winner) return winner;
    }
    throw error;
  }
  await deliverIncidentEmails(prisma, { tenantId: ctx.tenantId, dedupeKey: `incident:${created.id}` });
  return created;
}

const byId = z.object({ id: z.string().min(1) });

export const incidentsRouter = createTRPCRouter({
  /** El personal abre una incidencia. Reintentar con el mismo `clientMutationId` no la duplica. */
  create: staffProcedure
    .input(
      z.object({
        horseId: z.string().min(1),
        category: z.enum(CATEGORIES),
        severity: z.enum(SEVERITIES),
        description: z.string().trim().min(1).max(2000),
        photoKeys: z.array(z.string()).max(MAX_PHOTOS).default([]),
        clientMutationId: z.string().uuid().optional(),
      }),
    )
    .mutation(({ ctx, input }) => openAndNotify(ctx, input)),

  /**
   * Una resuelta no se reabre: si el problema vuelve, se abre otra enlazada
   * (`followsId`) del mismo caballo. Hereda tipo y gravedad salvo que se indiquen.
   */
  followUp: staffProcedure
    .input(
      z.object({
        id: z.string().min(1),
        description: z.string().trim().min(1).max(2000),
        category: z.enum(CATEGORIES).optional(),
        severity: z.enum(SEVERITIES).optional(),
        photoKeys: z.array(z.string()).max(MAX_PHOTOS).default([]),
        clientMutationId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await visible(ctx, input.id);
      return openAndNotify(ctx, {
        horseId: row.horseId,
        description: input.description,
        category: input.category,
        severity: input.severity,
        photoKeys: input.photoKeys,
        clientMutationId: input.clientMutationId,
        follows: toMotor(row),
      });
    }),

  /**
   * URL firmada para subir una foto antes de crear la incidencia. La clave cae
   * en la carpeta privada del caballo y del borrador (`draftId`, que el
   * formulario reutiliza como `clientMutationId`).
   */
  photoUploadUrl: staffProcedure
    .input(
      z.object({
        horseId: z.string().min(1),
        draftId: z.string().uuid(),
        contentType: z.string().min(3).max(150),
        sizeBytes: z.number().int().nonnegative(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const horse = await prisma.horse.findFirst({
        where: { id: input.horseId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!horse) throw new TRPCError({ code: "NOT_FOUND" });
      const check = isAllowedUpload("image", input.contentType, input.sizeBytes);
      if (!check.ok) throw new TRPCError({ code: "BAD_REQUEST", message: check.reason === "type" ? "PHOTO_TYPE" : "PHOTO_SIZE" });

      const key = incidentPhotoKey({
        tenantId: ctx.tenantId,
        horseId: horse.id,
        incidentId: input.draftId,
        photoId: randomUUID(),
        ext: check.ext,
      });
      const uploadUrl = await signIncidentPhotoUpload(key, input.contentType);
      if (!uploadUrl) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "STORAGE_NOT_CONFIGURED" });
      return { key, uploadUrl };
    }),

  /** Incidencias del centro (personal) o de sus caballos (propietario), de la más reciente a la más antigua. */
  list: viewerProcedure
    .input(z.object({ status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED"]).optional() }))
    .query(async ({ ctx, input }) => {
      const horseIds = await allowedHorseIds(ctx);
      const isOwner = ctx.role === "OWNER_EXTERNAL";
      const rows = await prisma.incident.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(horseIds ? { horseId: { in: horseIds } } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
        orderBy: { occurredAt: "desc" },
        take: 100,
        select: {
          id: true,
          horseId: true,
          horse: { select: { name: true } },
          category: true,
          severity: true,
          status: true,
          description: true,
          occurredAt: true,
          escalatedAt: true,
          resolvedAt: true,
          receipts: {
            // El propietario solo ve su propio acuse, no el de los copropietarios.
            ...(isOwner ? { where: { membershipId: ctx.membershipId } } : {}),
            select: {
              membershipId: true,
              readAt: true,
              acknowledgedAt: true,
              membership: { select: { user: { select: { name: true } } } },
            },
          },
        },
      });
      return rows.map(({ horse, receipts, ...r }) => ({
        ...r,
        horseName: horse.name,
        receipts: receipts.map(({ membership, ...rc }) => ({ ...rc, name: membership.user.name })),
      }));
    }),

  /** Una incidencia con sus actualizaciones. El propietario solo ve su propio acuse. */
  get: viewerProcedure.input(byId).query(async ({ ctx, input }) => {
    const row = await visible(ctx, input.id);
    const authors = await prisma.membership.findMany({
      where: { id: { in: row.updates.flatMap((u) => (u.authorMembershipId ? [u.authorMembershipId] : [])) } },
      select: { id: true, user: { select: { name: true } } },
    });
    const nameOf = new Map(authors.map((a) => [a.id, a.user.name]));
    const isOwner = ctx.role === "OWNER_EXTERNAL";
    const mine = row.receipts.find((r) => r.membershipId === ctx.membershipId);
    return {
      id: row.id,
      horseId: row.horseId,
      horseName: row.horse.name,
      category: row.category,
      severity: row.severity,
      status: row.status,
      description: row.description,
      occurredAt: row.occurredAt,
      resolvedAt: row.resolvedAt,
      resolutionNote: row.resolutionNote,
      updates: row.updates.map((u) => ({
        text: u.text,
        at: u.createdAt,
        author: u.authorMembershipId ? (nameOf.get(u.authorMembershipId) ?? null) : null,
      })),
      // URLs de lectura que caducan: la clave privada no sale nunca hacia el navegador.
      photos: await Promise.all(row.photoKeys.map(async (key) => ({ url: await incidentPhotoReadUrl(key) }))),
      myReceipt: mine ? { readAt: mine.readAt, acknowledgedAt: mine.acknowledgedAt } : null,
      receipts: isOwner ? [] : row.receipts.map((r) => ({ readAt: r.readAt, acknowledgedAt: r.acknowledgedAt })),
    };
  }),

  /** Abrirla la marca leída para ese propietario. Al personal no le deja acuse. */
  markRead: viewerProcedure.input(byId).mutation(({ ctx, input }) =>
    transition(ctx, input.id, (i) => markRead(i, ctx.membershipId, new Date())),
  ),

  acknowledge: ownerProcedure.input(byId).mutation(({ ctx, input }) =>
    transition(ctx, input.id, (i) => acknowledge(i, ctx.membershipId, new Date())),
  ),

  resolve: staffProcedure
    .input(z.object({ id: z.string().min(1), note: z.string().trim().min(1).max(1000) }))
    .mutation(({ ctx, input }) =>
      transition(ctx, input.id, (i) =>
        resolve(i, { membershipId: ctx.membershipId, role: ctx.role }, new Date(), input.note),
      ),
    ),

  /** Corrección o seguimiento con autor y hora: la descripción no se edita. */
  addUpdate: viewerProcedure
    .input(z.object({ id: z.string().min(1), text: z.string().trim().min(1).max(2000) }))
    .mutation(({ ctx, input }) =>
      transition(ctx, input.id, (i) =>
        addUpdate(i, { membershipId: ctx.membershipId, role: ctx.role }, input.text, new Date()),
      ),
    ),
});
