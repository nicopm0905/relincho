import { test } from "node:test";
import assert from "node:assert/strict";

import { slugFollowingName, slugify } from "@/lib/slug";

test("el identificador se genera del nombre: minúsculas, sin tildes y con guiones", () => {
  assert.equal(slugify("Entre caballos por la dehesa"), "entre-caballos-por-la-dehesa");
  assert.equal(slugify("  Yeguada Peñón  & Hijos "), "yeguada-penon-hijos");
  // El corte a 40 no deja un guion colgando.
  assert.equal(slugify("a".repeat(39) + " bcd"), "a".repeat(39));
});

test("el identificador sigue al nombre mientras se escribe, no se queda en la primera letra", () => {
  let form = { name: "", slug: "" };
  for (const name of ["E", "En", "Entre caballos", "Entre caballos por la dehesa"]) {
    form = { name, slug: slugFollowingName({ previousName: form.name, name, slug: form.slug }) };
  }
  assert.equal(form.slug, "entre-caballos-por-la-dehesa");
  // Al borrar el nombre vuelve a quedar vacío.
  assert.equal(slugFollowingName({ previousName: form.name, name: "", slug: form.slug }), "");
});

test("si el usuario ha escrito su propio identificador, cambiar el nombre no lo pisa", () => {
  assert.equal(slugFollowingName({ previousName: "Entre caballos", name: "Entre caballos SL", slug: "dehesa" }), "dehesa");
});
