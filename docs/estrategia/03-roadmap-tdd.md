# Relincho: roadmap TDD (oct 2026 – jun 2027)

> **Estado:** propuesta para aprobar · 27 oct 2026
> **Fuente de verdad del producto:** `01-identidad-relincho.md` (capas §5, roles §6, decisiones D1–D7 §8, validación §10).
> **Este documento NO aplica nada.** Todos los ficheros, scripts y comandos de abajo son propuestas: se aplican en el Sprint 0, con revisión.

---

## 0. Resumen

| Hito | Fecha | Qué significa |
|---|---|---|
| **H0. Gate obligatorio** | **10 nov 2026** | Nada llega a GitHub ni a producción sin tipos, lint y tests en verde. BD de tests efímera. Rama `master` protegida |
| Congelación SICAB | 16–23 nov 2026 | Ningún despliegue a producción. Último despliegue, el 12 nov |
| **H1. Bucle mínimo en producción** | **17 dic 2026** | Centro → cliente → herrador con avisos por email. Listo para dar de alta el piloto de Jerez |
| **H2. Piloto completo** | **2 mar 2027** | Incidencias con confirmación, feed del caballo, Web Push y agenda multi-centro del profesional |
| G2. Go / no-go | 2 mar 2027 | Con los datos de H1–H5 (§10) se decide si van primero las clases (plan base) o el stock |
| **H3. Clases y bonos facturables** | **8 jun 2027** | Reservas, cancelaciones, lista de espera, bonos y su facturación |
| H4. Stock MVP | 30 jun 2027 | **En riesgo**: el plan no tiene holgura entre marzo y junio. Es lo primero que se recorta |

**Supuesto de equipo (explícito):** 1–2 desarrolladores, estudiantes a tiempo parcial. Capacidad de referencia: **6 días ideales por sprint** de 2 semanas (2 personas × ~12 h/semana × factor de foco 0,75 ÷ 6 h por día ideal). Baja a 2–4 en SICAB, Navidad, exámenes de enero y de mayo–junio y Semana Santa. **Es un supuesto, no una medida:** se recalibra con la velocidad real al cerrar el S2. **Con un solo desarrollador, todo el calendario se estira por 2:** H1 cae a mediados de enero y H2 a mayo.

---

## 1. Sprint 0: infraestructura TDD (28 oct – 10 nov 2026)

### 1.1 Estado de partida (medido hoy)

| Pieza | Estado | Evidencia |
|---|---|---|
| Tests | 222 tests `node:test` en 30 ficheros, **todos de funciones puras**; 0 de routers tRPC | `npm run check:tests`: 222 pass, 25 s |
| Tipos | `tsc --noEmit` en verde | 3 min 12 s en frío en la máquina de Nico (con `incremental: true`, `tsconfig.json:15`) |
| Lint | **9 errores y 11 avisos** (no 20): 2 `no-require-imports` en `patch-select.js:1-2`, 6 `no-explicit-any` en `caballos/[id]/editar/page.tsx:52,54`, `horse-chat.tsx:121,125` y `new-contract-dialog.tsx:28`, y 1 `react-hooks/purity` en `portal/caballos/[id]/page.tsx:62` (`Date.now()` en el render) | `npx eslint -f json .` en 2 min 1 s, sin caché |
| CI | `quality-gate.yml` ejecuta `check:quality` (tipos, tests y a11y). **No ejecuta lint** y repite el test de a11y, porque el glob `tests/*.test.ts` ya incluye `accessibility.test.ts` | `.github/workflows/quality-gate.yml`, `package.json` (`check:quality`) |
| Protección de rama | **Ninguna** | `gh api …/branches/master/protection` → 404 "Branch not protected" (el repo es público, así que los rulesets son gratis) |
| Hooks | No hay `.githooks`, ni husky, ni `core.hooksPath` | `git config core.hooksPath` vacío |
| Despliegue | Manual con `npx vercel --prod`. El build ejecuta `prisma migrate deploy` contra la BD compartida (**dev = prod**) | `package.json` (`build`), memoria `deploy_vercel` |
| Migraciones | **No hay migración base.** La primera (`20260909120000_fase3_facturacion`) empieza con `ALTER TABLE "Invoice"`; ninguna crea `Tenant` ni `Horse`. El esquema inicial se creó con `db push`. **Hoy no se puede montar una BD vacía con `migrate deploy`**, y `migrate dev` no tiene BD sombra válida | `prisma/migrations/20260909120000_fase3_facturacion/migration.sql:1-3` |
| Aislamiento entre tenants | Lo garantiza solo el código: la app conecta como `postgres` con BYPASSRLS | memoria `db_access_model`; `withTenant` en `src/server/db/prisma.ts:74-90` |
| Contexto tRPC | `init.ts` importa `getSession` (Auth.js) en tiempo de carga, lo que dificulta montar un `createCaller` en tests | `src/server/trpc/init.ts:4,12-70` |

### 1.2 El flujo rojo-verde-refactor en este repo

1. **Rojo, en el motor puro.** Toda regla de negocio nueva nace en `src/lib/<motor>.ts` con su test en `tests/<motor>.test.ts`. Primero se crea un stub que lanza `new Error("no implementado")`, para que el rojo sea un fallo de aserción y no un error de import. Se ejecuta `npm run test:one -- tests/<motor>.test.ts` y se comprueba que falla por la razón correcta.
2. **Verde.** El código mínimo en `src/lib`. Sin Prisma, sin `server-only`, sin fechas implícitas: `now` siempre como parámetro (el patrón que ya usa `pendingHealthDue` en `src/lib/health-due.ts:25-28`).
3. **Refactor** con el verde.
4. **Router, segundo nivel.** (a) Un test de permisos sin BD por cada procedure nueva: rol prohibido → `FORBIDDEN`. (b) Un test de integración con BD efímera: tenant ajeno → `NOT_FOUND` o lista vacía, más el caso feliz. El router se queda fino: valida con Zod, llama al motor y persiste.
5. **UI, al final.** E2E con Playwright solo para los flujos del bucle (máximo 6 en junio).
6. **Commits.** `test(x): …` (rojo, se queda en local) y luego `feat(x): …` (verde). El hook prueba el HEAD que se empuja, así que un commit rojo intermedio en el historial es aceptable, pero un push en rojo no.

### 1.3 Pirámide de tests

| Nivel | Qué | Dónde | Cuándo corre | Objetivo en junio |
|---|---|---|---|---|
| 1. Motores puros | Reglas: avisos, permisos, reservas, bonos, stock, feed, cola offline | `tests/*.test.ts` sobre `src/lib/*.ts` | pre-push y CI | ~70 % de los tests |
| 2a. Procedures sin BD | Matriz rol × procedure, demo y prueba terminada en solo lectura | `tests/procedures.test.ts` (router mínimo construido con `roleProcedure`, `staffProcedure`, etc.) | pre-push y CI | Una fila por procedure con rol |
| 2b. Routers con BD efímera | Aislamiento entre tenants, `HorseAccess`, idempotencia, concurrencia (última plaza) | `tests/integration/*.int.test.ts`, Postgres 16 en Docker o como servicio de CI | CI siempre; pre-push solo si existe `TEST_DATABASE_URL` | ~25 % |
| 3. E2E | El bucle del piloto en móvil: herrador → aviso, incidencia, reserva, offline y demo en solo lectura | `tests/e2e/*.spec.ts` (Playwright, Chromium y WebKit móvil) | CI en PR. No en pre-push (es lento) | ≤ 6 flujos |

**Harness de routers (propuesto):**

- Refactor previo (0,5 días): mover `createTRPCContext` de `src/server/trpc/init.ts:12-70` a `src/server/trpc/context.ts`. `init.ts` se queda con `import type { TRPCContext }`. Cambian dos consumidores: `src/app/api/trpc/[trpc]/route.ts` y `src/lib/trpc/server.ts`. Así `init.ts` deja de cargar Auth.js en los tests.
- `tests/helpers/trpc.ts` (**hecho en S0-0.3**): `fakeCtx(miembro | null)` y `callerAs(createCaller, miembro | null)`. Recibe el `createCaller` del router, no el router, para conservar los tipos de cada procedure. El patrón de uso está en `tests/procedures.test.ts`:

```ts
const router = createTRPCRouter({ staff: staffProcedure.query(() => "ok") });
const createCaller = createCallerFactory(router);
await callerAs(createCaller, { role: "GROOM" }).staff();            // "ok"
await callerAs(createCaller, { role: "OWNER_EXTERNAL" }).staff();   // FORBIDDEN
// Integración: createCallerFactory(appRouter) (carga Prisma; solo con BD efímera)
```

- `tests/helpers/factories.ts`: `makeTenant()` (slug aleatorio), `makeMember(tenant, role, { specialty })`, `makeHorse(tenant)`, `grantAccess(member, horse, relation)`. Cada test crea su propio tenant, así que no hace falta truncar tablas entre tests.
- El envío de email y push se inyecta (`send` como parámetro de los servicios) para que los tests de integración no llamen a Resend.

### 1.4 Garantía "nada se sube sin tests": tres cerrojos

1. **Local: hook `pre-push` versionado** en `.githooks/pre-push` y activado con `git config core.hooksPath .githooks`. **Sin husky:** husky hace exactamente eso (fijar `core.hooksPath`) más un andamiaje. Añadir una dependencia por 5 líneas no compensa, y un script `prepare` en Node lo activa igual en Windows, macOS y Linux.
2. **Servidor: ruleset de GitHub** sobre `master`: PR obligatoria, checks requeridos `Types, lint, tests and accessibility` e `Integration (Postgres)` con rama al día, sin force-push, sin borrado y **sin bypass, tampoco para administradores**. Con esto `git push --no-verify` no sirve para nada en `master` (y saltarse un hook ya está prohibido en `AGENTS.md`).
3. **Despliegue: guardián.** `npm run deploy` se niega si no estás en `master`, si el árbol está sucio, si `HEAD ≠ origin/master`, si los checks de ese commit no están en verde, si hay migraciones pendientes sin confirmar o si estás en una ventana congelada (SICAB). **Recomendado en cuanto se pueda:** desplegar solo desde GitHub Actions (`workflow_dispatch`) con un entorno `production` que pida aprobación del otro socio. Así nadie despliega a mano desde su portátil.

