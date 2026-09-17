# Relincho

SaaS B2B de gestión equina para yeguadas PRE y picaderos en Andalucía.

## Stack

- **Next.js 15** (App Router) + TypeScript + React Server Components
- **TailwindCSS** + shadcn/ui + Lucide icons
- **tRPC v11** para la API interna
- **Prisma 5** + PostgreSQL 16 (Supabase EU)
- **Auth.js v5** (magic link Resend + Google)
- **Stripe** para suscripciones SaaS
- **Cloudflare R2** para almacenamiento de archivos
- **Resend** para email transaccional
- **Veri\*Factu** para facturación legal española

## Arranque local

### 1. Requisitos previos

- Node.js 20+
- PostgreSQL 16 (o cuenta Supabase)

### 2. Instalación

```bash
npm install
cp .env.example .env
# Edita .env con tus credenciales
```

### 3. Base de datos

```bash
# Crear la base de datos y aplicar migraciones
npm run db:migrate

# Cargar datos demo
npm run db:seed
```

### 4. Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

El seed crea el tenant `yeguada-demo-andalucia` con 5 caballos PRE.
Accede a: `http://localhost:3000/yeguada-demo-andalucia/caballos`

---

## Configuración de servicios externos

### Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (región EU Frankfurt)
2. Copia `DATABASE_URL` (pooling) y `DIRECT_URL` de **Project Settings > Database**
3. Activa Row Level Security en la consola de Supabase tras la primera migración:

```sql
-- Ejecutar en el SQL Editor de Supabase tras prisma migrate
ALTER TABLE "Horse" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_horse ON "Horse"
  USING ("tenantId"::text = current_setting('app.current_tenant', true));
-- Repetir para todas las tablas con tenantId
```

### Auth.js (Google OAuth)

1. Crea credenciales OAuth en [console.cloud.google.com](https://console.cloud.google.com)
2. URI autorizado de redirección: `http://localhost:3000/api/auth/callback/google`
3. Añade `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` al `.env`

### Resend (email)

1. Crea cuenta en [resend.com](https://resend.com)
2. Verifica tu dominio
3. Añade `RESEND_API_KEY` al `.env`

### Cloudflare R2

1. Crea un bucket R2 en [dash.cloudflare.com](https://dash.cloudflare.com)
2. Crea credenciales R2 (API Token)
3. Habilita acceso público o usa dominio personalizado
4. Añade las variables `R2_*` al `.env`

### Stripe

1. Crea cuenta en [stripe.com](https://stripe.com)
2. Crea 3 precios (Starter, Pro, Enterprise)
3. Configura el webhook: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
4. Añade las variables `STRIPE_*` al `.env`

---

## Despliegue en Vercel

```bash
# Instala Vercel CLI
npm i -g vercel

# Despliega
vercel

# Configura variables de entorno en vercel.com/[proyecto]/settings/environment-variables
# Los crons de vercel.json se activan solos en producción:
#   /api/cron/reminders      cada día a las 08:00 — recordatorios sanitarios
#   /api/cron/weekly-digest  lunes a las 07:00 — resumen semanal de la yeguada
# Ambos exigen CRON_SECRET en la cabecera Authorization.
```

---

## Demo pública (solo lectura)

El QR del flyer no puede caer en un muro de login. `/demo` ofrece "Probar sin
registro" y esa entrada abre la yeguada de demostración dentro del panel real:

- El tenant es `DEMO_TENANT_SLUG` (`yeguada-demo-andalucia` por defecto).
- Quien no es miembro entra con un contexto de solo lectura. La guardia vive en
  `src/server/trpc/init.ts` y corta **cualquier** mutation de cualquier router
  con un 403, así que no hay que proteger procedure a procedure.
- El aviso de que aquello es una demo se pinta desde
  `src/components/layout/demo-banner.tsx`.

Los datos salen del seed: `npm run db:seed` (yeguada, caballos y sanidad) y
`npm run seed:rendimiento` (periodización, que es lo que llena rendimiento).

---

## Comandos útiles

```bash
npm run db:generate    # Genera el cliente Prisma
npm run db:migrate     # Crea y aplica migraciones
npm run db:push        # Push directo a la BD (dev)
npm run db:studio      # Abre Prisma Studio
npm run db:seed        # Carga datos demo
```

---

## Estructura del proyecto

```
src/
├─ app/
│  ├─ (auth)/           # Login, magic link
│  ├─ (app)/
│  │  ├─ [tenantSlug]/  # App multi-tenant
│  │  └─ onboarding/    # Registro de nueva finca
│  └─ api/
│     ├─ trpc/          # Handler tRPC
│     ├─ webhooks/      # Stripe webhook
│     └─ cron/          # Recordatorios email
├─ server/
│  ├─ db/               # Prisma + helper RLS
│  ├─ auth/             # Auth.js config
│  ├─ trpc/             # Routers tRPC
│  ├─ actions/          # Server Actions
│  └─ services/         # R2, email, billing
├─ components/          # shadcn/ui + componentes
└─ lib/                 # Utils, formatters, stripe
prisma/
├─ schema.prisma        # Modelo de datos completo
└─ seed.ts              # Datos demo
```

---

## Roadmap MVP

- [x] Auth (magic link + Google)
- [x] Multi-tenant (Tenant + Membership + RLS)
- [x] CRUD Caballos (foto a R2)
- [x] Sanidad (HealthEvent + cron recordatorios)
- [x] Tareas
- [x] Stripe (suscripción SaaS + portal)
- [ ] Módulo billing-verifactu (Veri*Factu AEAT)
- [ ] Reproducción (ciclos, cubriciones, gestación)
- [ ] Portal propietario externo (OWNER_EXTERNAL)
- [ ] Importador CSV caballos
- [ ] Dashboard de costes por caballo
- [ ] i18n inglés (PRE internacional)
