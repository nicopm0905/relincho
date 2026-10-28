import type { Role } from "@prisma/client";
import type { FakeMember } from "./trpc";

export interface TestTenant {
  id: string;
  slug: string;
}

export type TestMember = Required<Pick<FakeMember, "userId" | "tenantId" | "membershipId" | "role">>;

export async function makeTenant(): Promise<TestTenant> {
  throw new Error("no implementado");
}

export async function makeMember(_tenant: TestTenant, _role: Role): Promise<TestMember> {
  throw new Error("no implementado");
}

export async function makeHorse(
  _tenant: TestTenant,
  _data: { name?: string } = {},
): Promise<{ id: string; name: string }> {
  throw new Error("no implementado");
}

export async function grantAccess(_member: TestMember, _horse: { id: string }): Promise<void> {
  throw new Error("no implementado");
}

export async function closeDb(): Promise<void> {}
