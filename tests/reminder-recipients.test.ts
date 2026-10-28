import { test } from "node:test";
import assert from "node:assert/strict";

import {
  dueReminders,
  recipientsFor,
  reminderDedupeKey,
  type ReminderMember,
} from "@/lib/reminder-recipients";
import { HEALTH_EVENT_TYPES, PROFESSIONAL_SPECIALTIES, canRecordHealthEvent } from "@/lib/permissions";

const now = new Date("2026-11-02T08:00:00Z");
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000);

const HORSE = "horse-lucero";
const member = (m: Partial<ReminderMember> & Pick<ReminderMember, "userId" | "role">): ReminderMember => ({
  email: `${m.userId}@test.local`,
  specialty: null,
  horseIds: [],
  ...m,
});

const centro = member({ userId: "gerente", role: "OWNER" });
const encargado = member({ userId: "encargado", role: "MANAGER" });
const mozo = member({ userId: "mozo", role: "GROOM" });
const propietario = member({ userId: "propietaria", role: "OWNER_EXTERNAL", horseIds: [HORSE] });
const herrador = member({ userId: "herrador", role: "PROFESSIONAL", specialty: "FARRIER", horseIds: [HORSE] });
const veterinario = member({ userId: "vet", role: "PROFESSIONAL", specialty: "VET", horseIds: [HORSE] });

const ids = (rs: { userId: string }[]) => rs.map((r) => r.userId).sort();

test("un herraje que vence avisa al centro, al propietario del caballo y al herrador con acceso", () => {
  const rs = recipientsFor({ horseId: HORSE, type: "FARRIER" }, [centro, encargado, propietario, herrador, veterinario]);
  assert.deepEqual(ids(rs), ["encargado", "gerente", "herrador", "propietaria"]);
  assert.equal(rs.find((r) => r.userId === "herrador")?.reason, "PROFESSIONAL");
  assert.equal(rs.find((r) => r.userId === "propietaria")?.reason, "OWNER");
  assert.equal(rs.find((r) => r.userId === "gerente")?.reason, "CENTER");
});

test("una vacuna avisa al veterinario y no al herrador", () => {
  const rs = recipientsFor({ horseId: HORSE, type: "VACCINE" }, [herrador, veterinario]);
  assert.deepEqual(ids(rs), ["vet"]);
  // El rol actual VET_EXTERNAL cuenta como veterinario hasta la migración de E1a.
  const legacyVet = member({ userId: "vet-antiguo", role: "VET_EXTERNAL", horseIds: [HORSE] });
  assert.deepEqual(ids(recipientsFor({ horseId: HORSE, type: "VACCINE" }, [legacyVet])), ["vet-antiguo"]);
});

test("un usuario que es a la vez gerente y propietario recibe un solo aviso", () => {
  const gerentePropietario = member({ userId: "gerente", role: "MANAGER", horseIds: [HORSE] });
  const rs = recipientsFor({ horseId: HORSE, type: "DEWORMING" }, [gerentePropietario, gerentePropietario]);
  assert.equal(rs.length, 1);
  assert.equal(rs[0]?.reason, "CENTER");
});

test("un profesional con la especialidad pero sin HorseAccess a ese caballo no recibe el aviso", () => {
  const herradorDeOtro = member({ userId: "herrador-2", role: "PROFESSIONAL", specialty: "FARRIER", horseIds: ["otro"] });
  assert.deepEqual(recipientsFor({ horseId: HORSE, type: "FARRIER" }, [herradorDeOtro]), []);
});

test("los mozos (GROOM) no reciben avisos de vencimientos", () => {
  const rs = recipientsFor({ horseId: HORSE, type: "FARRIER" }, [mozo, member({ userId: "jinete", role: "RIDER", horseIds: [HORSE] })]);
  assert.deepEqual(rs, []);
});

test("se usan los días de antelación del centro: 7 por defecto, 3 si se configura", () => {
  const events = [
    { id: "e7", horseId: HORSE, type: "VACCINE", date: inDays(-358), nextDueDate: inDays(7) },
    { id: "e3", horseId: "otro", type: "VACCINE", date: inDays(-362), nextDueDate: inDays(3) },
    { id: "e0", horseId: "tercero", type: "FARRIER", date: inDays(-42), nextDueDate: inDays(0) },
  ];
  const porDefecto = dueReminders(events, { now });
  assert.deepEqual(porDefecto.map((d) => [d.event.id, d.daysUntil]), [["e7", 7], ["e0", 0]]);
  const conTres = dueReminders(events, { now, leadDays: 3 });
  assert.deepEqual(conTres.map((d) => [d.event.id, d.daysUntil]), [["e3", 3], ["e0", 0]]);
});

test("la clave de deduplicación es estable para el mismo acto, destinatario y antelación", () => {
  const a = reminderDedupeKey({ eventId: "e1", daysUntil: 7 });
  assert.equal(a, reminderDedupeKey({ eventId: "e1", daysUntil: 7 }));
  assert.notEqual(a, reminderDedupeKey({ eventId: "e1", daysUntil: 0 }));
  assert.notEqual(a, reminderDedupeKey({ eventId: "e2", daysUntil: 7 }));
  // El destinatario entra por la unicidad (userId, dedupeKey) de Notification.
});

test("un acto superado por otro posterior del mismo tipo no genera aviso", () => {
  const events = [
    // La vacuna antigua vence en 7 días, pero se repitió ayer: está cubierta.
    { id: "antigua", horseId: HORSE, type: "VACCINE", date: inDays(-358), nextDueDate: inDays(7) },
    { id: "repetida", horseId: HORSE, type: "VACCINE", date: inDays(-1), nextDueDate: inDays(364) },
    // Otro tipo en el mismo caballo no la tapa.
    { id: "herraje", horseId: HORSE, type: "FARRIER", date: inDays(-35), nextDueDate: inDays(7) },
  ];
  assert.deepEqual(dueReminders(events, { now }).map((d) => d.event.id), ["herraje"]);
});

// --- Regla única con permissions.ts (#50): quien puede registrar el acto recibe su aviso ---

test("un veterinario especialista recibe el aviso de vacuna como el veterinario general", () => {
  const especialista = member({ userId: "vet-cojeras", role: "PROFESSIONAL", specialty: "VET_SPECIALIST", horseIds: [HORSE] });
  assert.deepEqual(ids(recipientsFor({ horseId: HORSE, type: "VACCINE" }, [especialista])), ["vet-cojeras"]);
});

test("un acto dental avisa al dentista y al veterinario, no al herrador", () => {
  const dentista = member({ userId: "dentista", role: "PROFESSIONAL", specialty: "DENTIST", horseIds: [HORSE] });
  const rs = recipientsFor({ horseId: HORSE, type: "DENTAL" }, [dentista, veterinario, herrador]);
  assert.deepEqual(ids(rs), ["dentista", "vet"]);
});

test("para todo acto y especialidad, recibe el aviso quien puede registrar ese acto según permissions.ts", () => {
  for (const specialty of PROFESSIONAL_SPECIALTIES) {
    for (const type of HEALTH_EVENT_TYPES) {
      const pro = member({ userId: `p-${specialty}`, role: "PROFESSIONAL", specialty, horseIds: [HORSE] });
      const notified = recipientsFor({ horseId: HORSE, type }, [pro]).length === 1;
      assert.equal(notified, canRecordHealthEvent({ role: "PROFESSIONAL", specialty }, type), `${specialty} × ${type}`);
    }
  }
});
