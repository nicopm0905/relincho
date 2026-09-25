# Facturación: qué se ha añadido (F1–F3) y cómo probarlo

Commits en `master` (aún sin desplegar): `07f1a33` F1 · `44e02b9` y `29bdac7` F2 · `a4f3c66` F3 · `ad377e8` solo finales de línea.

## Antes de probar

1. `git pull`, `npm install` y **`npx prisma generate`**. Reinicia `next dev`: si no, mantiene el cliente Prisma viejo y falla al usar las columnas nuevas.
2. **La migración `20260928120000_facturacion_pago_exencion` ya está aplicada en la base de datos compartida** (Supabase). `prisma migrate deploy` dirá «up to date»; no hay que hacer nada más. Añade `Tenant.iban`, `Tenant.paymentTerms`, `InvoiceLine.exemptionCause` e `Invoice.emailedAt` (todas opcionales).
3. `npm run check:tests` → 140 tests. Ahora arranca con `--conditions=react-server` (algunos módulos son `server-only`).
4. Para emitir facturas la yeguada necesita **NIF válido y dirección fiscal** (Ajustes). Para enviar por email hacen falta `RESEND_API_KEY` y `EMAIL_FROM` con dominio verificado; sin ellos el envío responde con un error legible.

## F1 · Integridad

| Qué | Dónde | Cómo probarlo |
|---|---|---|
| Editar borradores | Botón **Editar** en un borrador → `/facturacion/[id]/editar` | Crea una factura, edítala, cambia líneas y guarda. Una emitida no tiene el botón. |
| Series de facturación | `/facturacion/series` (botón **Series**) | Crea una serie `F`/2026, márcala por defecto. Intenta cambiar el prefijo de una serie que ya tiene facturas: lo rechaza. |
| Saldo con rectificativas | Detalle de una factura emitida → **Rectificar** | Emite una factura, rectifícala «anulando el importe entero» y emite la rectificativa. La original pasa a mostrar **«Anulada (rectif.)»**, saldo 0, y desaparece de lo pendiente en Inicio. |
| Devoluciones | Factura cobrada + rectificativa por diferencias | Cobra una factura entera, rectifícala a la baja: el bloque de pagos muestra **«A devolver al cliente»** y permite **Registrar devolución** (importe negativo). |
| Cobros sobre rectificativas | Detalle de una rectificativa | No tiene bloque de pagos: los cobros van siempre en la original. |
| Stripe | Webhook y portal del propietario | El checkout del portal cobra lo **pendiente**, no el total. Un pago de Stripe sobre una factura anulada/cobrada se registra igualmente y avisa por `reportError` para devolverlo a mano. |
| Cron de vencidas | `/api/cron/reminders` | Ya no marca vencidas las rectificativas ni las facturas saldadas. |

Reglas de negocio: la factura emitida no cambia (triggers en BD); se corrige con rectificativa. La rectificativa va en serie propia `R-año`, creada sola. El saldo se calcula en `src/lib/invoice-balance.ts`, sin migración.

## F2 · PDF, cobro y envío

- **PDF** (`/api/invoices/[id]/pdf`): marca de agua **BORRADOR** en cada página, aviso «FACTURA ANULADA», y paginación de facturas largas (antes las líneas se salían de la hoja). Prueba: una factura de ~60 líneas.
- **IBAN y condiciones de pago**: en **Ajustes → Información de la finca**. El IBAN se valida (solo España, dígito de control). Sale como «Forma de pago» en el PDF de facturas vivas (no en borradores, anuladas ni rectificativas).
- **Exención de IVA**: una línea con IVA 0 % exige su causa (E1–E6) en el editor y en el diálogo de rectificar; sin ella **no se puede emitir**, y el error indica qué línea. El PDF la muestra («Exento E1» + texto legal) y el XML de Veri*Factu la declara como `OperacionExenta` (antes iba como S1 con tipo 0).
- **Enviar por email**: botón en facturas emitidas. Adjunta el PDF, las respuestas del cliente van al correo de quien envía, y la factura muestra «Enviada por email el …».

## F3 · Gestión

