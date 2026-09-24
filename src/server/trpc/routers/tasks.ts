import { z } from "zod";
import { createTRPCRouter, tenantProcedure, roleProcedure, staffProcedure } from "../init";
import { horseScope } from "../access";
import { withTenant, type PrismaClient } from "@/server/db/prisma";
import { TRPCError } from "@trpc/server";

const dailyProcedure = roleProcedure("OWNER", "MANAGER", "GROOM");
const managerProcedure = roleProcedure("OWNER", "MANAGER");

const taskInput = z.object({
  title: z.string().trim().min(1).max(200),
  dueDate: z.date(),
  horseId: z.string().uuid().optional(),
  assigneeMembershipId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

/**
 * `Task` guarda caballo y persona como ids sueltos, sin FK: sin esta
 * comprobacion se podria colgar una tarea de un caballo o miembro de otra
 * yeguada.
 */
async function assertTaskRefs(
  tx: PrismaClient,
  tenantId: string,
  refs: { horseId?: string | null; assigneeMembershipId?: string | null },
) {
  if (refs.horseId) {
    const horse = await tx.horse.count({ where: { id: refs.horseId, tenantId } });
    if (!horse) throw new TRPCError({ code: "NOT_FOUND", message: "Caballo no encontrado" });
  }
  if (refs.assigneeMembershipId) {
    const member = await tx.membership.count({
      where: {
        id: refs.assigneeMembershipId,
        tenantId,
        role: { in: ["OWNER", "MANAGER", "GROOM"] },
      },
    });
    if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Persona no encontrada" });
  }
}

export const tasksRouter = createTRPCRouter({
  list: tenantProcedure
    .input(
      z
        .object({
          done: z.boolean().optional(),
          horseId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      // Un externo solo ve las tareas de sus caballos (las generales, no).
      const scope = await horseScope(ctx);
      return withTenant(ctx.tenantId, async (tx) => {
        const tasks = await tx.task.findMany({
          where: {
            tenantId: ctx.tenantId,
            ...(input?.done !== undefined
              ? { doneAt: input.done ? { not: null } : null }
              : {}),
            ...(input?.horseId ? { horseId: input.horseId } : {}),
            ...scope,
          },
          select: {
            id: true,
            title: true,
            dueDate: true,
            doneAt: true,
            notes: true,
            horseId: true,
            assigneeMembershipId: true,
          },
          orderBy: { dueDate: "asc" },
        });

        // `Task` no tiene relaciones declaradas: los nombres se resuelven aparte
        // en dos consultas, no una por tarea.
        const horseIds = [...new Set(tasks.flatMap((t) => (t.horseId ? [t.horseId] : [])))];
        const memberIds = [
          ...new Set(tasks.flatMap((t) => (t.assigneeMembershipId ? [t.assigneeMembershipId] : []))),
        ];
        const horses = horseIds.length
          ? await tx.horse.findMany({
              where: { tenantId: ctx.tenantId, id: { in: horseIds } },
              select: { id: true, name: true },
            })
          : [];
        const members = memberIds.length
          ? await tx.membership.findMany({
              where: { tenantId: ctx.tenantId, id: { in: memberIds } },
              select: { id: true, user: { select: { name: true, email: true } } },
            })
          : [];
        const horseName = new Map(horses.map((h) => [h.id, h.name]));
        const memberName = new Map(
          members.map((m) => [m.id, m.user.name ?? m.user.email ?? "Sin nombre"]),
        );

        return tasks.map((t) => ({
          ...t,
          horseName: t.horseId ? (horseName.get(t.horseId) ?? null) : null,
          assigneeName: t.assigneeMembershipId
            ? (memberName.get(t.assigneeMembershipId) ?? null)
            : null,
        }));
      });
    }),

  /** Personal al que se le puede asignar una tarea (los externos, no). */
  assignees: staffProcedure.query(async ({ ctx }) => {
    return withTenant(ctx.tenantId, async (tx) => {
      const members = await tx.membership.findMany({
        where: { tenantId: ctx.tenantId, role: { in: ["OWNER", "MANAGER", "GROOM"] } },
        select: { id: true, user: { select: { name: true, email: true } } },
      });
      return members
        .map((m) => ({ id: m.id, name: m.user.name ?? m.user.email ?? "Sin nombre" }))
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
    });
  }),

  create: dailyProcedure
    .input(taskInput)
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        await assertTaskRefs(tx, ctx.tenantId, input);
        return tx.task.create({ data: { ...input, tenantId: ctx.tenantId } });
      });
    }),

  update: dailyProcedure
    .input(
      taskInput
        .partial()
        .extend({
          id: z.string().uuid(),
          // `null` quita el caballo o la asignacion.
          horseId: z.string().uuid().nullish(),
          assigneeMembershipId: z.string().uuid().nullish(),
          notes: z.string().nullish(),
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.tenantId, async (tx) => {
        await assertTaskRefs(tx, ctx.tenantId, data);
        return tx.task.update({ where: { id, tenantId: ctx.tenantId }, data });
      });
    }),

  complete: dailyProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.task.update({
          where: { id: input.id, tenantId: ctx.tenantId },
          data: { doneAt: new Date() },
        }),
      );
    }),

  /** Deshacer un "hecho" pulsado sin querer. */
  reopen: dailyProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.task.update({
          where: { id: input.id, tenantId: ctx.tenantId },
          data: { doneAt: null },
        }),
      );
    }),

  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await withTenant(ctx.tenantId, (tx) =>
        tx.task.delete({ where: { id: input.id, tenantId: ctx.tenantId } }),
      );
    }),
});
