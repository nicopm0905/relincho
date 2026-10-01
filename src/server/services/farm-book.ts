import "server-only";
import type { PrismaClient } from "@prisma/client";
import { inSequence } from "@/server/db/prisma";
import {
  averageCensus,
  censusAt,
  complianceAlerts,
  isAndalusia,
  missingMovementFields,
  resolveCause,
  withRunningBalance,
  type AlertMovement,
  type Direction,
  type HorseSex,
} from "@/lib/farm-book";

/**
 * Todo lo que necesita el libro de explotación (pantalla y PDF) en una sola
 * carga: datos de la explotación, animales, movimientos con su causa y
 * balance, incidencias, inspecciones, cuidadores, censo y avisos.
 */
export async function loadFarmBook(tx: PrismaClient, tenantId: string, now: Date = new Date()) {
  const [tenant, settings, horses, movements, incidents, inspections, caretakers] = await inSequence([
    () =>
      tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: {
          name: true,
          fiscalName: true,
          nif: true,
          regaCode: true,
          address: true,
          city: true,
          province: true,
          postalCode: true,
          country: true,
        },
      }),
    () => tx.farmBookSettings.findUnique({ where: { tenantId } }),
    () =>
      tx.horse.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          sex: true,
          species: true,
          breed: true,
          birthDate: true,
          uelnCode: true,
          microchip: true,
          status: true,
          owner: { select: { name: true } },
        },
        orderBy: { name: "asc" },
      }),
    () =>
      tx.movement.findMany({
        where: { tenantId },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
    () =>
      tx.identificationIncident.findMany({
        where: { tenantId },
        include: { horse: { select: { id: true, name: true } } },
        orderBy: { date: "asc" },
      }),
    () => tx.farmInspection.findMany({ where: { tenantId }, orderBy: { date: "asc" } }),
    () => tx.farmCaretaker.findMany({ where: { tenantId }, orderBy: [{ endDate: "desc" }, { name: "asc" }] }),
  ]);

  const bookMovements = movements.map((m) => {
    const { cause, inferred } = resolveCause({
      direction: m.direction,
      cause: m.cause,
      reason: m.reason,
    });
    return {
      ...m,
      direction: m.direction as Direction,
      cause,
      inferred,
      missing: missingMovementFields({ ...m, direction: m.direction as Direction, cause }),
    };
  });

  const bookHorses = horses.map((h) => ({ ...h, sex: h.sex as HorseSex }));
  const rows = withRunningBalance(bookMovements, bookHorses);

  const year = now.getUTCFullYear();
  const lastYearEnd = new Date(Date.UTC(year - 1, 11, 31, 12));
  const farm = {
    regaCode: tenant.regaCode,
    holderName: tenant.fiscalName || tenant.name,
    nif: tenant.nif,
    address: settings?.farmAddress || tenant.address,
    city: settings?.farmMunicipality || tenant.city,
    province: settings?.farmProvince || tenant.province,
  };

  const alerts = complianceAlerts({
    farm,
    horses: bookHorses,
    movements: bookMovements as AlertMovement[],
    now,
  });

  return {
    tenant,
    settings,
    farm,
    andalusia: isAndalusia(farm.province, farm.regaCode),
    horses: bookHorses,
    rows,
    incidents,
    inspections,
    caretakers,
    alerts,
    census: {
      today: censusAt(bookMovements, bookHorses, now),
      lastYearEnd: censusAt(bookMovements, bookHorses, lastYearEnd),
      lastYearAverage: averageCensus(bookMovements, year - 1),
      lastYear: year - 1,
    },
    horsesWithoutEntry: bookHorses.filter(
      (h) => !movements.some((m) => m.horseId === h.id) && h.status !== "SOLD" && h.status !== "DEAD",
    ),
  };
}

export type FarmBook = Awaited<ReturnType<typeof loadFarmBook>>;
