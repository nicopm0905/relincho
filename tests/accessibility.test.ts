import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function source(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("las rutas principales exponen un destino único para el skip link", () => {
  const routes = [
    "src/app/page.tsx",
    "src/app/landing-v2/page.tsx",
    "src/app/(marketing)/demo/page.tsx",
    "src/app/(marketing)/fundadores/page.tsx",
    "src/app/(marketing)/contacto/page.tsx",
    "src/app/(marketing)/privacidad/page.tsx",
    "src/app/(marketing)/terminos/page.tsx",
    "src/app/(marketing)/cookies/page.tsx",
    "src/app/(app)/[tenantSlug]/layout.tsx",
    "src/app/(app)/[tenantSlug]/portal/layout.tsx",
  ];

  for (const route of routes) {
    const content = source(route);
    assert.equal(
      (content.match(/id="main-content"/g) ?? []).length,
      1,
      `${route} debe exponer exactamente un main-content`,
    );
    assert.match(content, /tabIndex=\{-1\}/, `${route} debe permitir enfocar el main`);
  }
});

test("las navegaciones compartidas tienen nombre accesible", () => {
  assert.match(
    source("src/components/layout/sidebar.tsx"),
    /<nav aria-label=\{t\("navigation"\)\}/,
  );
  assert.match(
    source("src/components/marketing/header.tsx"),
    /<nav aria-label=\{t\("navigation"\)\}/,
  );
  assert.match(
    source("src/components/landing-v2/navbar-v2.tsx"),
    /aria-label=\{t\("navigation"\)\}/,
  );
  assert.match(
    source("src/app/(app)/[tenantSlug]/portal/layout.tsx"),
    /<nav aria-label="Navegación del portal"/,
  );
});

test("los idiomas mantienen las etiquetas necesarias para la navegación", () => {
  type Messages = {
    common: { skipToContent: string };
    marketing: { navigation: string };
    landingV2: { nav: { navigation: string } };
  };
  const es = JSON.parse(source("messages/es.json")) as Messages;
  const en = JSON.parse(source("messages/en.json")) as Messages;

  for (const messages of [es, en]) {
    assert.equal(typeof messages.common.skipToContent, "string");
    assert.equal(typeof messages.marketing.navigation, "string");
    assert.equal(typeof messages.landingV2.nav.navigation, "string");
  }
});

test("los controles de kiosko se pueden usar sin gesto táctil", () => {
  const page = source("src/app/(app)/[tenantSlug]/kiosko/page.tsx");
  const card = source("src/components/kiosko/swipeable-card.tsx");

  assert.match(page, /aria-pressed=\{mealType === meal\}/);
  assert.match(page, /aria-label="Cerrar modo kiosko"/);
  assert.match(card, /aria-label=\{`Ración de \$\{horseName\}/);
  assert.match(card, />\s*Omitir\s*<\/button>/);
  assert.match(card, />\s*Marcar repartido\s*<\/button>/);
});

test("los campos del diálogo de movimientos conservan sus relaciones label-control", () => {
  const content = source("src/components/movimientos/new-movement-dialog.tsx");

  for (const id of [
    "movement-horse",
    "movement-date",
    "movement-rega",
    "movement-reason",
  ]) {
    assert.match(content, new RegExp(`htmlFor=\\"${id}\\"`));
    assert.match(content, new RegExp(`id=\\"${id}\\"`));
  }

  assert.match(content, /aria-pressed=\{direction === "IN"\}/);
  assert.match(content, /aria-pressed=\{direction === "OUT"\}/);
});
