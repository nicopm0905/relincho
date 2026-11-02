import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";

import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";
import { prisma } from "@/server/db/prisma";
import { closeDb, grantAccess, makeHorse, makeMember, makeTenant } from "../helpers/factories";
import { callerAs } from "../helpers/trpc";

const createCaller = createCallerFactory(appRouter);
after(closeDb);

async function rejectsWith(promise: Promise<unknown>, code: TRPCError["code"]) {
  await assert.rejects(promise, (err: unknown) => {
    assert.ok(err instanceof TRPCError, `esperaba TRPCError, llegó ${String(err)}`);
    assert.equal(err.code, code);
    return true;
  });
}

test("incidents.photoUploadUrl firma una clave privada de ese caballo que luego acepta incidents.create", async () => {
  const t = await makeTenant();
  const mozo = await makeMember(t, "GROOM");
  const lucero = await makeHorse(t);
  const draftId = randomUUID();
  const staff = callerAs(createCaller, mozo);

  const signed = await staff.incidents.photoUploadUrl({
    horseId: lucero.id,
    draftId,
    contentType: "image/jpeg",
    sizeBytes: 200_000,
  });
  assert.match(signed.key, new RegExp(`^${t.id}/incidents/${lucero.id}/${draftId}/[0-9a-f-]+\\.jpg$`));
  assert.ok(signed.uploadUrl.length > 0);

  const { id } = await staff.incidents.create({
    horseId: lucero.id,
    category: "INJURY",
    severity: "MEDIUM",
    description: "Herida en el corvejón",
    photoKeys: [signed.key],
    clientMutationId: draftId,
  });
  assert.deepEqual((await prisma.incident.findUniqueOrThrow({ where: { id } })).photoKeys, [signed.key]);
});

test("incidents.photoUploadUrl rechaza un caballo de otro centro (NOT_FOUND) y lo que no es una imagen (BAD_REQUEST)", async () => {
  const t = await makeTenant();
  const otro = await makeTenant();
  const mozo = await makeMember(t, "GROOM");
  const lucero = await makeHorse(t);
  const ajeno = await makeHorse(otro);
  const staff = callerAs(createCaller, mozo);
  const base = { draftId: randomUUID(), sizeBytes: 1000 };

  await rejectsWith(staff.incidents.photoUploadUrl({ ...base, horseId: ajeno.id, contentType: "image/jpeg" }), "NOT_FOUND");
  await rejectsWith(staff.incidents.photoUploadUrl({ ...base, horseId: lucero.id, contentType: "application/pdf" }), "BAD_REQUEST");
});

test("incidents.get devuelve al propietario una URL de lectura por cada foto", async () => {
  const t = await makeTenant();
  const mozo = await makeMember(t, "GROOM");
  const propietaria = await makeMember(t, "OWNER_EXTERNAL");
  const lucero = await makeHorse(t);
  await grantAccess(propietaria, lucero);
  const draftId = randomUUID();
  const keys = [1, 2].map((n) => `${t.id}/incidents/${lucero.id}/${draftId}/foto-${n}.jpg`);
  const { id } = await callerAs(createCaller, mozo).incidents.create({
    horseId: lucero.id,
    category: "EQUIPMENT",
    severity: "LOW",
    description: "Manta rota",
    photoKeys: keys,
  });

  const got = await callerAs(createCaller, propietaria).incidents.get({ id });
  assert.equal(got.photos.length, 2);
  keys.forEach((key, n) => assert.ok(got.photos[n].url.includes(key), got.photos[n].url));
});

test("una incidencia resuelta no se reabre: followUp abre otra enlazada y vuelve a avisar al propietario", async () => {
  const t = await makeTenant();
  const mozo = await makeMember(t, "GROOM");
  const propietaria = await makeMember(t, "OWNER_EXTERNAL");
  const lucero = await makeHorse(t);
  await grantAccess(propietaria, lucero);
  const staff = callerAs(createCaller, mozo);
  const first = await staff.incidents.create({ horseId: lucero.id, category: "LAMENESS", severity: "MEDIUM", description: "Cojea" });
  await staff.incidents.resolve({ id: first.id, note: "Herrado de nuevo" });

  const next = await staff.incidents.followUp({ id: first.id, description: "Vuelve a cojear" });

  const saved = await prisma.incident.findUniqueOrThrow({ where: { id: next.id }, include: { receipts: true } });
  assert.equal(saved.followsId, first.id);
  assert.equal(saved.status, "OPEN");
  assert.equal(saved.category, "LAMENESS");
  assert.equal(saved.horseId, lucero.id);
  assert.deepEqual(saved.receipts.map((r) => r.membershipId), [propietaria.membershipId]);
  assert.equal((await prisma.incident.findUniqueOrThrow({ where: { id: first.id } })).status, "RESOLVED");
  assert.equal(
    await prisma.notification.count({ where: { userId: propietaria.userId, kind: "INCIDENT" } }),
    2,
  );
});

test("followUp de una incidencia sin resolver responde BAD_REQUEST", async () => {
  const t = await makeTenant();
  const mozo = await makeMember(t, "GROOM");
  const lucero = await makeHorse(t);
  const staff = callerAs(createCaller, mozo);
  const open = await staff.incidents.create({ horseId: lucero.id, category: "LAMENESS", severity: "MEDIUM", description: "Cojea" });

  await rejectsWith(staff.incidents.followUp({ id: open.id, description: "Sigue igual" }), "BAD_REQUEST");
});
