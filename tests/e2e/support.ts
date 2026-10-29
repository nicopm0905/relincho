import { randomUUID } from "node:crypto";
import type { BrowserContext } from "@playwright/test";
import { PrismaClient, type ProfessionalSpecialty, type Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { encode } from "next-auth/jwt";

import { E2E_AUTH_SECRET, E2E_BASE_URL, E2E_DATABASE_URL, SESSION_COOKIE, assertLocalDatabase } from "./env";

/**
 * Apoyo del E2E: BD de siembra y sesión firmada. No usa `@/server/db/prisma`
 * (es `server-only`) sino un cliente propio contra la misma BD que la app.
 */
assertLocalDatabase(E2E_DATABASE_URL);
export const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: E2E_DATABASE_URL }) });

export interface E2EUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Entra como `user` sin pasar por el login: firma el mismo JWT de sesión que
 * emite Auth.js (salt = nombre de la cookie) con el AUTH_SECRET de la app de
 * test. El callback `session` solo lee `token.sub` como id del usuario.
 */
export async function loginAs(context: BrowserContext, user: E2EUser): Promise<void> {
  await context.clearCookies();
  const value = await encode({
    token: { sub: user.id, email: user.email, name: user.name },
    secret: E2E_AUTH_SECRET,
    salt: SESSION_COOKIE,
    maxAge: 60 * 60,
  });
  await context.addCookies([
    { name: SESSION_COOKIE, value, url: E2E_BASE_URL, httpOnly: true, sameSite: "Lax" },
  ]);
}

const DAY_MS = 86_400_000;

/** Hoy en Madrid a mediodía UTC (13:00 o 14:00 en Madrid: mismo día), más `days`. */
export function madridDayAtNoon(days = 0): Date {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
  return new Date(new Date(`${today}T12:00:00Z`).getTime() + days * DAY_MS);
}

/**
 * Un centro del piloto, con datos inventados y slug único por llamada (no hace
 * falta vaciar la BD entre tests):
 *  - Lucero: de la propietaria, con su herrador y su veterinaria; su vacuna
 *    de la gripe vence dentro de 7 días.
 *  - Tormenta: de otro cliente del centro, que la propietaria no debe ver.
 */
export async function seedPilotCenter() {
  const id = randomUUID().slice(0, 8);
  const tenant = await db.tenant.create({
    data: { slug: `e2e-${id}`, name: `Centro Hípico E2E ${id}` },
    select: { id: true, slug: true },
  });

  const member = async (key: string, name: string, role: Role, specialty: ProfessionalSpecialty | null = null) => {
    const user = await db.user.create({ data: { email: `${key}-${id}@relincho.test`, name } });
    const m = await db.membership.create({ data: { userId: user.id, tenantId: tenant.id, role, specialty } });
    return { id: user.id, email: user.email, name, membershipId: m.id };
  };
  const owner = await member("centro", "Carmen Centro", "OWNER");
  const propietaria = await member("propietaria", "Lucía Propietaria", "OWNER_EXTERNAL");
  const otroCliente = await member("cliente", "Andrés Cliente", "OWNER_EXTERNAL");
  const herrador = await member("herrador", "Paco Herrador", "PROFESSIONAL", "FARRIER");
  const veterinaria = await member("veterinaria", "Elena Veterinaria", "PROFESSIONAL", "VET");

  const lucero = await db.horse.create({ data: { tenantId: tenant.id, name: "Lucero", sex: "MALE" } });
  const tormenta = await db.horse.create({ data: { tenantId: tenant.id, name: "Tormenta", sex: "FEMALE" } });
  await db.horseAccess.createMany({
    data: [
      { horseId: lucero.id, membershipId: propietaria.membershipId },
      { horseId: lucero.id, membershipId: herrador.membershipId },
      { horseId: lucero.id, membershipId: veterinaria.membershipId },
      { horseId: tormenta.id, membershipId: otroCliente.membershipId },
    ],
  });
  await db.healthEvent.create({
    data: {
      tenantId: tenant.id,
      horseId: lucero.id,
      type: "VACCINE",
      name: "Gripe equina",
      date: madridDayAtNoon(-358),
      nextDueDate: madridDayAtNoon(7),
    },
  });

  return { tenant, owner, propietaria, otroCliente, herrador, veterinaria, lucero, tormenta };
}