### 1.5 Lint: arreglarlo, no excluirlo

Son **9 errores en 5 ficheros** (medio día). Dejar el lint fuera del gate significa que la deuda crece sin que nadie la vea. Propuesta:

- `patch-select.js`: es un codemod de un solo uso (commit `5810b04`) que no referencia nadie. **Borrarlo** (requiere tu OK) o moverlo a `scripts/` como `.mjs`.
- Los 6 `any`: tiparlos.
- `react-hooks/purity` en `portal/caballos/[id]/page.tsx:62`: sacar `Date.now()` a un helper `now()` de `src/lib/day-window.ts` o recibir la fecha del servidor.
- Los avisos se quedan como avisos, con trinquete: `--max-warnings=11`. Uno nuevo rompe el gate y el número solo baja.
- `eslint --cache` para que el pre-push no tarde 2 minutos en cada push.

### 1.6 Contenido exacto propuesto

#### `.githooks/pre-push` (LF y ejecutable: `git update-index --chmod=+x .githooks/pre-push`)

```sh
#!/bin/sh
# Relincho · pre-push: nada sale de esta máquina sin el gate en verde.
# Se activa solo con `npm install` (script "prepare") o a mano:
#   git config core.hooksPath .githooks
# Saltárselo con --no-verify está prohibido (AGENTS.md) y además no sirve:
# el ruleset de GitHub exige los mismos checks en CI.
set -eu

zero=0000000000000000000000000000000000000000
head_sha=$(git rev-parse HEAD)
needs_gate=0

while read -r local_ref local_sha remote_ref remote_sha; do
  # Borrar una rama remota no necesita tests.
  [ "$local_sha" = "$zero" ] && continue
  commit=$(git rev-parse "${local_sha}^{commit}")
  if [ "$commit" != "$head_sha" ]; then
    echo "pre-push: empujas $local_ref ($commit) pero tu HEAD es $head_sha." >&2
    echo "          Cambia a esa rama: el gate prueba el árbol de trabajo, no otra rama." >&2
    exit 1
  fi
  needs_gate=1
done
[ "$needs_gate" -eq 0 ] && exit 0

# El gate prueba el árbol de trabajo: si difiere del commit, el verde no vale.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "pre-push: hay cambios sin commitear en ficheros versionados." >&2
  echo "          Haz commit o 'git stash' y vuelve a empujar." >&2
  exit 1
fi

echo "pre-push: npm run gate (tipos, lint, tests y a11y)..."
if ! npm run --silent gate; then
  echo "pre-push: el gate ha fallado. No se sube nada." >&2
  exit 1
fi

# Integración: solo si hay una BD efímera local. Si no, la cubre el CI.
if [ -n "${TEST_DATABASE_URL:-}" ]; then
  echo "pre-push: tests de integración contra $TEST_DATABASE_URL..."
  npm run --silent check:int || { echo "pre-push: integración en rojo." >&2; exit 1; }
else
  echo "pre-push: sin TEST_DATABASE_URL; la integración la comprobará el CI."
fi
```

#### `.gitattributes` (añadir)

```
.githooks/* text eol=lf
*.sh        text eol=lf
```

#### `scripts/setup-hooks.mjs` (lo llama `prepare`; en cmd.exe no existe `|| true`, por eso va en Node)

```js
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

// En CI y en Vercel no hay hooks que activar (y puede no haber .git).
if (process.env.CI || process.env.VERCEL || !existsSync(".git")) process.exit(0);
try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "ignore" });
} catch {
  console.warn("[hooks] No se pudo activar .githooks. Hazlo a mano: git config core.hooksPath .githooks");
}
```

#### `package.json`: scripts (diff propuesto)

```jsonc
{
  "scripts": {
    // nuevos
    "prepare": "node scripts/setup-hooks.mjs",
    "gate": "npm run check:types && npm run lint && npm run check:tests",
    "test:one": "tsx --conditions=react-server --test",
    "test:watch": "tsx --conditions=react-server --test --watch \"tests/*.test.ts\"",
    "check:int": "node scripts/test-db.mjs test",
    "db:test:reset": "node scripts/test-db.mjs reset",
    "test:e2e": "playwright test",
    "deploy": "node scripts/deploy-guard.mjs && npx vercel --prod --yes",
    // cambian
    "lint": "eslint --cache --cache-location node_modules/.cache/eslint/ --max-warnings=11",
    "check:quality": "npm run gate"   // alias: a11y ya va dentro de check:tests
    // sin cambios: check, check:types, check:tests, check:a11y, build…
  },
  "devDependencies": {
    "@playwright/test": "<versión fijada en S3>",
    "fake-indexeddb": "<versión fijada en S9>",
    "web-push": "<versión fijada en S7, va en dependencies>"
  }
}
```

#### `scripts/test-db.mjs` (BD efímera; se niega a tocar Supabase)

```js
import { spawnSync } from "node:child_process";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("test-db: define TEST_DATABASE_URL. Local:\n" +
    "  docker run -d --name relincho-test -p 54329:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=relincho_test postgres:16\n" +
    "  TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54329/relincho_test");
  process.exit(1);
}
const { hostname } = new URL(url);
if (!["localhost", "127.0.0.1"].includes(hostname) || /supabase/i.test(url)) {
  console.error(`test-db: "${hostname}" no es una BD local. Me niego a usarla.`);
  process.exit(1);
}
// prisma.config.ts lee DIRECT_URL y src/server/db/prisma.ts lee DATABASE_URL:
// los dos apuntan a la BD efímera (dotenv no pisa variables ya definidas).
const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url, NODE_ENV: "test" };
const run = (cmd) => {
  const r = spawnSync(cmd, { shell: true, stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
const mode = process.argv[2];
if (mode === "reset") {
  // Con la migración base (S0): migraciones reales, que es lo que se prueba.
  // Comprobar con --help si Prisma 7 lanza el seed en reset; no lo queremos.
  run("npx prisma migrate reset --force");
  // Hasta tener la base: run("npx prisma db push --force-reset");
} else if (mode === "test") {
  run('tsx --conditions=react-server --test --test-concurrency=1 "tests/integration/*.int.test.ts"');
} else {
  console.error("uso: node scripts/test-db.mjs reset|test");
  process.exit(1);
}
```

#### `scripts/deploy-guard.mjs`

```js
import { execSync } from "node:child_process";

const sh = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const fail = (msg) => { console.error(`deploy-guard: ${msg}`); process.exit(1); };

// 1. Ventanas congeladas (hora de Madrid, inclusivas). Hotfix solo con el OK de los dos socios.
const FREEZES = [
  { from: "2026-11-16", to: "2026-11-23", why: "SICAB 2026" },
  { from: "2026-12-18", to: "2027-01-07", why: "Navidad, primeras semanas del piloto" },
];
const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
const freeze = FREEZES.find((f) => today >= f.from && today <= f.to);
if (freeze && process.env.DEPLOY_HOTFIX !== "1") fail(`congelado por ${freeze.why} (${freeze.from} a ${freeze.to}).`);

// 2. Solo master, limpio e idéntico a origin/master.
if (sh("git rev-parse --abbrev-ref HEAD") !== "master") fail("despliega desde master.");
if (sh("git status --porcelain --untracked-files=no")) fail("hay cambios sin commitear.");
sh("git fetch origin master --quiet");
const head = sh("git rev-parse HEAD");
if (head !== sh("git rev-parse origin/master")) fail("HEAD no coincide con origin/master.");

// 3. Checks de GitHub en verde para ESTE commit.
const runs = JSON.parse(sh(`gh api repos/{owner}/{repo}/commits/${head}/check-runs --jq "[.check_runs[] | {name, status, conclusion}]"`));
for (const name of ["Types, lint, tests and accessibility", "Integration (Postgres)"]) {
  const r = runs.find((x) => x.name === name);
  if (!r) fail(`falta el check "${name}" en ${head.slice(0, 7)}.`);
  if (r.status !== "completed" || r.conclusion !== "success") fail(`"${name}": ${r.status}/${r.conclusion ?? "-"}.`);
}

// 4. El build de Vercel aplica las migraciones pendientes en producción.
let status = "";
try { status = sh("npx prisma migrate status"); } catch (e) { status = `${e.stdout ?? ""}${e.stderr ?? ""}`; }
if (/not yet been applied/i.test(status) && process.env.DEPLOY_MIGRATIONS_OK !== "1") {
  fail("hay migraciones pendientes. Revisa el SQL y relanza con DEPLOY_MIGRATIONS_OK=1.");
}
console.log(`deploy-guard: OK ${head.slice(0, 7)}. Desplegando.`);
```

> La lógica de las ventanas congeladas se extrae a `scripts/lib/freeze.mjs` para poder probarla (ver `tests/repo-gate.test.ts`).

#### `.github/workflows/quality-gate.yml` (diff propuesto)

```yaml
jobs:
  quality:
    name: Types, lint, tests and accessibility   # nombre = check requerido
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 2 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - name: Gate (el mismo que el pre-push)
        run: npm run gate

  integration:
    name: Integration (Postgres)
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: relincho_test }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s --health-timeout 5s --health-retries 10
    env:
      TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/relincho_test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run db:test:reset     # valida además que las migraciones aplican desde cero
      - run: npm run check:int

  # e2e: se añade en S3. Al principio no es requerido; pasa a requerido tras 2 semanas estable.
```

#### Ruleset de `master` (se crea una vez; no se versiona como fichero del repo)

```sh
gh api repos/{owner}/{repo}/rulesets -X POST --input - <<'JSON'
{
  "name": "master protegido",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/master"], "exclude": [] } },
  "bypass_actors": [],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "Types, lint, tests and accessibility" },
          { "context": "Integration (Postgres)" } ] } }
  ]
}
JSON
```

Aprobaciones a 0 porque un desarrollador solo no puede aprobar su propia PR. **Con dos desarrolladores activos, súbelas a 1:** la revisión cruzada es barata y pilla lo que los tests no ven.

