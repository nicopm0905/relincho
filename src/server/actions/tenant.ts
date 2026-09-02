"use server";

import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
  province: z.string().optional(),
  nif: z.string().optional(),
});

export async function createTenantAction(input: z.infer<typeof schema>) {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const data = schema.safeParse(input);
  if (!data.success) return { error: "Datos inválidos" };

  const { name, slug, province, nif } = data.data;

  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) return { error: "Este identificador ya está en uso" };

  const tenant = await prisma.tenant.create({
    data: {
      name,
      slug,
      province,
      nif,
      memberships: {
        create: {
          userId: session.user.id,
          role: "OWNER",
        },
      },
    },
  });

  return { tenant };
}
