import { randomUUID } from "node:crypto";
import type { Role } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { FakeMember } from "./trpc";

/**
 * Factorías para tests de integración (roadmap §1.3). Cada test crea su propio
 * tenant con slug aleatorio, así que no hace falta vaciar tablas entre tests.
 * Solo funcionan contra la BD de tests: `scripts/test-db.mjs test` fija
 * DATABASE_URL a una BD local y se niega a usar otra.
 */
const local = /@(localhost|127\.0\.0\.1):/.test(process.env.DATABASE_URL ?? "");
if (!local) {
  throw new Error("factories: DATABASE_URL no es una BD local. Usa `npm run check:int`.");
}

export interface TestTenant {
  id: string;
  slug: string;
}

export type TestMember = Required<Pick<FakeMember, "userId" | "tenantId" | "membershipId" | "role">>;

const uid = () => randomUUID().slice(0, 8);

export async function makeTenant(): Promise<TestTenant> {
  const slug = `test-${uid()}`;
  return prisma.tenant.create({ data: { slug, name: `Centro ${slug}` }, select: { id: true, slug: true } });
}

export async function makeMember(tenant: TestTenant, role: Role): Promise<TestMember> {
  const user = await prisma.user.create({ data: { email: `${uid()}@test.local`, name: "Test" } });
  const m = await prisma.membership.create({ data: { userId: user.id, tenantId: tenant.id, role } });
  return { userId: user.id, tenantId: tenant.id, membershipId: m.id, role };
}

export async function makeHorse(
  tenant: TestTenant,
  data: { name?: string } = {},
): Promise<{ id: string; name: string }> {
  return prisma.horse.create({
    data: { tenantId: tenant.id, name: data.name ?? `Caballo ${uid()}`, sex: "MALE" },
    select: { id: true, name: true },
  });
}

export async function grantAccess(member: TestMember, horse: { id: string }): Promise<void> {
  await prisma.horseAccess.create({ data: { membershipId: member.membershipId, horseId: horse.id } });
}

/** Cierra la conexión para que el proceso de test pueda terminar. */
export async function closeDb(): Promise<void> {
  await prisma.$disconnect();
}
