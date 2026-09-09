"use server";

import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("onboarding.serverErrors");

  const session = await auth();
  if (!session?.user) return { error: t("unauthorized") };

  const data = schema.safeParse(input);
  if (!data.success) return { error: t("invalid") };

  const { name, slug, province, nif } = data.data;

  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) return { error: t("slugTaken") };

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
