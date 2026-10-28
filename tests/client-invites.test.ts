import { test } from "node:test";
import assert from "node:assert/strict";

import { planClientInvites, type InviteContact, type ExistingMember } from "@/lib/client-invites";

const contact = (o: Partial<InviteContact> & { id: string }): InviteContact => ({
  kind: "CLIENT",
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

test("un contacto cliente sin caballos se salta con NO_HORSES", () => {
  const plan = planClientInvites([contact({ id: "sin-caballos", name: "Sin Caballos" })], []);

  assert.deepEqual(plan.invitations, []);
  assert.deepEqual(plan.skipped, [{ contactId: "sin-caballos", name: "Sin Caballos", reason: "NO_HORSES" }]);
});

test("un contacto veterinario o herrador se invita como PROFESSIONAL con su especialidad", () => {
  const plan = planClientInvites(
    [
      contact({ id: "vet", kind: "VET" }),
      contact({ id: "herrador", kind: "FARRIER", email: "Herrador@Test.local" }),
    ],
    [],
  );

  assert.deepEqual(plan.invitations, []);
  assert.deepEqual(plan.professionalInvitations, [
    { email: "vet@test.local", contactIds: ["vet"], specialty: "VET" },
    { email: "herrador@test.local", contactIds: ["herrador"], specialty: "FARRIER" },
  ]);
  assert.deepEqual(plan.skipped, []);
});

test("un proveedor no se invita a la app (NOT_INVITABLE)", () => {
  const plan = planClientInvites([contact({ id: "pienso", name: "Piensos SL", kind: "SUPPLIER", horseIds: ["lucero"] })], []);

  assert.deepEqual(plan.invitations, []);
  assert.deepEqual(plan.professionalInvitations, []);
  assert.deepEqual(plan.skipped, [{ contactId: "pienso", name: "Piensos SL", reason: "NOT_INVITABLE" }]);
});

test("un profesional que ya es miembro no recibe otra invitación", () => {
  const members: ExistingMember[] = [
    { membershipId: "m-vet", email: "vet@test.local", role: "PROFESSIONAL", horseIds: [] },
  ];
  const plan = planClientInvites([contact({ id: "vet", kind: "VET" })], members);

  assert.deepEqual(plan.professionalInvitations, []);
  assert.deepEqual(plan.grants, []);
  assert.deepEqual(plan.skipped, [{ contactId: "vet", name: "Contacto vet", reason: "ALREADY_MEMBER" }]);
});
