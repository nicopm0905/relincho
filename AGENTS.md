<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Relincho (repo `equigest`): reglas para agentes y personas

Trabajamos **dos personas en paralelo**, cada una con sus propios agentes. Este fichero es el contrato común: **cúmplelo al pie de la letra**. Si una instrucción del usuario lo contradice, avisa del conflicto antes de actuar. Este fichero manda sobre tus hábitos por defecto.

## 1. Qué es el producto y dónde está la verdad

Relincho es un SaaS B2B2C: **el centro hípico paga**, y sus clientes (propietarios y alumnos) y los profesionales del caballo (veterinario, herrador, fisio…) lo usan gratis. La yeguada es un vertical secundario y la reproducción, un add-on.

Fuentes de verdad, por orden. **Léelas antes de diseñar una feature:**
1. `docs/estrategia/03-roadmap-tdd.md`: qué se construye, en qué sprint, **qué tests van primero** (§4 Épicas), el reparto en paralelo (§1.9) y la Definition of Done (§6).
2. `docs/estrategia/01-identidad-relincho.md`: capas, roles, principios (§7) y decisiones de arquitectura D1–D7 (§8).
3. `docs/estrategia/02-modelo-de-negocio.md`: precios. **No cambies `src/lib/pricing.ts` sin que lo pida una épica.**

Si una tarea no aparece en el roadmap, o choca con una decisión de §8 todavía abierta, **para y pregunta**. No improvises producto.

## 2. Stack y trampas conocidas

- Next.js **16.2.6** (App Router, RSC), tRPC v11 + superjson, Prisma 7 (la URL va en `prisma.config.ts`, **no** en `schema.prisma`), PostgreSQL en Supabase con RLS, Auth.js v5, Stripe, R2, Resend, next-intl v4 (locale por la cookie `NEXT_LOCALE`), Zod v4.
- Formularios: `standardSchemaResolver` de `@hookform/resolvers`, **nunca** `zodResolver`. UI con shadcn en estilo base-nova sobre `@base-ui/react`.
- Permisos: las procedures de `src/server/trpc/init.ts` (`tenantProcedure`, `staffProcedure` y `roleProcedure(...)`) y `src/server/trpc/access.ts` (`horseScope`, `assertHorseAccess`). **La app conecta como `postgres` con BYPASSRLS, así que el aislamiento entre centros depende de ti y no de la RLS.** Toda query lleva `tenantId` y toda procedure nueva tiene su test de rol prohibido.
- La lógica de negocio va en **motores puros** en `src/lib/*.ts`, sin Prisma ni red. Routers y componentes, finos.
- Textos visibles en `messages/es.json` y `messages/en.json`. Fechas en `Europe/Madrid`.
- Windows: ficheros en **LF**. Edita con Edit o Write. Si usas Python, abre con `newline=''`.
- Worktrees: si `node_modules` es un symlink al repo principal, **bórralo con `rm -f "$WT/node_modules"` antes de `git worktree remove`**, o vaciarás el `node_modules` real.
- Tras cambiar `schema.prisma`, reinicia `next dev`: guarda en memoria el cliente Prisma viejo.

## 3. Git Flow (obligatorio)

```
master   ●───────────────●─────────────●──────   = PRODUCCIÓN. Solo recibe release/* y hotfix/*. Tag vX.Y.Z
          \             / \           /
release/   \      ●───●   \         /            congelar, estabilizar y desplegar
            \    /          \       /
develop  ────●──●──●──●──●───●──●──●──────       = INTEGRACIÓN. Siempre en verde
               \  /  \  /       \ /
feature/        ●     ●          ●               una épica o tarea del roadmap = una rama
hotfix/                     ●── (de master, vuelve a master y a develop)
```

| Rama | Sale de | Vuelve a | Nombre |
|---|---|---|---|
| `feature/*` | `develop` | `develop` por PR | `feature/S<sprint>-<épica>-<slug>`, p. ej. `feature/S1-E1a-permisos` |
| `release/*` | `develop` | `master` por PR, más tag y merge de vuelta a `develop` | `release/vX.Y.Z` |
| `hotfix/*` | `master` | `master` por PR, más tag y merge a `develop` | `hotfix/vX.Y.Z-slug` |
| `docs/*`, `chore/*` | `develop` | `develop` | `docs/...`, `chore/...` |

Reglas:
- **Nunca hagas commit ni push directo a `master` ni a `develop`.** Todo entra por PR con el CI en verde y la **revisión de la otra persona**. Tu agente no fusiona PRs: lo hace un humano.
- **Prohibido** `push --force` a ramas compartidas, `--no-verify`, reescribir historia publicada o borrar ramas ajenas. En tu propia `feature/*`, solo `--force-with-lease` y avisando.
- Al empezar el día y antes de abrir PR: `git fetch && git rebase origin/develop` en tu `feature/*`.
- PR pequeña (orientativo: menos de 400 líneas sin contar tests ni migraciones generadas). Si una épica es grande, divídela en varias `feature/*` encadenadas.
- Las features se fusionan en `develop` con **merge commit (`--no-ff`), no squash**: el commit `test:` previo al `feat:` es la prueba del TDD.
- Commits en español con Conventional Commits: `test(ámbito): …`, `feat(ámbito): …`, `fix:`, `refactor:`, `docs:`, `chore:`, `ci:`. El ámbito es el módulo (`roles`, `avisos`, `clases`…).
- Plantilla de la PR: épica o tarea del roadmap, tests añadidos, migración (sí o no, con su SQL revisado), capturas de móvil si hay UI y checklist de la DoD (§6 del roadmap).

