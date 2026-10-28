import { test } from "node:test";
import assert from "node:assert/strict";

import { planClientInvites, type InviteContact, type ExistingMember } from "@/lib/client-invites";

const contact = (o: Partial<InviteContact> & { id: string }): InviteContact => ({
  name: `Contacto ${o.id}`,
  email: `${o.id}@test.local`,
  horseIds: [],
  ...o,
});

test("un contacto propietario de dos caballos genera una invitación con los dos caballos", () => {
  const plan = planClientInvites([contact({ id: "ana", horseIds: ["lucero", "tormenta"] })], []);

  assert.deepEqual(plan.invitations, [
    { email: "ana@test.local", contactIds: ["ana"], horseIds: ["lucero", "tormenta"] },
  ]);
  assert.deepEqual(plan.grants, []);
  assert.deepEqual(plan.skipped, []);
});

test("un contacto sin email se salta y se informa del motivo", () => {
  const plan = planClientInvites(
    [
      contact({ id: "sin", name: "Sin Email", email: null, horseIds: ["lucero"] }),
      contact({ id: "blanco", name: "En Blanco", email: "   ", horseIds: ["tormenta"] }),
    ],
    [],
  );

  assert.deepEqual(plan.invitations, []);
  assert.deepEqual(plan.skipped, [
    { contactId: "sin", name: "Sin Email", reason: "NO_EMAIL" },
    { contactId: "blanco", name: "En Blanco", reason: "NO_EMAIL" },
  ]);
});

test("si el email ya es miembro, solo añade el HorseAccess que falta y no reenvía la invitación", () => {
  const members: ExistingMember[] = [
    { membershipId: "m-ana", email: "ana@test.local", role: "OWNER_EXTERNAL", horseIds: ["lucero"] },
  ];
  const plan = planClientInvites([contact({ id: "ana", horseIds: ["lucero", "tormenta"] })], members);

  assert.deepEqual(plan.invitations, []);
  assert.deepEqual(plan.grants, [
    { membershipId: "m-ana", email: "ana@test.local", horseIds: ["tormenta"] },
  ]);
});

test("dos contactos con el mismo email en distinta capitalización se agrupan en una invitación", () => {
  const plan = planClientInvites(
    [
      contact({ id: "ana-1", email: "Ana@Test.local", horseIds: ["lucero"] }),
      contact({ id: "ana-2", email: " ana@test.LOCAL ", horseIds: ["tormenta", "lucero"] }),
    ],
    [],
  );

  assert.deepEqual(plan.invitations, [
    { email: "ana@test.local", contactIds: ["ana-1", "ana-2"], horseIds: ["lucero", "tormenta"] },
  ]);
});

test("un miembro del personal no recibe HorseAccess: ya ve toda la cuadra", () => {
  const members: ExistingMember[] = [
    { membershipId: "m-dueno", email: "dueno@test.local", role: "OWNER", horseIds: [] },
  ];
  const plan = planClientInvites(
    [contact({ id: "dueno", name: "Dueño", horseIds: ["lucero"] })],
    members,
  );

  assert.deepEqual(plan.invitations, []);
  assert.deepEqual(plan.grants, []);
  assert.deepEqual(plan.skipped, [{ contactId: "dueno", name: "Dueño", reason: "STAFF" }]);
});
