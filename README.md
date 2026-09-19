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

Google es la vía de entrada principal: sin `GOOGLE_CLIENT_ID` y
`GOOGLE_CLIENT_SECRET`, la pantalla de acceso lo avisa en vez de ofrecer un
botón que no funciona.

1. Crea credenciales OAuth en [console.cloud.google.com](https://console.cloud.google.com)
2. URI autorizado de redirección: `http://localhost:3000/api/auth/callback/google`
   (y el equivalente `https://tu-dominio/api/auth/callback/google` en producción)
3. Publica la pantalla de consentimiento y rellena nombre y logo: con los
   permisos básicos (`openid email profile`) no hace falta verificación, pero en
   modo prueba solo entran 100 usuarios añadidos a mano
4. Añade `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` al `.env`

### Resend (email)

Resend **solo envía desde un dominio verificado**: el único que funciona sin
verificar es `resend.dev` y sirve únicamente para pruebas. Sin `EMAIL_FROM` con
dominio propio, los envíos se omiten y queda anotado en el log; no se inventa un
remitente que rebotaría.

1. Crea cuenta en [resend.com](https://resend.com)
2. Verifica tu dominio (registros SPF y DKIM)
3. Añade `RESEND_API_KEY` y `EMAIL_FROM="Relincho <hola@tudominio.es>"` al `.env`

Mientras no haya dominio verificado, el acceso por enlace mágico se puede
mantener apagado con `EMAIL_LOGIN_ENABLED` (por defecto se apaga solo en
producción si Google está configurado).

### Cloudflare R2

Hace falta para las fotos de los caballos y para el gestor documental. El bucket
de documentos debe ser **privado**: los pasaportes, radiografías y analíticas se
sirven con URLs firmadas que caducan, nunca desde una URL pública permanente.

1. Crea un bucket R2 en [dash.cloudflare.com](https://dash.cloudflare.com)
2. Crea credenciales R2 (API Token) con permiso de lectura y escritura
3. Añade las variables `R2_*` al `.env` (la web pública opcional solo se usa
   para las fotos, no para documentos)

Sin `R2_*`, en local las subidas van a `public/uploads` (que está ignorado por
git); en producción esa ruta es de solo lectura y el gestor avisa de que el
almacenamiento no está configurado.

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
# El build aplica las migraciones pendientes antes de compilar:
#   prisma generate && prisma migrate deploy && next build
# Ojo: `migrate deploy` también corre en los despliegues de preview, así que
# ambos apuntan a la base de datos real. Si algún día hace falta una base de
# datos de preview, hay que separar los entornos.
# Los crons de vercel.json se activan solos en producción:
#   /api/cron/reminders      cada día a las 08:00 UTC
#   /api/cron/weekly-digest  lunes a las 07:00 UTC
# Vercel programa en UTC: las 08:00 son las 10:00 de España en verano.
# Ambos exigen CRON_SECRET en la cabecera Authorization.
```

### Antes de desplegar

```bash
npm run check        # tipos + pruebas unitarias
npm run check:http   # contra un servidor levantado (por defecto localhost:3000)
npm run check:http -- https://relincho.vercel.app   # contra la instancia real
```

`check:http` comprueba lo que de verdad rompe la venta si falla: que el panel
demo abra sin cuenta, que en la demo **no** se pueda escribir, que sin cabecera
de yeguada no se lea nada, que un panel ajeno siga pidiendo sesión, que los
crons exijan su secreto y que la pantalla de acceso ofrezca una vía que pueda
funcionar.

`npm run lint` existe, pero arrastra errores anteriores a este trabajo (en su
mayoría `no-explicit-any`): no lo uses todavía como puerta de calidad.

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

## Gestor documental

`/[yeguada]/documentos` guarda pasaportes, radiografías, analíticas, contratos
y seguros, cada uno ligado a su caballo (el portal del propietario los ve en solo
lectura). Los detalles que importan:

- El fichero vive en un bucket **privado**: se guarda su clave y se sirve con
  una URL firmada que caduca en minutos. Un enlace reenviado deja de funcionar.
- `ownsDocumentKey` comprueba que la clave esté dentro de la carpeta de esa
  yeguada, para que nadie adjunte a su ficha el fichero de otra.
- La cuota por yeguada es `DOCUMENTS_QUOTA_MB` (512 MB por defecto) y se
  comprueba en el servidor, no en el navegador.
- El tipo de archivo y el tamaño se validan antes de firmar la subida, con
  extensión deducida del MIME y nunca del nombre del fichero.

---

## Aviso de fallos y de dónde vienen los clientes

- Los fallos se anotan como una línea JSON en los logs de Vercel a través de
  `reportError` (`src/lib/observability.ts`). Si defines `ERROR_WEBHOOK_URL` con
  un webhook de Slack o Discord, también llega el aviso allí. No hay servicio
  externo de monitorización todavía: cambiar a Sentry es sustituir ese fichero.
- El navegador manda sus propios errores a `/api/report-error`, que los reenvía
  al mismo canal con un tope por IP.
- El canal de llegada se guarda en la cookie que deja el middleware: quien entra
  por `?src=flyer-jerez` se lleva esa marca y el alta la escribe en
  `Tenant.acquisitionSource`. Se apunta el **primer** toque, así que el QR de una
  feria sigue contando semanas después. Para leerlo: `npm run db:studio`.

---

## Comandos útiles

```bash
npm run check          # tsc --noEmit + pruebas unitarias
npm run check:http     # comprobaciones HTTP contra un servidor levantado
npm run verify:engines # invariantes del motor de rendimiento
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

## Roadmap

- [x] Auth (Google + enlace mágico, este último sujeto a dominio verificado)
- [x] Multi-tenant (Tenant + Membership + RLS)
- [x] CRUD Caballos (foto a R2)
- [x] Sanidad (HealthEvent + cron recordatorios)
- [x] Tareas
- [x] Stripe (suscripción SaaS + portal, con aviso de impago)
- [x] Reproducción (ciclos, cubriciones, gestación)
- [x] Portal propietario externo (OWNER_EXTERNAL)
- [x] Importador Excel de caballos
- [x] Rendimiento (periodización, carga, alertas de tendón)
- [x] Gestor documental (bucket privado, URLs firmadas)
- [x] i18n inglés en escaparate y acceso
- [ ] Módulo Veri*Factu AEAT (la obligación se aplazó a 2027; hasta entonces
      la web no lo anuncia como disponible)
- [ ] Dashboard de costes por caballo
- [ ] Exportar los datos de una yeguada (CSV o Excel)
- [ ] Monitorización con servicio externo (Sentry) en lugar del webhook actual
- [ ] Limpiar los errores de lint heredados (`no-explicit-any` en 20 ficheros)
