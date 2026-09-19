import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Role } from "@prisma/client";
import { createTRPCRouter, roleProcedure } from "../init";
import { prisma, withTenant } from "@/server/db/prisma";
import { sendTeamInvite } from "@/server/services/notifications/email";
import { getBaseUrl } from "@/lib/utils";
import { reportError } from "@/lib/observability";

/** Toda la gestion de equipo esta restringida al propietario. */
const ownerProcedure = roleProcedure("OWNER");

export const membersRouter = createTRPCRouter({
  list: ownerProcedure.query(async ({ ctx }) => {
    const memberships = await prisma.membership.findMany({
      where: { tenantId: ctx.tenantId },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, email: true, name: true } },
        horseAccess: { select: { horseId: true } },
      },
      orderBy: { role: "asc" },
    });

    return memberships.map((m) => ({
      membershipId: m.id,
      role: m.role,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      horseIds: m.horseAccess.map((h) => h.horseId),
    }));
  }),

  invite: ownerProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.nativeEnum(Role),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email.trim().toLowerCase();

      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({ data: { email } });
      }

      const existing = await prisma.membership.findUnique({
        where: { userId_tenantId: { userId: user.id, tenantId: ctx.tenantId } },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ese usuario ya forma parte del equipo.",
        });
      }

      const membership = await prisma.membership.create({
        data: { userId: user.id, tenantId: ctx.tenantId, role: input.role },
      });

      const tenant = await prisma.tenant.findUnique({
        where: { id: ctx.tenantId },
        select: { name: true, slug: true },
      });

      // La invitacion queda creada aunque el email falle; se puede reenviar.
      // `sendTeamInvite` no lanza, devuelve el resultado, asi que hay que
      // mirarlo para enterarse de que el aviso no salio.
      const sent = await sendTeamInvite({
        to: email,
        tenantName: tenant?.name ?? "Relincho",
        inviterName: ctx.user.name ?? ctx.user.email ?? null,
        url: `${getBaseUrl()}/login?callbackUrl=${encodeURIComponent(
          `/${tenant?.slug ?? ""}`,
        )}`,
      });
      if (!sent.ok && !sent.skipped) {
        await reportError(sent.error, {
          scope: "members.invite",
          tenantId: ctx.tenantId,
        });
      }

      return { membershipId: membership.id };
    }),

  updateRole: ownerProcedure
    .input(
      z.object({
        membershipId: z.string().uuid(),
        role: z.nativeEnum(Role),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const target = await prisma.membership.findFirst({
        where: { id: input.membershipId, tenantId: ctx.tenantId },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });

      if (target.role === Role.OWNER && input.role !== Role.OWNER) {
        const owners = await prisma.membership.count({
          where: { tenantId: ctx.tenantId, role: Role.OWNER },
        });
        if (owners <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Debe quedar al menos un propietario.",
          });
        }
      }

      return prisma.membership.update({
        where: { id: input.membershipId },
        data: { role: input.role },
      });
    }),

  remove: ownerProcedure
    .input(z.object({ membershipId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const target = await prisma.membership.findFirst({
        where: { id: input.membershipId, tenantId: ctx.tenantId },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });

      if (target.role === Role.OWNER) {
        const owners = await prisma.membership.count({
          where: { tenantId: ctx.tenantId, role: Role.OWNER },
        });
        if (owners <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No puedes eliminar al único propietario.",
          });
        }
      }

      await prisma.membership.delete({ where: { id: input.membershipId } });
      return { ok: true };
    }),

  grantHorseAccess: ownerProcedure
    .input(
      z.object({
        membershipId: z.string().uuid(),
        horseId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const membership = await prisma.membership.findFirst({
        where: { id: input.membershipId, tenantId: ctx.tenantId },
      });
      if (!membership) throw new TRPCError({ code: "NOT_FOUND" });

      const horse = await withTenant(ctx.tenantId, (tx) =>
        tx.horse.findFirst({
          where: { id: input.horseId, tenantId: ctx.tenantId },
          select: { id: true },
        }),
      );
      if (!horse) throw new TRPCError({ code: "NOT_FOUND" });

      return prisma.horseAccess.upsert({
        where: {
          horseId_membershipId: {
            horseId: input.horseId,
            membershipId: input.membershipId,
          },
        },
        create: {
          horseId: input.horseId,
          membershipId: input.membershipId,
        },
        update: {},
      });
    }),

  revokeHorseAccess: ownerProcedure
    .input(
      z.object({
        membershipId: z.string().uuid(),
        horseId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.horseAccess.deleteMany({
        where: {
          membershipId: input.membershipId,
          horseId: input.horseId,
          membership: { tenantId: ctx.tenantId },
        },
      });
      return { ok: true };
    }),
});
