import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CAPABILITIES,
  HEALTH_EVENT_TYPES,
  PERMISSION_MATRIX,
  ROLES,
  can,
  canRecordHealthEvent,
  memberSpecialty,
  type Member,
} from "@/lib/permissions";

/** Los tipos de acto sanitario que el miembro puede registrar. */
const writableHealthTypes = (member: Member) =>
  HEALTH_EVENT_TYPES.filter((type) => canRecordHealthEvent(member, type));

const writeCapabilities = CAPABILITIES.filter((c) => !c.endsWith(".read"));

test("un herrador solo puede registrar actos sanitarios de tipo FARRIER", () => {
  const farrier: Member = { role: "PROFESSIONAL", specialty: "FARRIER" };
  assert.deepEqual(writableHealthTypes(farrier), ["FARRIER"]);
});

test("un veterinario registra vacunas, desparasitaciones, revisiones y tratamientos, pero no herrajes", () => {
  const vet: Member = { role: "PROFESSIONAL", specialty: "VET" };
  for (const type of ["VACCINE", "DEWORMING", "VET_CHECKUP", "TREATMENT"] as const) {
    assert.equal(canRecordHealthEvent(vet, type), true, type);
  }
  assert.equal(canRecordHealthEvent(vet, "FARRIER"), false);
});

// Decisión de #26: el veterinario también registra lesiones y odontología.
test("un veterinario registra también lesiones y actos dentales", () => {
  for (const specialty of ["VET", "VET_SPECIALIST"] as const) {
    const vet: Member = { role: "PROFESSIONAL", specialty };
    assert.equal(canRecordHealthEvent(vet, "INJURY"), true, specialty);
    assert.equal(canRecordHealthEvent(vet, "DENTAL"), true, specialty);
  }
  assert.equal(canRecordHealthEvent({ role: "VET_EXTERNAL" }, "INJURY"), true);
});

test("un dentista solo registra DENTAL", () => {
  const dentist: Member = { role: "PROFESSIONAL", specialty: "DENTIST" };
  assert.deepEqual(writableHealthTypes(dentist), ["DENTAL"]);
});

test("PROFESSIONAL sin especialidad no puede escribir nada", () => {
  for (const specialty of [null, undefined]) {
    const member: Member = { role: "PROFESSIONAL", specialty };
    assert.deepEqual(writableHealthTypes(member), []);
    assert.deepEqual(writeCapabilities.filter((c) => can(member, c)), []);
  }
});

test("OWNER_EXTERNAL lee la ficha de sus caballos pero no escribe sanidad", () => {
  const owner: Member = { role: "OWNER_EXTERNAL" };
  assert.equal(can(owner, "horse.read"), true);
  assert.equal(can(owner, "health.read"), true);
  assert.equal(can(owner, "health.write"), false);
  assert.deepEqual(writableHealthTypes(owner), []);
});

test("RIDER e INSTRUCTOR no tienen capacidades sobre caballos hasta el módulo de clases", () => {
  const horseCapabilities = CAPABILITIES.filter((c) => c.startsWith("horse.") || c.startsWith("health."));
  for (const role of ["RIDER", "INSTRUCTOR"] as const) {
    const member: Member = { role };
    assert.deepEqual(horseCapabilities.filter((c) => can(member, c)), [], role);
    assert.deepEqual(writableHealthTypes(member), [], role);
  }
});

test("toda combinación rol × capacidad está declarada: la matriz no tiene huecos", () => {
  const gaps = ROLES.flatMap((role) =>
    CAPABILITIES.filter((c) => typeof PERMISSION_MATRIX[role]?.[c] !== "boolean").map((c) => `${role} × ${c}`),
  );
  assert.deepEqual(gaps, []);
});

test("un PROFESSIONAL sin especialidad no se puede guardar", () => {
  assert.deepEqual(memberSpecialty("PROFESSIONAL", {}), { error: "SPECIALTY_REQUIRED" });
  assert.deepEqual(memberSpecialty("PROFESSIONAL", { specialty: null }), { error: "SPECIALTY_REQUIRED" });
});

test("un PROFESSIONAL guarda su especialidad y la nota recortada", () => {
  assert.deepEqual(memberSpecialty("PROFESSIONAL", { specialty: "FARRIER", specialtyNote: "  cojeras " }), {
    specialty: "FARRIER",
    specialtyNote: "cojeras",
  });
  assert.deepEqual(memberSpecialty("PROFESSIONAL", { specialty: "VET", specialtyNote: "   " }), {
    specialty: "VET",
    specialtyNote: null,
  });
});

test("cualquier otro rol se queda sin especialidad ni nota", () => {
  for (const role of ROLES.filter((r) => r !== "PROFESSIONAL")) {
    assert.deepEqual(
      memberSpecialty(role, { specialty: "FARRIER", specialtyNote: "cojeras" }),
      { specialty: null, specialtyNote: null },
      role,
    );
  }
});
