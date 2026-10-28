import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PROFESSIONAL_SPECIALTIES, ROLES } from "@/lib/permissions";

type Labels = Record<string, string | undefined>;
interface Messages {
  team?: { roles?: Labels; specialties?: Labels };
  tenantPicker: { roles: Labels };
}

const locales = ["es", "en"] as const;
const load = (locale: string) =>
  JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")) as Messages;

test("todo rol tiene etiqueta en el equipo y en el selector de centro, en es y en", () => {
  for (const locale of locales) {
    const m = load(locale);
    for (const role of ROLES) {
      assert.ok(m.team?.roles?.[role]?.trim(), `${locale}: falta team.roles.${role}`);
      assert.ok(m.tenantPicker.roles[role]?.trim(), `${locale}: falta tenantPicker.roles.${role}`);
    }
  }
});

test("toda especialidad tiene etiqueta en es y en", () => {
  for (const locale of locales) {
    const m = load(locale);
    for (const s of PROFESSIONAL_SPECIALTIES) {
      assert.ok(m.team?.specialties?.[s]?.trim(), `${locale}: falta team.specialties.${s}`);
    }
  }
});
