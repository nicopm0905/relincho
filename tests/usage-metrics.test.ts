import { test } from "node:test";
import assert from "node:assert/strict";

import { activation, retentionWeek4, usageDays, type InvitedMember } from "@/lib/usage-metrics";
import type { PermissionRole } from "@/lib/permissions";

const invitedAt = new Date("2026-12-23T10:00:00Z");
const after = (days: number, hour = 10) =>
  new Date(invitedAt.getTime() + days * 86_400_000 + (hour - 10) * 3_600_000);

const cliente = (id: string, role: PermissionRole = "OWNER_EXTERNAL"): InvitedMember => ({ membershipId: id, role, invitedAt });

test("abrir la app 20 veces en un día cuenta como un día de uso", () => {
  const opens = Array.from({ length: 20 }, (_, i) => ({ membershipId: "m1", at: after(1, 8 + (i % 12)) }));
  assert.deepEqual(usageDays(opens), [{ membershipId: "m1", day: "2026-12-24" }]);
});

test("activación: cuenta quien abre la app en los 7 días siguientes a la invitación", () => {
  const members = [cliente("pronto"), cliente("tarde"), cliente("nunca")];
  const days = usageDays([
    { membershipId: "pronto", at: after(6) },
    { membershipId: "tarde", at: after(8) },
  ]);
  assert.deepEqual(activation(members, days), { eligible: 3, active: 1, rate: 1 / 3 });
});

test("retención a 4 semanas: activo si hay uso en la semana 4 tras la invitación", () => {
  const members = [cliente("sigue"), cliente("se-fue"), cliente("justo-antes")];
  const days = usageDays([
    { membershipId: "sigue", at: after(1) },
    { membershipId: "sigue", at: after(24) },
    { membershipId: "se-fue", at: after(1) },
    { membershipId: "justo-antes", at: after(20) },
  ]);
  assert.deepEqual(retentionWeek4(members, days), { eligible: 3, active: 1, rate: 1 / 3 });
});

test("el personal del centro no cuenta en las métricas de clientes", () => {
  const members = [
    cliente("propietaria"),
    cliente("herrador", "PROFESSIONAL"),
    cliente("gerente", "OWNER"),
    cliente("encargado", "MANAGER"),
    cliente("mozo", "GROOM"),
  ];
  const days = usageDays(members.map((m) => ({ membershipId: m.membershipId, at: after(1) })));
  // Antes esperaba 2 elegibles: contaba al herrador como cliente (revisión de Alberto en #44).
  assert.deepEqual(activation(members, days), { eligible: 1, active: 1, rate: 1 });
  assert.deepEqual(activation([cliente("gerente", "OWNER")], []), { eligible: 0, active: 0, rate: null });
});

test("un herrador o un veterinario no cuentan como clientes en H3", () => {
  const members = [
    cliente("propietaria"),
    cliente("alumna", "RIDER"),
    cliente("herrador", "PROFESSIONAL"),
    cliente("veterinaria", "VET_EXTERNAL"),
    cliente("profesora", "INSTRUCTOR"),
  ];
  const days = usageDays(members.map((m) => ({ membershipId: m.membershipId, at: after(1) })));
  assert.deepEqual(activation(members, days), { eligible: 2, active: 2, rate: 1 });
  assert.deepEqual(retentionWeek4(members, usageDays(members.map((m) => ({ membershipId: m.membershipId, at: after(22) })))), {
    eligible: 2,
    active: 2,
    rate: 1,
  });
});