- **Listado** (`/facturacion`): búsqueda por cliente o número, año, trimestre (hora de Madrid), estado, paginación de 25. Todo en la URL.
- **Resumen**: Facturado (neto), Cobrado, Pendiente (con lo vencido) y A devolver. No cuenta borradores ni anuladas y no cambia al filtrar por estado.
- **Libro CSV** (botón **Libro CSV**, solo OWNER/MANAGER; `/api/invoices/export?tenant=<slug>&year=2026&quarter=3`): una fila por factura con base y cuota por tipo (21/10/4), base exenta y otros tipos, total y estado. Anuladas a cero, rectificativas en negativo, fila de totales. Se abre en Excel en español.

## Guion de prueba rápido (10 min)

1. Ajustes: NIF válido, dirección, IBAN `ES91 2100 0418 4502 0005 1332` (válido de ejemplo).
2. Series: crea `F`/2026 por defecto.
3. Nueva factura con una línea al 21 % y otra al 0 % con causa E1 → **Emitir** → abre el PDF (QR, forma de pago, exención).
4. Registra un cobro parcial; comprueba el saldo en el listado y el resumen.
5. **Rectificar** por diferencias (−20 €) → edita el borrador de la rectificativa → emítela. El «Facturado» del resumen baja; la original conserva su saldo.
6. Filtra por trimestre y descarga el **Libro CSV**; comprueba que la rectificativa sale en negativo.
7. Intenta emitir una línea al 0 % sin causa: debe rechazarlo.

## Pendiente / límites

- **Envío real a la AEAT**: falta certificado por yeguada, validar el XML contra el XSD vigente, `VERIFACTU_PRODUCER_NIF` y `VERIFACTU_ENV=prod`. Los registros quedan en `VerifactuRecord` como `PENDING`.
- Paginación y totales se calculan en memoria (bien hasta cientos de facturas por yeguada).
- Los borradores o `generateMonthly` con extras a 0 % quedan sin emitir hasta añadir la causa de exención.
- `git push` no despliega: `npx vercel --prod`.

## Datos de prueba ya cargados

Yeguada **Finca Los Olivos** (`/fincaolivos/facturacion`), cuenta OWNER `relinchoappweb@gmail.com` (acceso por enlace mágico o Google). Se cargaron con `scripts/seed-facturacion-prueba.ts` y llevan «[Prueba]» en la descripción. Emisor: CIF de ejemplo `B12345674`, IBAN de ejemplo, dirección en Jerez.

| Factura | Qué permite probar |
|---|---|
| `F2026-2` Pupilaje septiembre | Emitida sin cobrar, con línea exenta E1 → PDF con IBAN y exención. **Enviar por email** (cliente «Prueba · Cliente con NIF», `relinchowebapp@gmail.com`). |
| `F2026-3` Herrado y forraje | Cobro parcial (200 €), dos tipos de IVA (21 y 10 %). |
| `F2026-4` Doma básica | Cobrada y **rectificada a la baja** (`R2026-1`, −50 €) → «A devolver» 60,50 €; probar **Registrar devolución**. |
| `F2026-5` Pupilaje por error | **Anulada por rectificativa** (`R2026-2`): saldo 0, sin botón Rectificar. |
| `F2026-6` Factura duplicada | **Anulada** con registro de anulación. |
| `F2026-7` Clase suelta | **Simplificada (F2)**: cliente sin NIF, menos de 400 €. |
| `F2026-8` Pupilaje agosto | **Vencida** (badge rojo, aparece en el Inicio). |
| 3 borradores | «Borrador editable» (Editar / Emitir / Borrar); «0 % sin causa» y «500 € sin NIF» → **Emitir debe rechazarlos** con un mensaje claro. |

Resumen esperado en el periodo actual (T3 2026): facturado 2 124,00 €, cobrado 442,00 €, pendiente 1 742,50 € (96,80 € vencido), a devolver 60,50 €.

**Ojo:** las facturas emitidas no se pueden borrar (numeración sin huecos + registro Veri*Factu), solo se anulan o rectifican; no las cuentes para nada real. La `F2026-1` y dos borradores («Capitán», etc.) ya existían antes en esa yeguada.
