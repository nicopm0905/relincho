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

test("las acciones rápidas de Inicio tienen nombres claros y reutilizan formularios existentes", () => {
  const quickActions = source("src/components/inicio/quick-actions.tsx");
  const massHealthDialog = source("src/components/sanidad/mass-health-dialog.tsx");
  const home = source("src/app/(app)/[tenantSlug]/inicio/page.tsx");

  assert.match(quickActions, /aria-labelledby="quick-actions-heading"/);
  // Los nombres salen de next-intl: se comprueba que existen en los dos idiomas.
  type HomeMessages = { home: { quickActions: Record<string, string> } };
  for (const locale of ["es", "en"]) {
    const messages = JSON.parse(source(`messages/${locale}.json`)) as HomeMessages;
    for (const key of ["quickTask", "newTask", "recordCare"]) {
      assert.ok(quickActions.includes(`t("${key}")`), `quick-actions no usa t("${key}")`);
      assert.ok(messages.home.quickActions[key]?.trim(), `${locale}: falta home.quickActions.${key}`);
    }
  }
  assert.match(massHealthDialog, /compact \? "Mismo cuidado a varios"/);
  assert.match(quickActions, /MassHealthDialog/);
  assert.match(quickActions, /canRecordHealth/);
  assert.match(quickActions, /quickMode/);
  assert.match(quickActions, /<TaskDialog/);
  assert.match(quickActions, /<HealthEventForm/);
  assert.match(home, /<QuickActions/);
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

/* Contraste de los tokens: si alguien cambia un color de globals.css y rompe
   AA, falla aqui y no en una demo. Texto 4.5:1; anillos, barras y puntos 3:1
   (WCAG 1.4.3 y 1.4.11). Se mide en claro y en oscuro. */
function themeTokens(css: string, selector: ":root" | ".dark") {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `globals.css no define ${selector}`);
  const block = css.slice(start, css.indexOf("\n}", start));
  const tokens: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[name!] = value!;
  }
  return tokens;
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

test("los tokens de color cumplen contraste AA en claro y en oscuro", () => {
  const css = source("src/app/globals.css");
  const states = ["empty", "heat", "covered", "pregnant", "foaled", "alert", "danger", "ok"];
  const text: [string, string][] = [
    ["foreground", "background"],
    ["foreground", "card"],
    ["muted-foreground", "background"],
    ["muted-foreground", "card"],
    ["muted-foreground", "muted"],
    ["muted-foreground", "sidebar"],
    ["primary-foreground", "primary"],
    ["primary-ink", "card"],
    ["primary-ink", "background"],
    ["destructive", "card"],
    ...states.flatMap((s): [string, string][] => [
      [`state-${s}-ink`, `state-${s}-soft`],
      [`state-${s}-ink`, "card"],
    ]),
  ];
  const ui: [string, string][] = [
    ["ring", "card"],
    ["ring", "background"],
    ...states.map((s): [string, string] => [`state-${s}`, "card"]),
  ];

  for (const selector of [":root", ".dark"] as const) {
    const tokens = themeTokens(css, selector);
    for (const [pairs, min] of [[text, 4.5], [ui, 3]] as const) {
      for (const [fg, bg] of pairs) {
        assert.ok(tokens[fg] && tokens[bg], `${selector} no define --${fg} o --${bg}`);
        const ratio = contrast(tokens[fg]!, tokens[bg]!);
        assert.ok(
          ratio >= min,
          `${selector}: --${fg} sobre --${bg} da ${ratio.toFixed(2)}:1 (mínimo ${min}:1)`,
        );
      }
    }
  }
});