## 4. TDD (obligatorio)

Para cada comportamiento nuevo:
1. **Rojo:** escribe primero los tests que lista la épica en el roadmap (mismos nombres de `test("…")` y mismo fichero). Ejecútalos y **comprueba que fallan por el motivo correcto**. Haz commit con `test(...)`.
2. **Verde:** el código mínimo para que pasen. Haz commit con `feat(...)` o `fix(...)`.
3. **Refactor** con los tests en verde. Haz commit con `refactor(...)`.

- Un bug se arregla escribiendo antes el test que lo reproduce.
- **Nunca** cambies un test existente para que pase sin explicar en la PR por qué estaba mal. No borres tests ni los marques como `skip` para pasar el gate.
- Dónde va cada test (pirámide, roadmap §1.3): los motores puros en `tests/<motor>.test.ts`; los permisos de las procedures, sin BD, en `tests/procedures.test.ts`; lo que toca la BD en `tests/integration/*.int.test.ts` contra la **BD efímera**, nunca contra Supabase; el E2E con Playwright solo para el bucle crítico.

## 5. El gate: nada se sube en rojo

- `npm run gate` (tipos, lint y tests) tiene que pasar **antes de cada push**. El hook `.githooks/pre-push` lo impone y el CI (`.github/workflows/quality-gate.yml`) lo repite en cada PR a `develop` o `master`.
- Mientras no exista `npm run gate` (llega con el Sprint 0, tarea 0.1), ejecuta `npm run check` y `npm run lint` a mano antes de cada push y pega el resultado en la PR.
- Si el gate falla, **no se sube**. Se arregla o se pregunta. Un CI en rojo en `develop` es prioridad de los dos por encima de cualquier feature.
- Antes de decir "hecho": gate en verde en local **y** el CI de la PR en verde. Informa con la salida real, nunca con un "debería pasar".

## 6. Trabajo en paralelo sin pisarnos

- **Una tarea, un dueño.** Cada tarea o épica del roadmap tiene una issue de GitHub asignada. No empieces una tarea sin issue asignada a tu humano, y no toques la rama de otra persona. El reparto de cada sprint está en el roadmap §1.9.
- **Zonas calientes** (las tocan casi todas las features). Cambios mínimos, rebase frecuente y avisar en la PR:
  `prisma/schema.prisma`, `prisma/migrations/`, `src/server/trpc/init.ts`, `src/server/trpc/router.ts`, `messages/*.json`, `package.json`, `package-lock.json`, `.github/`, `.githooks/`.
  En `messages/*.json`, añade claves bajo el espacio de nombres de tu módulo, sin reordenar el fichero.
- **Protocolo de migraciones** (la causa principal de conflictos):
  1. **Solo una migración en vuelo a la vez.** Antes de crearla, comenta en la issue "migración en curso" y comprueba que la otra persona no tiene una abierta.
  2. `git rebase origin/develop` y, después, `npx prisma migrate dev --create-only --name <slug>` **contra tu BD local o de desarrollo** (§7). Revisa el SQL a mano: RLS en las tablas nuevas, y nunca uses un valor de enum en la misma migración que lo añade.
  3. Si al fusionar `develop` aparece otra migración con timestamp posterior a la tuya, **regenera la tuya** para que quede la última. No edites las migraciones ya fusionadas.
- **Features a medias en `develop`:** si una épica se fusiona por partes, lo incompleto **no se enlaza en la navegación** o va detrás de un flag en `src/lib/features.ts`. `develop` tiene que poder desplegarse en cualquier momento.
- Antes de cambiar una firma pública (procedure tRPC, motor de `src/lib` o prop de un componente compartido), busca quién la usa (`grep`) y si alguna `feature/*` abierta depende de ella.

## 7. Base de datos y datos

- **Hasta que exista la BD de desarrollo separada (Sprint 0, tarea 0.5), la base de datos de `.env` ES PRODUCCIÓN.** Contra ella están **prohibidos** `prisma migrate dev`, `prisma db push`, `prisma migrate reset`, los seeds y cualquier escritura de prueba. Mientras tanto, solo tests de motores puros y de procedures sin BD.
- Las pruebas de escritura se hacen en la BD efímera de tests. Nunca en la demo pública (está en solo lectura) ni en los datos de un piloto.
- Nada de secretos ni datos personales en el repo, en tests ni en seeds. Los fixtures llevan datos inventados.

## 8. Despliegue y acciones que siempre se escalan

- Producción = `master`. Solo se despliega desde `master` tras fusionar una `release/*` o `hotfix/*`, con el CI en verde y **fuera de las ventanas congeladas** del roadmap §3 (SICAB del 16 al 23 nov y Navidad del 18 dic al 7 ene, salvo hotfix). Un push NO despliega; el despliegue es manual (`npx vercel --prod`, o `npm run deploy` cuando exista).
- **Los agentes nunca despliegan.** Pregunta siempre antes de: desplegar, aplicar migraciones en producción, fusionar PRs, borrar ramas, ficheros o datos, hacer force-push, cambiar el CI, el hook, los rulesets o los secretos, o tocar Stripe, Veri*Factu o la AEAT.

## 9. Definition of Done

Una tarea está hecha cuando cumple **todo** el §6 del roadmap: tests escritos antes, gate y CI en verde, migración revisada y aplicada desde cero en la BD de CI, i18n, accesibilidad, probada en móvil (390×844), errores pasando por `reportError` y la demo pública intacta. Si no cumple algún punto, la PR lo dice explícitamente.
