import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../init";
import { prisma } from "@/server/db/prisma";
import { DEFAULT_PREFERENCE } from "@/lib/notify-channels";

const KINDS = ["HEALTH_DUE", "INCIDENT", "INCIDENT_ESCALATION", "ANNOUNCEMENT", "VISIT", "BOOKING", "INVOICE", "STOCK"] as const;

/**
 * Suscripciones push y preferencias de aviso (E4). Son del usuario, no del
 * centro (D1): cualquier rol con sesión, y toda consulta lleva su `userId`.
 */
export const notificationsRouter = createTRPCRouter({
  /** Idempotente por endpoint: el mismo navegador actualiza su fila (y pasa al usuario que inició sesión). */
  subscribe: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url().max(2000),
        keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
        userAgent: z.string().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const data = {
        userId: ctx.user.id,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
        failedCount: 0,
      };
      await prisma.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        create: { endpoint: input.endpoint, ...data },
        update: data,
      });
      return { ok: true };
    }),

  /** Solo borra la suscripción si es de este usuario. */
  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string().max(2000) }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await prisma.pushSubscription.deleteMany({
        where: { endpoint: input.endpoint, userId: ctx.user.id },
      });
      return { removed: count };
    }),

  /** Las de cada tipo; sin fila, las de por defecto. */
  preferences: protectedProcedure.query(async ({ ctx }) => {
    const rows = await prisma.notificationPreference.findMany({
      where: { userId: ctx.user.id },
      select: { kind: true, push: true, email: true },
    });
    return KINDS.map((kind) => rows.find((r) => r.kind === kind) ?? { kind, ...DEFAULT_PREFERENCE });
  }),

  setPreference: protectedProcedure
    .input(z.object({ kind: z.enum(KINDS), push: z.boolean(), email: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.notificationPreference.upsert({
        where: { userId_kind: { userId: ctx.user.id, kind: input.kind } },
        create: { userId: ctx.user.id, ...input },
        update: { push: input.push, email: input.email },
      });
      return { ok: true };
    }),
});