#### Despliegue desde Actions (recomendado, opcional en S0)

```yaml
# .github/workflows/deploy.yml
name: Deploy production
on: { workflow_dispatch: {} }
permissions: { contents: read, checks: read }
concurrency: { group: deploy-production, cancel-in-progress: false }
jobs:
  deploy:
    if: github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest
    environment: production          # "required reviewers" = el otro socio
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - name: Gate verde y fuera de ventana congelada
        env: { GH_TOKEN: "${{ github.token }}", DEPLOY_MIGRATIONS_OK: "1" }
        run: node scripts/deploy-guard.mjs
      - run: npx vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
      - run: npx vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
      - run: npx vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

### 1.7 Migración base y BD separada (requiere tu aprobación: toca el historial de migraciones de producción)

Sin una migración base no hay BD efímera fiel ni CI que valide migraciones. Además, **con datos reales de clientes del piloto, que el `next dev` apunte a producción es un riesgo RGPD**. Propuesta:

1. Copia de seguridad de producción (PITR de Supabase o `pg_dump`).
2. `pg_dump --schema-only` de producción → `prisma/migrations/20261105000000_base/migration.sql`. Incluye RLS, políticas y los triggers de inalterabilidad de Veri*Factu (`prisma/migrations/20260925120000_facturacion_legal/migration.sql`), cosa que `prisma migrate diff` no captura. Las 15 migraciones actuales se archivan en `prisma/migrations-archivo/`.
3. En producción: `npx prisma migrate resolve --applied 20261105000000_base`.
4. Comprobación: `migrate reset` en una BD vacía + `prisma migrate diff --from-migrations … --to-schema prisma/schema.prisma` vacío.
5. **Proyecto Supabase aparte para desarrollo** (o Postgres local), con las credenciales de producción solo en Vercel. En el plan gratuito caben 2 proyectos.

Ventana: **4–6 nov**, lejos de SICAB. Si no se aprueba, la alternativa peor es `db push --force-reset` en la BD de tests. Funciona para los routers, pero no prueba las migraciones ni los triggers.

### 1.8 Tareas y tests del Sprint 0

| # | Tarea | Días |
|---|---|---|
| 0.1 | Hook, `.gitattributes`, `setup-hooks`, scripts y CI con lint | 0,5 |
| 0.2 | Lint a cero errores y trinquete de avisos | 0,5 |
| 0.3 | `context.ts` separado, `callerAs` y `tests/procedures.test.ts` | 0,5 |
| 0.4 | `test-db.mjs`, factorías, job `integration` y primeros tests de aislamiento | 1,5 |
| 0.5 | Migración base, BD de desarrollo separada y `tests/migrations.test.ts` | 2 |
| 0.6 | Ruleset, `deploy-guard` (+ `deploy.yml` si da tiempo) | 1 |
| | **Total** | **6** |

**Tests que se escriben primero:**

`tests/repo-gate.test.ts`
- `test("el hook pre-push existe, empieza por #!/bin/sh, usa LF y llama a npm run gate")`
- `test("package.json define gate con tipos, lint y tests y prepare activa .githooks")`
- `test("el workflow de CI ejecuta npm run gate, el mismo comando que el hook")`
- `test("isFrozen devuelve true el 17 nov 2026 y false el 24 nov 2026 en hora de Madrid")`

`tests/procedures.test.ts` (sin BD)
- `test("sin usuario, protectedProcedure responde UNAUTHORIZED")`
- `test("tenantProcedure rechaza a OWNER_EXTERNAL con FORBIDDEN")`
- `test("staffProcedure deja pasar a OWNER, MANAGER y GROOM y rechaza a los externos")`
- `test("una mutation en la demo se corta con FORBIDDEN aunque el rol sea OWNER")`
- `test("con la prueba terminada, una mutation se corta y una query pasa")`

`tests/migrations.test.ts` (estático, lee los `.sql`)
- `test("toda migración posterior a la base que crea una tabla activa RLS en esa tabla")`
- `test("ninguna migración usa un valor de enum en la misma migración que lo añade")`

`tests/integration/tenant-isolation.int.test.ts`
- `test("horses.list de un tenant no devuelve caballos de otro tenant")`
- `test("un OWNER_EXTERNAL solo ve en portal.myHorses los caballos de su HorseAccess")`
- `test("assertHorseAccess responde NOT_FOUND, no FORBIDDEN, a un externo sin acceso")`

**Criterio de aceptación de H0 (10 nov):** un push con un test roto se rechaza en local. Una PR con un test roto no se puede fusionar. `npm run deploy` con el CI en rojo se niega. `npm run lint` da 0 errores. El job de integración monta la BD desde cero y pasa.

### 1.9 Reparto en paralelo para dos personas (S0 ∥ S1)

**El S0 y el S1 no se pueden hacer en paralelo tal cual.** La épica E1a (roles) depende de tres tareas del S0:

| E1a necesita… | …de la tarea del S0 | Por qué bloquea |
|---|---|---|
| `callerAs` y el contexto falso | **0.3** | Sin ellos no hay `tests/procedures.test.ts` para `professionalProcedure` |
| Migración base y BD de desarrollo | **0.5** | La migración del enum `Role` no se puede generar ni probar: hoy la BD de `.env` es producción |
| BD efímera de tests | **0.4** | Los tests de `tests/integration/roles.int.test.ts` no tienen dónde ejecutarse |

**Sí se pueden solapar repartiendo por capas.** La persona A hace primero las tareas que desbloquean a la otra. La persona B empieza por lo que no necesita BD.

| Semana | Persona A: Sprint 0, infraestructura | Persona B: Sprint 1, E1a roles |
|---|---|---|
| **Día 0** (antes de empezar, una sola vez) | Bootstrap de Git Flow (ver abajo) | Clonar, `npm install`, **sin credenciales de la BD de producción** |
| **28 oct – 3 nov** | **0.2** lint a cero (se fusiona el primer día: toca 5 ficheros sueltos) → **0.3** `callerAs` (se fusiona el día 2: es el contrato que usa B) → **0.1** gate, hook y CI | `feature/S1-E1a-permisos`: `src/lib/permissions.ts` y `tests/permissions.test.ts` (motor puro, sin BD ni schema). Guion de entrevistas de SICAB (H1, H2 y H5) |
| **4 – 10 nov** | **0.5** migración base y BD de desarrollo (ventana del 4 al 6 nov, con aprobación S0-a) → **0.4** BD efímera e integración → **0.6** ruleset y deploy-guard | Cuando 0.3 esté en `develop`: `professionalProcedure` y sus tests en `procedures.test.ts`. Prepara el cambio de `schema.prisma` **sin generar la migración** |
| **11 – 24 nov** | Entrevistas en SICAB. Soporte del gate | Cuando 0.5 esté en `develop`: genera las dos migraciones de E1a (protocolo de AGENTS.md §6) y escribe los tests de integración de roles en cuanto exista 0.4 |

**Sprints siguientes:** cada persona se queda en un área para no pisarse los ficheros. B lleva **roles y profesionales** (E1a 2/2, E1b invitaciones, E7 visita del herrador, E2 multi-centro). A lleva **avisos y cliente** (E3 avisos, E8a app del cliente, E5 incidencias, E6 feed, E4 push). La regla general: **quien define un contrato (modelo, motor o procedure) lo fusiona primero en una PR pequeña, y la otra persona construye encima.** Si dos épicas de un sprint necesitan migración, se hacen en serie, nunca a la vez.

**Efecto en el calendario:** empezar E1a el 28 oct en vez del 11 nov da unas 2 semanas de margen para H1 (17 dic). Ese margen es el colchón de SICAB; no lo uséis para meter más alcance.

#### Bootstrap de Git Flow (día 0, una persona, unos 30 min)

1. Crear `develop` a partir de `master` y subirla: `git switch -c develop master && git push -u origin develop`.
2. CI: `quality-gate.yml` se ejecuta en cada PR y en push a `master` y `develop` (ya editado en el repo).
3. Rulesets de GitHub en `master` **y** `develop`: PR obligatoria, 1 aprobación de la otra persona, el check *Types, tests and accessibility* en verde, sin force-push ni borrado, y sin excepciones. En `master`, además, solo aceptar ramas `release/*` y `hotfix/*` (se controla en la revisión).
4. Cambiar la rama por defecto de GitHub a `develop`, para que las PR apunten ahí por defecto.
5. Crear una issue por tarea del S0 (0.1 a 0.6) y por cada parte de E1a, asignadas y con la etiqueta del sprint.
6. Añadir al colaborador con permiso *Write* (no *Admin*).

---

## 2. Decisiones con fecha límite

| ID | Decisión (ver `01` §8) | La necesita | **Fecha límite** | Recomendación |
|---|---|---|---|---|
| **S0-a** | Migración base y BD de desarrollo separada (§1.7) | Sprint 0 | **3 nov 2026** | Sí. Ventana del 4 al 6 nov |
| **S0-b** | PR obligatoria, ruleset sin bypass y despliegue solo con gate (Actions o guardián) | Sprint 0 | **3 nov 2026** | Sí |
| **D1** | Identidad multi-centro | E1a (roles), S1 | **10 nov 2026** | (b) `User` global + `Membership` por centro + vista agregada |
| D2 | Propiedad del historial | Confirmar (a) ya; E15 (bajo la línea) | 10 nov (provisional) / jul 2027 | (a) ahora, sin migrar el modelo |
| **D4** | Canales de notificación | E3 (avisos), S2 | **24 nov 2026** | Email ya; Web Push en S7; WhatsApp cuando haya ingresos |
| D3 | Offline | E7 y E5 (llevan `clientMutationId` desde el principio) | **8 dic 2026** | (b) cola de escrituras para mozo y profesional |
| D7 | Datos agregados | Traza de uso (E8a) y contrato de encargado del tratamiento del piloto | **8 dic 2026** | No vender datos jamás; métricas de uso solo internas |
| D5 | Clases: construir o integrar | E10, S11 | **2 mar 2027 (G2)** | Construir, **si H1/H2 lo validan** |
| D6 | Cobro a clientes finales (Stripe Connect) | E10b y E13 | **30 mar 2027** | Decidir con margen: el alta en Connect tarda |

---

## 3. Calendario por sprints

Sprints de 2 semanas, de miércoles a martes. Capacidad en días ideales (§0). "1/2" significa primera mitad de la épica.

| Sprint | Fechas | Cap. | Contenido | Vence | Producción |
|---|---|---|---|---|---|
| **S0** | 28 oct – 10 nov | 6 | **Infraestructura TDD** (§1) | S0-a y S0-b (3 nov), D1 (10 nov) | Deploy el **12 nov** (solo lint e infra) y prueba del QR de la demo |
| **S1** | 11 – 24 nov | 3 | E1a roles 1/2 (motor de permisos y migración en staging). **SICAB 17–22**: entrevistas H1, H2 y H5 con centros que pasen por la feria | D4 (24 nov) | **Congelado 16–23 nov.** Deploy de roles el 24 nov |
| **S2** | 25 nov – 8 dic | 6 | E1a 2/2 (1) · E1b invitaciones (2) · E3 avisos multi-destinatario 1/2 (3) | D3 y D7 (8 dic) | Deploy al cierre |
| **S3** | 9 – 22 dic | 6 | E3 2/2 (0,5) · E7 visita del herrador (2,5) · E8a app del cliente v1 y traza de uso (2) · Playwright con el smoke del bucle (1) | — | **H1: deploy el jue 17 dic** |
| S4 | 23 dic – 5 ene | 2 | Estabilización. **Alta del piloto de Jerez:** importar caballos, invitar clientes y herrador. Primera medida de H3 | — | Congelado 18 dic – 7 ene, salvo hotfix |
| S5 | 6 – 19 ene | 3 | E5 incidencias 1/2 *(exámenes)* | — | — |
| S6 | 20 ene – 2 feb | 3 | E5 2/2 (2) · E6 feed 1/2 (1) *(exámenes)* | — | Deploy al cierre |
| S7 | 3 – 16 feb | 6 | E6 2/2 (3) · E4 Web Push 1/2 (3) | — | — |
| **S8** | 17 feb – 2 mar | 6 | E4 2/2 (2) · E2 multi-centro y agenda del profesional (4) | **D5 en G2 (2 mar)** | **H2: 2 mar** |
| S9 | 3 – 16 mar | 6 | E14 PWA offline 1/2 | — | — |
| S10 | 17 – 30 mar | 4 | E14 2/2 (1) · E9 comunicados (3) *(Semana Santa: 21–28 mar)* | D6 (30 mar) | Deploy al cierre |
| S11 | 31 mar – 13 abr | 6 | E12 tipos de pupilaje (4) · E1c INSTRUCTOR y RIDER (1) · E10 clases: modelo y motores (1) | — | — |
| S12 | 14 – 27 abr | 5 | E10 clases: agenda del centro, pistas, profesores y pasar lista | — | — |
| S13 | 28 abr – 11 may | 6 | E10 reservas, cancelaciones y lista de espera del alumno | — | Deploy al cierre |
| S14 | 12 – 25 may | 4 | E10b bonos (3) · E13 facturación de clases 1/2 (1) *(exámenes)* | — | — |
| S15 | 26 may – 8 jun | 3 | E13 2/2 *(exámenes)* | — | **H3: 8 jun** |
| S16 | 9 – 22 jun | 3 | E11a stock MVP 1/2 | — | — |
| S17 | 23 – 30 jun | 2 | E11a 2/2 · retrospectiva y plan del segundo semestre de 2027 | — | H4: 30 jun (en riesgo) |
| *Bajo la línea* | jul 2027+ | — | E11b proveedores y pedidos · E15 exportar o transferir la ficha (D2) · E16 comunidad | — | — |

**Rama alternativa en G2 (2 mar):** si las entrevistas no validan las clases (H1 o H2 por debajo del criterio de §10) pero sí el stock (H5 ≥ 3/8), E11a+E11b (9 días) pasan a S11–S12 y las clases se desplazan detrás. E12 no se mueve.

**Por qué este orden:**
- Los roles van antes que todo lo demás: avisos, incidencias, feed y clases dependen de saber quién es propietario, profesional o alumno de cada caballo.
- El bucle mínimo (H1) va por email porque es el canal que ya funciona (`src/server/services/notifications/email.ts:67`). Push llega después de las incidencias porque las incidencias son el dolor nº 4 de la reunión y el email las cubre de inicio.
- Clases y stock esperan a G2: §9.1 exige validar con 5–10 centros antes de construir las clases. SICAB y las primeras semanas del piloto dan esas entrevistas.
- El offline (D3) llega cuando ya existen las acciones que encola (incidencia, salida al paddock, visita). Esas acciones nacen con `clientMutationId` desde S3, para no tener que migrarlas después.

---

## 4. Épicas

Formato común: **objetivo · capa · modelo de datos · tests primero · aceptación · estimación · dependencias · riesgo.** Los nombres de modelos y enums son propuestas. Cada migración que cree tablas activa RLS siguiendo el patrón de `prisma/migrations/20261003120000_libro_explotacion/` (lo vigila `tests/migrations.test.ts`).

### E1a. Roles nuevos y círculo del caballo (capa 3 · S1–S2 · 4 días)

**Objetivo.** El profesional con especialidad sustituye a `VET_EXTERNAL`. Entran `INSTRUCTOR` y `RIDER` (denegados por defecto hasta E1c). La relación de cada persona con cada caballo queda explícita.

**Modelo y migración** (dos migraciones: Postgres no deja usar un valor de enum en la misma transacción en la que se añade):
1. `enum Role` (`prisma/schema.prisma:10-16`) `+ INSTRUCTOR, PROFESSIONAL, RIDER`. `enum ProfessionalSpecialty { VET, VET_SPECIALIST, FARRIER, PHYSIO, DENTIST, NUTRITIONIST, TRAINER, OTHER }`. `Membership.specialty ProfessionalSpecialty?` y `Membership.specialtyNote String?` (p. ej. "cojeras"). `enum HorseRelation { OWNER, CO_OWNER, HALF_LEASE, RIDER, PROFESSIONAL }` y `HorseAccess.relation HorseRelation` (`schema.prisma:250`).
2. Datos: `VET_EXTERNAL → PROFESSIONAL + VET`; `HorseAccess.relation` se deduce del rol (OWNER_EXTERNAL → OWNER, PROFESSIONAL → PROFESSIONAL). `VET_EXTERNAL` se queda en el enum sin uso: quitarlo obliga a recrear el tipo y no compensa.

> `@@unique([userId, tenantId])` (`schema.prisma:179`) impone un rol por persona y centro. El caso del "propietario que además da clases" se resuelve con `INSTRUCTOR` + `HorseAccess(relation: OWNER)` sobre su caballo, sin tocar la unicidad ni las 89 líneas de los routers que usan `tenantProcedure`, `staffProcedure` o `roleProcedure`.

**Código.** `src/lib/permissions.ts` (matriz pura rol × especialidad → capacidades). `professionalProcedure` en `src/server/trpc/init.ts`. `allowedHorseIds` (`src/server/trpc/access.ts:16-33`) trata a PROFESSIONAL, RIDER e INSTRUCTOR como externos. UI de equipo (`src/components/settings/team-management.tsx`) con selector de especialidad e i18n.

**Tests primero**

`tests/permissions.test.ts`
- `test("un herrador solo puede registrar actos sanitarios de tipo FARRIER")`
- `test("un veterinario registra vacunas, desparasitaciones, revisiones y tratamientos, pero no herrajes")`
- `test("un dentista solo registra DENTAL")`
- `test("PROFESSIONAL sin especialidad no puede escribir nada")`
- `test("OWNER_EXTERNAL lee la ficha de sus caballos pero no escribe sanidad")`
- `test("RIDER e INSTRUCTOR no tienen capacidades sobre caballos hasta el módulo de clases")`
- `test("toda combinación rol × capacidad está declarada: la matriz no tiene huecos")`

`tests/procedures.test.ts` (añadir)
- `test("tenantProcedure rechaza a PROFESSIONAL, RIDER e INSTRUCTOR: su puerta es su propio router")`
- `test("professionalProcedure rechaza a OWNER_EXTERNAL y a GROOM")`

`tests/integration/roles.int.test.ts`
- `test("members.invite exige especialidad al invitar a un PROFESSIONAL")`
- `test("un herrador con HorseAccess ve ese caballo en professional.myHorses y ningún otro")`
- `test("updateRole de PROFESSIONAL a GROOM borra la especialidad")`

**Aceptación.** Un herrador invitado entra, ve solo sus caballos y no ve facturas, contactos ni la configuración. La migración aplica en la BD de CI y en staging. `SELECT count(*) FROM "Membership" WHERE role='VET_EXTERNAL'` = 0 tras el despliegue.
**Dependencias:** S0, D1. **Riesgo:** medio. El cambio de enum en producción va justo después de SICAB, y si se olvida un `roleProcedure` se abre un agujero. Mitigación: la matriz de `procedures.test.ts` recorre todas las procedures de `appRouter` (hoy 89 líneas con procedure de rol en `src/server/trpc/routers`).

### E1b. Invitar clientes y profesionales desde contactos (capa 3 · S2 · 2 días)

**Objetivo.** Pasar de "contacto" a "cliente con cuenta" en lote, para invitar a los 20 clientes del piloto (H3) sin hacerlo uno a uno.

**Modelo.** `Membership.contactId String?` (enlaza la cuenta con el contacto de facturación; hoy el portal empareja por email en `src/server/trpc/routers/portal.ts:50-56`).

**Tests primero**

`tests/client-invites.test.ts` (motor `src/lib/client-invites.ts`)
- `test("un contacto propietario de dos caballos genera una invitación con los dos caballos")`
- `test("un contacto sin email se salta y se informa del motivo")`
- `test("si el email ya es miembro, solo añade el HorseAccess que falta y no reenvía la invitación")`
- `test("dos contactos con el mismo email en distinta capitalización se agrupan en una invitación")`

`tests/integration/client-invites.int.test.ts`
- `test("members.inviteClients crea Membership OWNER_EXTERNAL y HorseAccess OWNER en una sola transacción")`
- `test("un MANAGER no puede invitar (solo OWNER)")`

**Aceptación.** Desde Contactos, "Invitar a la app" con selección múltiple: un resumen previo (n invitaciones, n sin email) y los emails enviados. **Dependencias:** E1a. **Riesgo:** bajo.

### E1c. Capacidades de INSTRUCTOR y RIDER (capa 2 · S11 · 1 día)

Se amplía la matriz de `permissions.ts`: el INSTRUCTOR pasa lista en sus clases y ve los caballos que usa; el RIDER reserva y cancela lo suyo.
**Tests:** `tests/permissions.test.ts` + `test("un INSTRUCTOR solo pasa lista en sus clases")`, `test("un RIDER solo ve sus reservas y los comunicados de sus grupos")`. **Dependencias:** E1a, D5.

### E2. Vista multi-centro (D1) y agenda del profesional (capa 3 · S8 · 4 días)

**Objetivo.** El herrador o el propietario con relación con varios centros tiene "Mis centros", "Mis caballos" y una agenda agregada. El centro programa visitas ("el herrador viene el jueves a 8 caballos").

**Modelo.** `enum VisitStatus { PROPOSED, CONFIRMED, DONE, CANCELLED }`. `ProfessionalVisit` (tenantId, professionalMembershipId, scheduledAt, status, notes, createdByMembershipId). `ProfessionalVisitHorse` (visitId, horseId, done, healthEventId?). La identidad no cambia: ya es `User` + `Membership` por centro (`schema.prisma:170-181`).

**Código.** Ruta `/mis-centros` fuera de `[tenantSlug]`. Servicio `forEachMembership(userId, fn)`: ejecuta `fn` dentro de `withTenant` de cada centro con el `ctx` de **esa** membresía. Nunca hay una consulta sin `tenantId`. Fusión pura en `src/lib/multi-center-agenda.ts`. Hoy `/dashboard` solo lista los centros (`src/app/(app)/dashboard/page.tsx:18-31`).

**Tests primero**

`tests/multi-center-agenda.test.ts`
- `test("la agenda agregada mezcla visitas de varios centros por hora y etiqueta cada una con su centro")`
- `test("dos visitas solapadas en centros distintos se marcan como conflicto")`
- `test("un centro con la membresía revocada no aparece")`

`tests/integration/multi-center.int.test.ts`
- `test("myCenters.agenda de un herrador con dos centros devuelve visitas de ambos y nada de un tercero")`
- `test("dos centros con un caballo del mismo nombre no se mezclan: cada fila lleva su centro")`
- `test("un propietario con caballos en dos centros ve 'Mis caballos' de ambos")`
- `test("el centro programa una visita de herrador a 8 caballos y el herrador la ve en su agenda")`
- `test("marcar hecho un caballo de la visita crea el HealthEvent FARRIER con autoría")`

**Aceptación.** Con dos centros de prueba, el herrador ve la semana completa. Una revisión de seguridad confirma que cada consulta lleva `tenantId`. **Dependencias:** D1, E1a, E7. **Riesgo:** **alto en seguridad**: con BYPASSRLS, una consulta sin `tenantId` filtra datos entre centros. Por eso los tests de aislamiento son obligatorios aquí.

### E3. Avisos multi-destinatario (capa 3 · S2–S3 · 3,5 días)

**Objetivo.** Herraje, vacunas, desparasitación y dentista avisan a la vez al centro, al propietario y al profesional de esa especialidad, con antelación configurable. Hoy el cron solo avisa a OWNER y MANAGER del centro (`src/app/api/cron/reminders/route.ts:72-85`) y, si se relanza, duplica emails.

**Modelo.** `Tenant.reminderLeadDays Int @default(7)`. `enum NotificationKind { HEALTH_DUE, INCIDENT, INCIDENT_ESCALATION, ANNOUNCEMENT, VISIT, BOOKING, INVOICE, STOCK }`. `Notification` (tenantId, userId, kind, title, body, url, dedupeKey, createdAt, readAt; `@@unique([userId, dedupeKey])`): bandeja dentro de la app y llave de idempotencia. `enum NotificationChannel { EMAIL, PUSH }`. `NotificationDelivery` (notificationId, channel, status, error, at).

**Código.** `src/lib/reminder-recipients.ts` (puro). La lógica del cron pasa a `src/server/services/notifications/reminders.ts` → `runReminders({ now, db, send })`, y la ruta queda como envoltorio. La regla de "acto superado" (`route.ts:98-113`) se mueve al motor.

**Tests primero**

`tests/reminder-recipients.test.ts`
- `test("un herraje que vence avisa al centro, al propietario del caballo y al herrador con acceso")`
- `test("una vacuna avisa al veterinario y no al herrador")`
- `test("un usuario que es a la vez gerente y propietario recibe un solo aviso")`
- `test("un profesional con la especialidad pero sin HorseAccess a ese caballo no recibe el aviso")`
- `test("los mozos (GROOM) no reciben avisos de vencimientos")`
- `test("se usan los días de antelación del centro: 7 por defecto, 3 si se configura")`
- `test("la clave de deduplicación es estable para el mismo acto, destinatario y antelación")`
- `test("un acto superado por otro posterior del mismo tipo no genera aviso")`

`tests/integration/reminders.int.test.ts`
- `test("ejecutar el cron dos veces el mismo día no duplica notificaciones ni envíos")`
- `test("el cron rechaza peticiones sin el Bearer CRON_SECRET")`
- `test("un fallo de envío a un destinatario no impide los demás y queda registrado en NotificationDelivery")`

**Aceptación.** En staging, un herraje con vencimiento a 7 días genera 3 emails (centro, propietario y herrador). Al relanzar el cron, 0 nuevos. **Dependencias:** E1a, D4. **Riesgo:** medio. El cron corre a las 08:00 UTC (`vercel.json`) y la ventana del día depende de `dayWindowUtc`; el cambio de hora ya está cubierto por `tests/day-window.test.ts`.

### E4. Notificaciones Web Push y email (capa 3 · S7–S8 · 5 días)

**Objetivo.** Push en la PWA, con email como respaldo y preferencias por tipo de aviso.

**Modelo.** `PushSubscription` (userId, endpoint `@unique`, p256dh, auth, userAgent, createdAt, lastSuccessAt, failedCount). `NotificationPreference` (userId, kind, push Boolean, email Boolean; `@@unique([userId, kind])`; sin fila = valores por defecto).

**Código.** `src/app/manifest.ts`, `public/sw.js` (eventos `push` y `notificationclick`), dependencia `web-push` y claves VAPID, siguiendo la guía de Next de esta versión (`node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md:20-26` y `:84-88`). **En iOS, push solo funciona con la PWA instalada en la pantalla de inicio (iOS 16.4+).** Motor `src/lib/notify-channels.ts`.

**Tests primero**

`tests/notify-channels.test.ts`
- `test("con suscripción push y preferencias por defecto, un vencimiento va solo por push")`
- `test("sin suscripción push, el aviso cae a email")`
- `test("una incidencia grave va por push y por email a la vez")`
- `test("si el usuario desactiva el email de comunicados, no recibe email aunque no tenga push")`
- `test("en horas de silencio (22:00–07:00 de Madrid) un aviso no urgente se aplaza a las 07:00, también el día del cambio de hora")`
- `test("una suscripción que responde 404 o 410 se marca para borrar")`

`tests/push-payload.test.ts`
- `test("el payload push no lleva datos clínicos: solo un título genérico y la URL")`
- `test("el payload no supera 4 KB")`

`tests/integration/push.int.test.ts`
- `test("notifications.subscribe es idempotente por endpoint")`
- `test("notify registra una NotificationDelivery por canal usado")`

E2E `tests/e2e/push-subscribe.spec.ts`: `test("con permiso concedido, activar avisos guarda la suscripción")`.

**Aceptación.** En Android Chrome y en un iPhone con la PWA instalada llega un aviso real de staging. Sin permiso, llega el email. **Dependencias:** E3, D4. **Riesgo:** medio (adopción en iOS). Hay que medir cuántos clientes del piloto instalan la PWA antes de apostar por push.

### E5. Incidencias con confirmación de lectura (capa 3 · S5–S6 · 5 días)

**Objetivo.** El mozo registra con foto "manta rota", "cojea" o "no ha comido". El propietario la lee y la confirma, y el centro ve la confirmación. Si no se confirma, se escala.

**Modelo.** `enum IncidentCategory { INJURY, LAMENESS, NOT_EATING, COLIC_SIGNS, EQUIPMENT, BEHAVIOR, OTHER }`, `enum IncidentSeverity { LOW, MEDIUM, HIGH }` y `enum IncidentStatus { OPEN, ACKNOWLEDGED, RESOLVED }`. `Incident` (tenantId, horseId, createdByMembershipId, category, severity, description, photoKeys String[], status, occurredAt, resolvedAt, resolutionNote, `clientMutationId String? @unique`). `IncidentReceipt` (incidentId, membershipId, notifiedAt, readAt, acknowledgedAt; `@@unique([incidentId, membershipId])`). `IncidentUpdate` (incidentId, authorMembershipId, text, createdAt): la descripción original no se edita (autoría, §9.9).

**Tests primero**

`tests/incidents.test.ts` (motor `src/lib/incidents.ts`)
- `test("una incidencia nueva queda OPEN y exige confirmación de todos los propietarios del caballo")`
- `test("abrir la incidencia marca readAt pero no la confirma")`
- `test("cuando confirma el último propietario, pasa a ACKNOWLEDGED")`
- `test("una incidencia grave sin confirmar a las 2 horas vence para escalado; una leve no escala")`
- `test("solo el personal del centro puede resolverla; el propietario no")`
- `test("de RESOLVED no se vuelve a OPEN: se abre otra enlazada")`
- `test("si el caballo no tiene propietarios con cuenta, se avisa al centro de que hay que llamar")`
- `test("la descripción no se edita tras crearla; las correcciones van como actualización con autor y hora")`

`tests/uploads.test.ts` (añadir)
- `test("la foto de una incidencia va a la ruta privada del tenant y del caballo")`

`tests/integration/incidents.int.test.ts`
- `test("un GROOM crea una incidencia con foto y el propietario recibe una notificación")`
- `test("un propietario no puede confirmar incidencias de un caballo ajeno (NOT_FOUND)")`
- `test("reenviar la misma incidencia con el mismo clientMutationId no la duplica")`
- `test("el cron de escalado reenvía una sola vez las graves sin confirmar")`

E2E `tests/e2e/incident-loop.spec.ts`: `test("el mozo crea una incidencia, el propietario la confirma desde el móvil y el centro la ve confirmada")`.

**Aceptación.** El flujo completo en móvil en menos de 3 toques para el mozo (categoría, foto, enviar). El centro ve un listado con estado y hora de confirmación. **Dependencias:** E1a, E3, D3. **Riesgo:** bajo-medio (fotos grandes desde móvil: comprimirlas en el cliente).

### E6. Feed de actividad del caballo (capa 3 · S6–S7 · 4 días)

**Objetivo.** "Hoy salió al paddock", "trabajó 40 min", "le vio el herrador". Es lo que mantiene al cliente abriendo la app (H3 a 4 semanas).

**Modelo.** `enum ActivityKind { PADDOCK, RIDDEN, LUNGED, WALKER, GROOMED, FARRIER, VET, PHYSIO, NOTE }`. `HorseActivity` (tenantId, horseId, kind, at, durationMin?, note?, photoKey?, authorMembershipId, visibleToOwner Boolean @default(true), `clientMutationId String? @unique`; `@@index([tenantId, horseId, at])`). Entrenamientos, actos sanitarios e incidencias **no se copian**: se fusionan al leer.

**Código.** `src/lib/horse-feed.ts`. Registro rápido en lote desde el kiosko (`src/app/(app)/[tenantSlug]/kiosko/page.tsx`): elegir 8 caballos y marcar "paddock".

**Tests primero**

`tests/horse-feed.test.ts`
- `test("el feed mezcla actividades, entrenamientos y actos sanitarios del más reciente al más antiguo")`
- `test("el propietario no ve entradas no visibles ni notas internas")`
- `test("un registro en lote de 8 caballos crea 8 entradas con la misma hora")`
- `test("los días se agrupan en hora de Madrid: una salida a las 00:30 cuenta en su día")`
- `test("un herraje registrado por el herrador aparece como FARRIER con su autor")`
- `test("un día sin registros dice 'sin actividad registrada' y no inventa nada")`

`tests/integration/feed.int.test.ts`
- `test("feed.forHorse de un OWNER_EXTERNAL solo responde para sus caballos")`
- `test("activity.logBatch rechaza caballos de otro tenant")`

**Aceptación.** El mozo registra la salida de 8 caballos en menos de 15 s y el propietario la ve en su feed. **Dependencias:** E1a, E8a. **Riesgo:** bajo técnico, alto de adopción (si los mozos no registran, el feed está vacío). Se mide con la traza de E8a.

### E7. Visita del profesional: el herrador registra (capa 3 · S3 · 2,5 días)

**Objetivo.** El herrador registra en Relincho el herraje de uno o varios caballos y propone la próxima cita. El aviso siguiente sale solo (H4).

**Modelo.** `HealthEvent.authorMembershipId String?` (autoría, §9.9). `HealthEvent.clientMutationId String? @unique` (D3). `Horse.farrierIntervalWeeks Int?`.

**Código.** Router `professional` (`professionalProcedure`): `myHorses` y `recordVisit({ horseIds[], type, date, nextDueDate?, notes })`. Los tipos permitidos salen de `permissions.healthTypesFor(specialty)`. Motor `src/lib/professional-visit.ts`.

**Tests primero**

`tests/professional-visit.test.ts`
- `test("el herraje propone la próxima cita a 6 semanas por defecto")`
- `test("si el caballo tiene un intervalo propio de 8 semanas, se usa ese")`
- `test("una visita a 8 caballos genera 8 actos sanitarios con el mismo autor y fecha")`
- `test("la próxima fecha propuesta nunca es anterior a la visita")`

`tests/integration/professional.int.test.ts`
- `test("un herrador registra un herraje en un caballo con acceso y queda con su autoría")`
- `test("un herrador no puede registrar una vacuna (FORBIDDEN)")`
- `test("un herrador no ve caballos sin HorseAccess (NOT_FOUND)")`
- `test("tras el herraje, el siguiente aviso del cron va al propietario, al centro y al herrador")`

**Aceptación.** El herrador del piloto registra una visita a varios caballos desde el móvil en menos de un minuto. **Dependencias:** E1a, E3. **Riesgo:** de adopción, no técnico (H4: 3 visitas en un mes sin recordárselo).

### E8. App del cliente: evolución de `/portal` (capa 3 · v1 en S3 · 2 días + incrementos)

**Objetivo.** Que el cliente encuentre en una sola pantalla lo que le pide acción y lo que le interesa de su caballo. Hoy el portal tiene caballos, documentos y facturas (`src/app/(app)/[tenantSlug]/portal/`) sobre `portalRouter` (`src/server/trpc/routers/portal.ts:77`).

**v1 (S3):** portada con, en este orden, lo que exige acción, próximos vencimientos y último herraje, y facturas. Navegación inferior móvil. Estados vacíos de propietario y de alumno. i18n.
**Traza de uso para H3/H4 (D7):** `UsageDay` (membershipId, day; `@@unique([membershipId, day])`), escrita como mucho una vez al día por miembro.
**Incrementos:** S6 confirmar incidencias · S7 feed · S8 activar push · S13 mis clases · S14 comprar bono.

**Tests primero**

`tests/portal-home.test.ts` (motor `src/lib/portal-home.ts`)
- `test("la portada ordena: incidencias sin confirmar, facturas vencidas y luego vencimientos")`
- `test("sin caballos, la portada muestra el estado vacío de alumno y no el de propietario")`

`tests/usage-metrics.test.ts` (motor `src/lib/usage-metrics.ts`)
- `test("activación: cuenta quien abre la app en los 7 días siguientes a la invitación")`
- `test("retención a 4 semanas: activo si hay uso en la semana 4 tras la invitación")`
- `test("el personal del centro no cuenta en las métricas de clientes")`
- `test("abrir la app 20 veces en un día cuenta como un día de uso")`

`tests/accessibility.test.ts` (añadir)
- `test("las pantallas nuevas del portal tienen destino del skip link y objetivos táctiles de al menos 44 px")`

`tests/integration/portal.int.test.ts`
- `test("portal.home devuelve solo datos de los caballos del propietario")`

**Aceptación.** Un cliente del piloto, desde el enlace de invitación, ve su caballo y su próximo herraje sin ayuda. Las métricas H3 salen de `UsageDay`, no de impresiones. **Dependencias:** E1b, E3. **Riesgo:** medio (UX para alguien que "no configura nada", §7.7).

### E9. Comunicados por grupos (capa 3 · S10 · 3 días)

**Objetivo.** Suspensiones, concursos y avisos generales para todos, por rol o por grupo (disciplina), con porcentaje de lectura.

**Modelo.** `ClientGroup` (tenantId, name, discipline `Discipline?`, que ya existe en el schema). `ClientGroupMember` (groupId, membershipId). `Announcement` (tenantId, title, body, audienceRoles Role[], groupId?, urgent, publishedAt, authorMembershipId). `AnnouncementReceipt` (announcementId, membershipId, readAt).

**Tests primero**

`tests/announcement-audience.test.ts`
- `test("un comunicado a propietarios llega a OWNER_EXTERNAL y no a RIDER")`
- `test("un comunicado al grupo de doma llega solo a sus miembros")`
- `test("un miembro de dos grupos destinatarios recibe un único comunicado")`
- `test("el personal del centro siempre recibe copia")`
- `test("el porcentaje de lectura se calcula sobre los destinatarios, no sobre todos los miembros")`

`tests/integration/announcements.int.test.ts`
- `test("announcements.publish crea recibos y notificaciones para la audiencia")`
- `test("un RIDER no puede publicar (FORBIDDEN)")`

**Dependencias:** E3, E4. **Riesgo:** bajo.

### E10. Clases y reservas (capa 2 · S11–S13 · 12 días)

**Objetivo.** Pistas, profesores, niveles, plazas, reservas, cancelaciones y lista de espera, con caballos de escuela y su bienestar. D5: construir.

**Modelo.** `Arena` (tenantId, name, capacity, covered, active). `enum LessonKind { GROUP, PRIVATE, FREE_RIDE }`. `LessonSeries` (tenantId, title, kind, level?, discipline?, weekday, startTime "HH:mm", durationMin, arenaId, instructorMembershipId, capacity, validFrom, validUntil, exceptions Date[]). `enum LessonStatus { SCHEDULED, CANCELLED, DONE }`. `Lesson` (tenantId, seriesId?, startsAt, endsAt, arenaId, instructorMembershipId, capacity, status, cancelReason). `enum BookingStatus { BOOKED, WAITLIST, CANCELLED, LATE_CANCELLED, ATTENDED, NO_SHOW }`. `Booking` (tenantId, lessonId, riderMembershipId, horseId?, status, waitlistPosition?, cancelledAt, creditId?, clientMutationId?; `@@unique([lessonId, riderMembershipId])`). `Horse.schoolHorse Boolean`, `Horse.maxLessonsPerDay Int?`. `Tenant.lessonCancelHours Int @default(24)`.

**Código.** `src/lib/lesson-schedule.ts` (series → clases en Europe/Madrid) y `src/lib/booking-rules.ts`. La reserva de la última plaza se hace en una transacción con `SELECT … FOR UPDATE` sobre la clase. Las clases entran en el calendario existente (`src/server/trpc/routers/calendar.ts`, `CalendarKind`).

**Tests primero**

`tests/lesson-schedule.test.ts`
- `test("una serie de los martes a las 18:00 genera clases a las 18:00 de Madrid antes y después del cambio de hora")`
- `test("las excepciones (festivos) no generan clase")`
- `test("regenerar una serie no duplica clases ni borra las que tienen reservas")`

`tests/booking-rules.test.ts`
- `test("con plazas libres, la reserva queda BOOKED")`
- `test("con la clase llena, la reserva entra en lista de espera con su posición")`
- `test("al cancelar alguien, sube el primero de la lista de espera")`
- `test("cancelar con 24 h o más devuelve el crédito; con menos queda LATE_CANCELLED y lo consume")`
- `test("la ventana de cancelación es configurable por centro")`
- `test("no se puede reservar una clase empezada o cancelada")`
- `test("un caballo de escuela no puede ir a más clases al día que su máximo")`
- `test("superar la capacidad de la pista con dos clases a la misma hora es conflicto")`
- `test("un profesor no puede tener dos clases solapadas")`
- `test("cancelar la clase entera cancela sus reservas, devuelve los créditos y notifica")`

`tests/integration/lessons.int.test.ts`
- `test("dos alumnos reservan la última plaza a la vez: solo uno queda BOOKED")`
- `test("un RIDER solo ve y cancela sus propias reservas")`
- `test("un INSTRUCTOR solo pasa lista en sus clases")`
- `test("un propietario reserva clase con su caballo y no con uno ajeno")`

E2E `tests/e2e/booking.spec.ts`: `test("un alumno reserva y cancela una clase desde el móvil")`.

**Aceptación.** El centro piloto monta su semana tipo de clases en menos de 30 minutos. Un alumno reserva en 3 toques. La lista de espera funciona sin intervención. **Dependencias:** G2 (D5, H1/H2), E1c, E4. **Riesgo:** **alto**: es la épica más grande, con concurrencia y zona horaria. Si G2 no la valida, se desplaza.

### E10b. Bonos (capa 2 · S14 · 3 días)

**Modelo.** `LessonPack` (tenantId, name, lessons, validityDays, price, vatRate, active). `RiderCredit` (tenantId, riderMembershipId, packId, total, remaining, purchasedAt, expiresAt, invoiceLineId?).

**Tests primero** — `tests/lesson-credits.test.ts`
- `test("reservar consume del bono que caduca antes")`
- `test("cancelar a tiempo devuelve la clase al mismo bono")`
- `test("un bono caducado no se usa ni recibe devoluciones")`
- `test("sin créditos, la reserva queda pendiente de pago si el centro admite clase suelta")`
- `test("el saldo nunca es negativo")`

**Dependencias:** E10, D6. **Riesgo:** medio.

### E11a. Stock y consumos con previsión de agotamiento (capa 1 · S16–S17 · 5 días)

**Objetivo.** El ejemplo de la reunión: 500 kg de heno al día, 40 t en almacén y aviso al 20 %, que es lo que tarda el proveedor. Hoy solo existe `Product` con `stock` (`schema.prisma:359-371`) y **ningún código lo usa**.

**Modelo.** `Product` + `capacity Decimal?`, `reorderThresholdPct Int @default(20)`, `leadTimeDays Int?`, `active Boolean @default(true)`. `enum StockMovementKind { IN, OUT, ADJUST }`. `StockMovement` (tenantId, productId, kind, quantity, at, note, authorMembershipId, clientMutationId?). `Product.stock` es una caché que se actualiza en la misma transacción.

**Código.** `src/lib/stock-forecast.ts`. Cron diario dentro de `/api/cron/reminders` → `Notification(kind: STOCK)`. Consumo teórico desde `FeedingPlan` × caballos.

**Tests primero** — `tests/stock-forecast.test.ts`
- `test("500 kg/día de heno con 40 t en almacén se agota en 80 días")`
- `test("con umbral del 20 % sobre 40 t, avisa al bajar de 8 t")`
- `test("con 10 días de plazo del proveedor, la fecha de pedido es 10 días antes del agotamiento más el margen")`
- `test("sin histórico, el consumo sale del plan de alimentación por caballo")`
- `test("una entrada de mercancía recalcula la previsión y apaga el aviso")`
- `test("un ajuste negativo de inventario no cuenta como consumo")`
- `test("con consumo cero, la previsión dice 'sin consumo' y no divide por cero")`

`tests/integration/stock.int.test.ts`
- `test("stock.recordMovement actualiza el stock en la misma transacción")`
- `test("el cron crea una sola notificación de reposición por producto y día")`

**Dependencias:** E3. H5 validada. **Riesgo:** de calendario (no hay holgura). Es lo primero que se recorta.

### E11b. Proveedores y pedidos (capa 1 · bajo la línea · 4 días)

`Supplier` (tenantId, name, contact, leadTimeDays). `PurchaseOrder` (supplierId, status DRAFT/SENT/RECEIVED, expectedAt) y `PurchaseOrderLine`.
**Tests:** `test("recibir un pedido crea las entradas de stock de sus líneas")`, `test("un pedido recibido no se puede editar")` y `test("el plazo real medio del proveedor sale de su historial")`, en `tests/purchase-orders.test.ts`.

### E12. Tipos de pupilaje: completo, media pensión y entrenamiento (capa 1/3 · S11 · 4 días)

**Objetivo.** Facturar bien los tres tipos de cliente con caballo (`01` §1.1, insight 3). La media pensión reparte la cuota entre dos pagadores.

**Modelo.** `enum BoardingServiceType { FULL, HALF_LEASE, TRAINING }` y `BoardingContract.serviceType @default(FULL)` (`schema.prisma:638`). `BoardingContractShare` (tenantId, contractId, contactId, sharePct?, fixedFee?, weekdays Int[]). Para entrenamiento: `trainerMembershipId?` y `sessionsPerWeek?`. **Hay que cambiar** `@@unique([boardingContractId, periodMonth])` (`schema.prisma:733`) a `@@unique([boardingContractId, periodMonth, clientId])`: la media pensión emite dos facturas del mismo contrato y mes.

**Refactor primero (con red).** El prorrateo vive dentro del router (`src/server/trpc/routers/invoices.ts:920-935`). Antes de cambiar nada se extrae a `src/lib/boarding-billing.ts` con tests de caracterización.

**Tests primero** — `tests/boarding-billing.test.ts`
- `test("caracterización: un contrato completo de mes entero factura la cuota mensual, como hoy")`
- `test("caracterización: un alta el día 16 de un mes de 30 días prorratea 15/30, como hoy")`
- `test("media pensión 50/50: dos facturas que suman exactamente la cuota, céntimo incluido")`
- `test("media pensión con cuota fija del medio pensionista: el propietario paga el resto")`
- `test("los extras recurrentes se cargan al propietario salvo que se marquen como compartidos")`
- `test("un reparto que no suma el 100 % se rechaza")`
- `test("el pupilaje con entrenamiento añade la línea de entrenamiento con su IVA")`

`tests/integration/boarding.int.test.ts`
- `test("generateMonthly con media pensión no factura dos veces el mismo mes a ninguno de los dos pagadores")`

**Dependencias:** ninguna fuerte (puede adelantarse si el piloto lo pide). **Riesgo:** medio: toca la facturación Veri*Factu en producción.

### E13. Facturación de clases y bonos (capa 1 · S14–S15 · 4 días)

**Modelo.** `InvoiceLine` + `lessonId?` y `riderCreditId?`. Contacto de facturación del alumno vía `Membership.contactId` (E1b). IVA por `LessonPack` (confirmar el tipo con el asesor; no lo damos por supuesto).

**Tests primero** — `tests/lesson-billing.test.ts`
- `test("la compra de un bono genera una línea con su precio e IVA")`
- `test("las clases sueltas del mes se agrupan en una línea por alumno con su cantidad")`
- `test("una cancelación a tiempo no se factura; un no presentado sí, si el centro lo configura")`
- `test("no se factura dos veces el mismo mes al mismo alumno")`

`tests/integration/lesson-billing.int.test.ts`
- `test("invoices.generateLessons crea borradores, no facturas emitidas")`
- `test("pagar un bono desde el portal marca la factura PAID y activa los créditos")` (según D6)

**Dependencias:** E10, E10b, D6. **Riesgo:** medio (fiscal; el envío real a la AEAT sigue pendiente).

### E14. PWA offline con cola de escrituras (D3 · transversal · S9–S10 · 7 días)

**Objetivo.** En la cuadra sin wifi, el mozo y el profesional registran igual. Se sincroniza al volver la conexión. Lo encolable: incidencia, actividad (paddock), comida (`FeedingLog`) y visita del profesional. Lo demás, solo online.

**Modelo.** Sin tablas nuevas: idempotencia por `clientMutationId @unique` en `Incident`, `HorseActivity`, `HealthEvent` y `StockMovement`. `FeedingLog` ya tiene una clave natural (`@@unique([horseId, date, mealType])`).

**Código.** `src/lib/offline-queue.ts` (núcleo puro con un adaptador de almacenamiento), `src/lib/offline-queue-idb.ts` (IndexedDB) y `public/sw.js` (caché del shell y página offline).

**Tests primero**

`tests/offline-queue.test.ts`
- `test("sin conexión, una incidencia se guarda en la cola con su clientMutationId")`
- `test("al volver la conexión, la cola se vacía en orden de creación")`
- `test("un 4xx saca la acción de la cola y la muestra como fallida; un 5xx o un fallo de red reintenta con espera creciente")`
- `test("reintentar una acción ya aplicada no la duplica")`
- `test("las acciones de más de 7 días se marcan caducadas y no se envían solas")`
- `test("la foto de una incidencia se comprime y no supera 1 MB en la cola")`
- `test("cerrar sesión vacía la cola de ese usuario")`

`tests/offline-queue-idb.test.ts` (con `fake-indexeddb`)
- `test("el adaptador IndexedDB persiste la cola y la recupera tras recargar")`

E2E `tests/e2e/offline.spec.ts`: `test("el mozo registra una salida al paddock sin red y aparece en el feed del propietario al reconectar")` (`context.setOffline(true)`).

**Aceptación.** Con modo avión en un Android real, se registran 3 acciones. Al reconectar aparecen todas, una sola vez. **Dependencias:** D3, E5, E6, E7, E4 (el service worker). **Riesgo:** **alto**. Safari borra el almacenamiento de webs no instaladas tras 7 días sin uso, así que hay que pedir que se instale la PWA. Además hay conflictos de orden.

### E15 (opcional). Exportar o transferir la ficha del caballo (D2 · bajo la línea)

Exportación (3 días): PDF o ZIP con sanidad, documentos (URL firmadas que caducan) y feed. La transferencia entre centros (6 días o más) **no antes de tener 2–3 centros reales** (D2).
**Tests** en `tests/horse-export.test.ts`: `test("la exportación incluye sanidad, documentos y feed del caballo y nada de otros")`, `test("solo el propietario o el centro custodio pueden exportar")` y `test("los documentos van con URL firmada que caduca")`.

### E16 (opcional). Comunidad (capa 4 · bajo la línea)

No se construye hasta que H3 dé al menos un 30 % de clientes activos a 4 semanas con 3 centros o más. Antes, como mucho, un spike de "calendario de concursos de la zona" de solo lectura. §7.8: sin falsas promesas.

---

## 5. Gantt

```mermaid
gantt
    title Relincho · roadmap 28 oct 2026 – 30 jun 2027 (1–2 devs a tiempo parcial)
    dateFormat YYYY-MM-DD
    axisFormat %d %b

    section Hitos
    H0 Gate obligatorio              :milestone, h0, 2026-11-10, 0d
    H1 Bucle mínimo en producción    :milestone, h1, 2026-12-17, 0d
    H2 Piloto completo y G2          :milestone, h2, 2027-03-02, 0d
    H3 Clases y bonos facturables    :milestone, h3, 2027-06-08, 0d
    H4 Stock MVP (en riesgo)         :milestone, h4, 2027-06-30, 0d

    section Congelaciones
    SICAB (sin deploy)               :crit, fz1, 2026-11-16, 2026-11-24
    Navidad y arranque del piloto    :crit, fz2, 2026-12-18, 2027-01-08

    section Decisiones
    S0-a BD base y S0-b ruleset      :milestone, d0, 2026-11-03, 0d
    D1 multi-centro y D2 provisional :milestone, d1, 2026-11-10, 0d
    D4 canales                       :milestone, d4, 2026-11-24, 0d
    D3 offline y D7 datos            :milestone, d3, 2026-12-08, 0d
    D5 clases (G2)                   :milestone, d5, 2027-03-02, 0d
    D6 cobro (Connect)               :milestone, d6, 2027-03-30, 0d

    section Sprint 0
    Infraestructura TDD              :s0, 2026-10-28, 2026-11-11

    section Bucle del piloto (H1)
    E1a Roles y círculo              :e1a, 2026-11-11, 2026-11-28
    E1b Invitaciones                 :e1b, 2026-11-28, 2026-12-02
    E3 Avisos multi-destinatario     :e3, 2026-12-02, 2026-12-10
    E7 Visita del herrador           :e7, 2026-12-10, 2026-12-16
    E8a App del cliente v1 y traza   :e8, 2026-12-14, 2026-12-18
    E2E smoke del bucle              :e2e, 2026-12-16, 2026-12-18
    Alta del piloto de Jerez         :pil, 2026-12-23, 2027-01-06

    section Piloto completo (H2)
    E5 Incidencias                   :e5, 2027-01-06, 2027-01-28
    E6 Feed del caballo              :e6, 2027-01-28, 2027-02-10
    E4 Web Push y email              :e4, 2027-02-10, 2027-02-23
    E2 Multi-centro y agenda         :e2, 2027-02-23, 2027-03-03

    section Producto del centro
    E14 PWA offline                  :e14, 2027-03-03, 2027-03-20
    E9 Comunicados                   :e9, 2027-03-20, 2027-03-31
    E12 Tipos de pupilaje            :e12, 2027-03-31, 2027-04-10
    E1c INSTRUCTOR y RIDER           :e1c, 2027-04-10, 2027-04-12
    E10 Clases y reservas            :e10, 2027-04-12, 2027-05-12
    E10b Bonos                       :e10b, 2027-05-12, 2027-05-22
    E13 Facturación de clases        :e13, 2027-05-22, 2027-06-09
    E11a Stock MVP                   :crit, e11, 2027-06-09, 2027-07-01

    section Bajo la línea
    E11b Proveedores y pedidos       :done, e11b, 2027-07-01, 7d
    E15 Exportar ficha (D2)          :done, e15, 2027-07-08, 5d
```

---

## 6. Definition of Done (común a toda tarea)

Una tarea está hecha cuando cumple **todo** lo siguiente:

1. **Tests antes.** Los tests listados en la épica existen y estuvieron en rojo antes del código: la PR muestra el commit `test:` previo al `feat:`, o el revisor lo comprueba ejecutando el commit de test.
2. **Pirámide completa.** Motor puro en `src/lib` con sus tests. Cada procedure nueva tiene un test de rol prohibido (sin BD) y uno de tenant ajeno (integración).
3. **Gate en verde.** `npm run gate` en local (lo impone el hook) y los checks requeridos en verde en la PR. Si se tocó un flujo del bucle, el E2E también.
4. **Migración aplicada y verificada.** SQL revisado en la PR. RLS en las tablas nuevas (`tests/migrations.test.ts`). Aplicada desde cero en la BD de CI y en la de desarrollo o staging. En producción, `npx prisma migrate status` dice "up to date" tras el despliegue y una consulta de comprobación pegada en la PR. Plan de vuelta atrás escrito (normalmente, una migración correctora).
5. **i18n.** Ninguna cadena visible fuera de `messages/es.json` y `messages/en.json`. Fechas y horas con el locale y la zona `Europe/Madrid`.
6. **Accesibilidad.** Las rutas nuevas están en `tests/accessibility.test.ts`. Objetivos táctiles de 44 px o más, foco visible, etiquetas en los formularios y contraste AA.
7. **Probado en móvil.** Viewport de 390×844 (proyecto móvil de Playwright cuando aplique) y **un móvil real** (Android Chrome e iPhone Safari) para todo lo del cliente, el mozo o el profesional. Si la acción es offline, también en modo avión.
8. **Observabilidad.** Los errores pasan por `reportError` (`src/lib/observability.ts:14`). Si la feature cuenta para H3 o H4, deja traza en `UsageDay` o en el registro correspondiente.
9. **La demo pública no se rompe.** Sigue en solo lectura (`tests/procedures.test.ts`), y `prisma/seed-demo-inversor.ts` se actualiza si la feature se ve en la demo.
10. **Desplegado** con `npm run deploy` o el workflow, fuera de las ventanas congeladas, y comprobado en producción.

---

## 7. Riesgos del plan

| # | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | **Capacidad real menor de lo supuesto** (exámenes, SICAB, ventas) | Alta | Alto | Recalibrar al cerrar S2. Si la velocidad baja del 70 % dos sprints seguidos, se aplica el siguiente recorte de §8 sin discutirlo |
| R2 | **El centro de Jerez retrasa la reapertura o no firma** | Media | Alto | Segundo candidato de SICAB o de Sevilla (§9.7: concentrar la venta). H1 se demuestra igual con el tenant de demo |
| R3 | **Las entrevistas no validan las clases** (H1/H2) | Media | Medio | G2 el 2 mar con la rama alternativa (stock primero). No se escribe código de clases antes de G2 |
| R4 | **Operación de migración base en producción** (S0-a) | Baja | Muy alto | Copia previa, ventana del 4 al 6 nov, ensayo en una copia y `migrate resolve` solo después de comprobar el diff vacío |
| R5 | **Fuga entre centros con la vista multi-centro** (BYPASSRLS, aislamiento solo por código) | Media | Muy alto | `forEachMembership` como única vía, tests de aislamiento obligatorios (DoD 2) y revisión específica de E2. A medio plazo, conectar con un rol sin BYPASSRLS |
| R6 | **Gate lento** (tsc 3 min 12 s + eslint 2 min en frío) → tentación de `--no-verify` | Media | Medio | `eslint --cache`, `tsc` incremental y el ruleset, que hace inútil saltarse el hook |
| R7 | **Push en iOS** solo con la PWA instalada | Alta | Medio | Email de respaldo siempre. Medir la instalación en el piloto antes de invertir más en push |
| R8 | **Offline en Safari**: almacenamiento borrado y conflictos | Media | Medio | Solo 4 acciones encolables, idempotencia y pedir la instalación de la PWA |
| R9 | **Datos reales del piloto con dev = prod** | Alta si no se hace S0-a | Alto (RGPD) | BD de desarrollo separada antes de H1, y contrato de encargado del tratamiento con el centro (D7) |
| R10 | **Crecimiento del alcance** por el dossier del fisioterapeuta | Alta | Medio | Todo lo nuevo entra por debajo de la línea salvo que desplace algo explícitamente |
| R11 | **Fiscalidad** de la media pensión, las clases y los bonos (IVA, Connect), con Veri*Factu sin enviar todavía a la AEAT | Media | Alto | E12 y E13 siempre en borrador. Consulta con el asesor antes de S11 |

---

## 8. Qué se recorta primero si vamos tarde

En este orden. Cada recorte libera la capacidad indicada.

1. **E16 comunidad y E15 exportar ficha.** Ya están bajo la línea.
2. **E11b proveedores y pedidos** (4 días). Ya está bajo la línea.
3. **E11a stock MVP → julio** (5 días). Si G2 eligió stock, se recortan las clases en su lugar.
4. **E13 reducido:** facturar solo bonos; las clases sueltas y los no presentados, como extras manuales (−2 días).
5. **E10b sin pago online:** bono cobrado en mano o por transferencia, sin Stripe (−1 día y sin dependencia de D6).
6. **E12 reducido:** solo el tipo de servicio; la media pensión con extras manuales (−2 días).
7. **E9 reducido:** comunicados a "todos los clientes", sin grupos (−1,5 días).
8. **E14 reducido:** cola offline solo para incidencia y salida al paddock (−2 días).
9. **E2 reducido:** lista de centros y agenda sin detección de conflictos ni programación de visitas (−1,5 días).

**No se recorta nunca:** el Sprint 0 (gate, hook, ruleset, BD efímera), los tests de aislamiento entre tenants, los avisos multi-destinatario, las incidencias y la traza de uso para medir H3/H4. Sin ellos no hay piloto que valga ni datos para decidir.
