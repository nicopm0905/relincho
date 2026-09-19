"use server";

import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import {
  ATTRIBUTION_REFERRER_COOKIE,
  ATTRIBUTION_SOURCE_COOKIE,
  normalizeSource,
  referrerHost,
} from "@/lib/attribution";
import { logEvent } from "@/lib/observability";
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

  // El canal se lee de la cookie que dejo el middleware en la primera visita:
  // asi el QR de una feria sigue contando semanas despues.
  const jar = await cookies();
  const acquisitionSource = normalizeSource(
    jar.get(ATTRIBUTION_SOURCE_COOKIE)?.value,
  );
  const acquisitionReferrer = referrerHost(
    jar.get(ATTRIBUTION_REFERRER_COOKIE)?.value,
  );

  const tenant = await prisma.tenant.create({
    data: {
      name,
      slug,
      province,
      nif,
      acquisitionSource,
      acquisitionReferrer,
      memberships: {
        create: {
          userId: session.user.id,
          role: "OWNER",
        },
      },
    },
  });

  logEvent("tenant.created", {
    tenantId: tenant.id,
    slug,
    source: acquisitionSource ?? "directo",
    referrer: acquisitionReferrer,
  });

  return { tenant };
}
