# Relincho: modelo de negocio para centros hípicos

> **Estado:** borrador para discutir entre socios · 27 oct 2026
> **Documentos relacionados:** `01-identidad-relincho.md` (qué es Relincho y para quién), `src/lib/pricing.ts` (precios vigentes), `docs/product-definition.md` (definición anterior, para yeguadas).
> **Fecha de consulta de las fuentes web:** 27 oct 2026, salvo que se indique otra.
>
> **Etiquetas usadas en todo el documento:**
> **[H]** hecho con fuente enlazada · **[E]** estimación propia con el cálculo a la vista · **[O]** opinión o recomendación.
> Cuando una cifra viene de un agregador (Capterra, GetApp) o de un blog, se indica. Si no se encontró un precio, aparece "no publicado".

---

## 0. Resumen en 10 líneas

1. **[H]** La idea de que "nadie reúne gestión del centro, app del cliente y profesionales" **es falsa en Reino Unido**. Horsepower ya lo hace por 9,99–19,99 £ al mes, con propietarios y profesionales gratis. En España, Equimondo regala la gestión y cobra como máximo 45 € al mes por la facturación.
2. **[E]** El mercado español de software para centros es **pequeño**: entre 2 y 5 M€ de ingresos anuales potenciales en total. Con solo España y solo suscripción, Relincho es una buena empresa pequeña. Para ser una empresa grande hace falta salir de España o añadir ingresos transaccionales.
3. **[O]** Modelo recomendado: **suscripción por centro con tramos de caballos, facturación incluida y clientes y profesionales gratis e ilimitados.** Sin comisiones sobre el pupilaje en el primer año.
4. **[O]** Hay que mantener la regla "nunca por usuario". Pero **el código la incumple hoy**: `maxUsers` limita a 3 y 10 usuarios. Ese límite hay que quitarlo.
5. **[O]** Ideas que hay que descartar: el pago único, la app a 3,40 € al año para 2 millones de usuarios y el hardware propio. Ideas que hay que aplazar: la publicidad y el patrocinio (hasta tener 5.000 propietarios activos) y los datos agregados (con fin científico y sin venta).
6. **[H]** Veri*Factu ya no es un argumento urgente. Hacienda anunció el 8 oct 2026 que aplaza las obligaciones pendientes a **octubre de 2028** ([Infocop](https://www.infocop.es/hacienda-atiende-la-peticion-de-ata-y-aplazara-hasta-octubre-de-2028-la-aplicacion-de-verifactu-para-autonomos-y-profesionales/)).
7. **[E]** Escenario base: **unos 100 centros y unos 135 k€ de ingresos recurrentes anuales a los 36 meses.** Escenario conservador: 38 centros y 32 k€. Escenario optimista: 189 centros y 293 k€.
8. **[O]** El canal más barato es el **referido de profesionales**, pero solo funciona cuando hay varios centros cerca. Al principio el canal es la **venta directa del fundador en Jerez y Sevilla**. La federación es la palanca grande, por el precedente del Pegasys británico, pero su ciclo de venta es lento.

---

## 1. Competencia

### 1.1 Software de gestión para centros, cuadras y *livery yards*

Precios sin IVA salvo que se indique otra cosa. "Agregador" significa que el precio sale de Capterra o GetApp y no de la web del fabricante.

| Producto (país) | A quién cobra | Modelo y precio | Qué incluye | Fuente |
|---|---|---|---|---|
| **Equimondo** (FR, con web en España) | Al centro | **[H]** Gestión **gratis para siempre**. Facturación: **19 €/mes** hasta 35 jinetes, **29 €** de 36 a 80 y **45 €** con más de 80. Sin permanencia ni alta. Los "jinetes de paso" no cuentan. Afirma tener más de 900 centros y 120.000 jinetes al mes | Agenda, reservas online, progreso del jinete, mailing, web, recepción de facturas de proveedores. El plan de pago añade facturas y presupuestos con firma, bonos prepago, cobro con tarjeta y domiciliación | [equimondo.es](https://equimondo.es/) |
| **GESTHIP** (ES) | Al centro | **[H]** Tramos por alumnos **y** caballos: PONY (100 alumnos y 10 caballos), COB (150 y 25), FULL (250 y 50), EXTRA FULL (375 y 70), ILIMITADO. **Precio: no publicado** ("Consulta") | Escuela, pupilaje, facturación ilimitada, TicketBAI, cobro online, RR. HH., firma online y rentabilidad. Extras de pago: soporte premium, puesta en marcha y cobro con tarjeta | [gesthip.com/planes](https://gesthip.com/planes/) |
| **Hipicgest** (ES) | Al centro | **[H]** No publicado | Pupilaje (boxes, paddocks, alimentación, herrajes, vacunas), facturación multiempresa, escuela y una app para monitores y alumnos | [hipicgest.com](https://www.hipicgest.com/) |
| **Anolla** (multipaís, también ES, DE y NL) | Al centro, por uso | **[H]** Sin alta ni cuota mensual. **Comisión cuando se confirma una reserva** (tasa no publicada). Más de 20 módulos de pago (precio no publicado) | Reservas de clases, asignación de profesor y caballo, boxes, campamentos | [anolla.com/es/precios](https://anolla.com/es/precios), [anolla.com/es/software-de-equitacion](https://anolla.com/es/software-de-equitacion) |
| **Equicty** (Equstable y Equclub, UE) | Al centro, por tramo de caballos y con **usuarios ilimitados** | **[H]** Equivalente mensual pagando trimestral/anual: hasta 10 caballos 39/35 €; de 11 a 25, 66/59 €; de 26 a 50, 99/89 €; de 51 a 75, 119/107 €; de 76 a 100, 145/131 €; de 101 a 150, 165/149 €; de 151 a 250, 199/179 €. Módulos: Finanzas 39/35 €, Cría 59/53 €, Nutrición 36/32 €, Competición 13/12 € y API 13/12 €. Para clubes, Equclub desde 39/35 €. Cobros por Stripe **sin comisión de Equicty** | Gestión de cuadra completa con módulos opcionales | [equicty.com/pricing](https://www.equicty.com/pricing) |
| **Horsepower** (UK) | **Al yard, nunca por miembro** | **[H]** Gratis hasta 3 caballos. **Pro 9,99 £/mes** (1 yard y 20 caballos, con facturación del *livery*). **Max 19,99 £/mes** (sin límite de yards ni caballos) | Propietarios, personal y profesionales gratis. **Cuenta gratuita para veterinario, herrador, dentista y fisio** sin necesidad de yard. Clases con bonos, emparejamiento de jinete y caballo por nivel y peso, Stripe propio del yard sin comisión, Xero y QuickBooks | [horsepower.page](https://horsepower.page/) |
| **LIVERYLive** (UK) | Al gerente del yard | **[H]** "Desde 2 £, por uso, al mes" según el agregador. **No consta la unidad.** App del propietario (SOLO) y calendario de pistas (ARENAS) gratis | Pizarra de tareas, Xero y QuickBooks | [Capterra UK](https://www.capterra.co.uk/software/1102567/LIVERYLive) (agregador) |
| **Pegasys** (UK, de la asociación ABRS+) | Al centro, **solo si es socio de ABRS+** | **[H]** **45 £/mes fijos**, sin tramos ni extras. Disponible desde el 1 abr 2026 | Agenda, reservas, bonos, facturación recurrente con Stripe, bienestar del caballo (veterinario, herrador, vacunas, dentista, fisio) con avisos, mensajería, asistente de IA, Excel y **datos anónimos de participación para la defensa del sector** | [abrs-info.org/pegasys](https://www.abrs-info.org/pegasys/), [British Equestrian, 25 mar 2026](https://www.britishequestrian.org.uk/news/abrs-launches-riding-school-management-system-to-support-centres-through-rising-costs) |
| **EC Pro** (US) | Al centro | **[H]** Desde **75 $/mes** (clientes, caballos y usuarios ilimitados). Capterra UK muestra **155 $**, así que las fuentes no coinciden | Escuela, cuadra y centro ecuestre | [Software Advice](https://www.softwareadvice.com/event-booking/ec-pro-profile), [Capterra UK](https://www.capterra.co.uk/software/197564/ec-pro) (agregadores) |
| **BarnManager** (US) | A la cuadra, con usuarios y caballos ilimitados | **[H]** Essentials **40 $/mes** (400 $/año). Pro **70 $/mes** (700 $/año), con facturación | Registros, calendario, alimentación y medicación, avisos de caducidad. Pro añade facturas recurrentes, cobros y QuickBooks | [barnmanager.com/pricing](https://www.barnmanager.com/pricing) |
| **Stable Secretary** (US) | Por tramo de caballos | **[H]** Personal (3 caballos) 8 $/mes; Copper (6) 35 $; Bronze (15) 46,50 $; Silver (30) 57 $; Gold (ilimitado) 78,50 $ | Facturación, cobros con tarjeta (con comisión aparte) y QuickBooks | [stablesecretary.com/professional-plans](https://stablesecretary.com/professional-plans) |
| **Prism** (sin verificar el país) | Por **módulo** y tramo de caballos | **[H]** Por módulo: 30 $/mes (1–14 caballos), 90 $ (15–49), 125 $ (50–99), 150 $ (100+). **Alta y puesta en marcha aparte.** La URL es de preproducción, así que puede no ser definitivo | Comunicación y web, cuadra, cría, finanzas, RR. HH. | [prepro.prism.horse/pricing](https://prepro.prism.horse/pricing) |
| **Barningo** (UE) | Por tramo de caballos | **[H]** Gratis. Starter 29 €/mes (6–20 caballos). Professional 59 €/mes (21–50) | Gestión de cuadra y alimentación | [GetApp](https://www.getapp.com.au/software/2292928/horse-barn-management-software) (agregador) |
| **ReitZeit** (DE) | Nadie | **[H]** Gratis para la cuadra y para el jinete, según el fabricante | Reserva de pista, lista de espera y avisos al grupo | [App Store](https://apps.apple.com/app/id1524210764) |
| **Equimov** (FR, *marketplace* de boxes) | A la reserva | **[H]** **13 % de comisión** por reserva | Alquiler de boxes y paddocks | [Dealroom](https://app.dealroom.co/companies/equimov) (sin fecha) |

**Otro dato relevante [H]:** la RFHE está construyendo con Criterian **su propia plataforma de gestión**. Cubre licencias de jinetes y caballos, competiciones, comités organizadores y pagos con pasarela, y abre el calendario 2027 el 1 sep 2026 ([informe de julio de 2026](https://rfhe.com/wp-content/uploads/2026/07/3-2-1-Desarrollo-Plataforma-de-Gestion-Informe-Julio-2026.pdf)). No gestiona centros, así que hoy no compite con Relincho. Sí es **una integración obvia** (licencia del caballo) y **un riesgo** si un día amplía su alcance.

### 1.2 Apps del propietario (B2C)

| Producto | Modelo y precio | Qué nos enseña | Fuente |
|---|---|---|---|
| **Equilab** (SE) | **[H]** Premium a 12,99 $/mes, 59,99 $/6 meses o **99,99 $/año** (App Store de EE. UU., consultado el 2 jul 2026). Dice tener más de 1 millón de usuarios | **[H, fuente secundaria sin verificar]** Unos 100.000 usuarios activos y **unos 0,9 M$ de ingresos en 2024**, con 1,16 M$ captados. Con la app líder mundial, el B2C de pago apenas pasa del millón | [apppricinglab](https://apppricinglab.com/iap/apple/1133163586), [Lazyweb](https://www.lazyweb.com/company/equilab) |
| **Equisense** (FR) | **[H]** Free 0 €; Motion 2,99 €/mes (con sensor); Rider **99 €/año**; **Pro 399 €/año**, que incluye la gestión de clases | **[H]** Vendía el sensor por 199–399 € en pago único y pasó a suscripción porque *"the current business model no longer allows us to continue innovating and developing new features"* | [planes](https://blog.equisense.com/en/discover-the-new-equisense-app-subscriptions-a-plan-for-every-rider/), [motivo](https://blog.equisense.com/en/new-app-what-to-expect/) |
| **LIVERYLive SOLO** y **Horsepower** (propietario) | **[H]** Gratis | El estándar de mercado es que **el propietario no paga** cuando está en un centro que sí paga | Ver 1.1 |
| **Nightwatch** (cabezada inteligente, US) | **[H]** 799,99 $ por la cabezada más **planes desde 49,99 $/mes** (dato de 2019) | El IoT equino exige hardware caro **y además** una suscripción | [Cowgirl Magazine, 2019](https://www.cowgirlmagazine.com/smartest-horse-halter/) |

### 1.3 Qué sacamos de la competencia

- **[H]** El precio que va a encontrar un centro español que busque en Google es **Equimondo: gestión gratis y facturación a 45 € como máximo.** Cualquier precio por encima de 100 € al mes hay que justificarlo con valor visible el primer día.
- **[H]** El modelo "por centro y por tramo de caballos, usuarios ilimitados" es **el estándar del sector** (Equicty, Horsepower, Stable Secretary, BarnManager). La regla 1 de `pricing.ts` es correcta.
- **[H]** Los que cobran por cobro (Anolla, Equimov) son *marketplaces* o motores de reserva. Los de gestión **presumen de no cobrar comisión** (Horsepower y Equicty; Equimondo anuncia "sin comisión para el centro" en su servicio oPaddock).
- **[H]** El "círculo del caballo" con profesionales gratis **ya existe** (Horsepower). **[O]** No es un foso defensivo. Es una condición mínima para competir. Lo que nos defiende es: (1) el idioma y la normativa española (Veri*Factu y TicketBAI, libro de explotación y REGA), (2) estar físicamente en Andalucía y (3) la densidad de la red local de herradores y veterinarios.
- **[H]** Pegasys demuestra que **una asociación sectorial puede distribuir software a precio fijo a sus socios**. El equivalente español sería la Federación Andaluza de Hípica o una asociación de centros.
- **[O]** Comparativa para un centro de 40 caballos con facturación: Equimondo 45 €, Horsepower unos 23 €, Pegasys unos 52 €, BarnManager Pro unos 64 €, Stable Secretary Gold (más de 30 caballos) unos 72 €, Equicty 99 + 39 = 138 €. Hoy, **Relincho Rendimiento con el módulo de facturación cuesta 149 + 39 = 188 €: es el más caro.** Hay que corregirlo (ver §4).

---

## 2. Tamaño del mercado en España

### 2.1 Datos de partida

| Dato | Cifra | Tipo | Fuente |
|---|---|---|---|
| Caballos en España | **722.158** | [H] | [II Estudio de impacto económico del sector ecuestre, RFHE/Deloitte](https://rfhe.com/estudioecuestre/wp-content/uploads/2025/06/Diptico-II-Estudio_pdf.pdf) |
| Explotaciones equinas | **188.286** (la mayoría pequeñas, no centros) | [H] | Ídem |
| Caballos en fase de "explotación" (deporte, ocio, terapias) | **454.174** (el 63 %) | [H] | Ídem |
| Gasto en deporte (licencias, clubes, competición, carreras) | **2.487 M€** | [H] | Ídem |
| Gasto en ocio | **1.808 M€** | [H] | Ídem |
| Peso de Andalucía | **32,3 % del censo** y el 27 % del gasto (1.536 M€) | [H] | Ídem |
| Ganaderías activas en libros genealógicos | **64.408** | [H] | Ídem |
| Censo MAPA, sep 2024 | 641.682 cabezas, con cerca del 29 % en Andalucía | [H, extracto del buscador; el PDF no abrió por el certificado] | [MAPA, indicadores del sector equino](https://www.mapa.gob.es/es/ganaderia/temas/produccion-y-mercados-ganaderos/indicadoressectorequino2023_tcm30-576748.pdf) |
| Censo MAPA, jul 2026 | 929.645 équidos, **con una metodología nueva que no se puede comparar** | [H, prensa, sin verificar] | [AgroNews CyL](https://www.agronewscastillayleon.com/produccion-carne-caballo-24/) |
| Licencias deportivas RFHE 2024 | **54.222** (40.668 mujeres, el 75 %, y 13.554 hombres) | [H] | [Informe de Igualdad RFHE 2024](https://rfhe.com/wp-content/uploads/2025/11/Informe-de-Igualdad-RFHE-2024.pdf) |
| Licencias de hípica según el CSD (todas) | 2021: 72.987 → 2022: 68.770 → 2023: 65.083 → **2024: 61.294** (−16 % en 3 años) | [H, extracto del buscador; el servidor rechazó la descarga] | [Estadística de Deporte Federado 2024](https://www.educacionfpydeportes.gob.es/eu/dam/jcr:8ebf13a7-f944-4705-8992-5fecec3ea89c/estadistica-de-deporte-federado-2024.pdf) |
| Licencias de hípica en Andalucía, 2019 | **5.737** deportistas (6.008 en total). Sevilla 2.047, Cádiz 1.265, Málaga 621 | [H] | [Junta de Andalucía, Deporte organizado 2019](https://www.juntadeandalucia.es/export/drupaljda/producto_estadistica/19/06/Deporte%20organizado%202019.pdf) |
| Galopes (títulos de escuela) emitidos en 2023 | **17.911** en total; Andalucía 2.347 | [H, extracto del buscador] | [RFHE, informe de galopes 2023](https://rfhe.com/wp-content/uploads/2024/01/5-1-Informe-DT-Formacion-sobre-Galopes-emitidos-en-2023.pdf) |
| Número de centros hípicos o ecuestres | **No hay cifra oficial publicada.** Un blog comercial dice "1.637 centros", sin fuente | [no verificado] | [modelosdeplandenegocios](https://modelosdeplandenegocios.com/blogs/news/centro-ecuestre-espana) |
| Precio del pupilaje con pensión completa | 450–700 €/mes (rango de un blog, sin fuente) | [no verificado] | [modelosdeplandenegocios](https://modelosdeplandenegocios.com/blogs/news/cuanto-cobra-centro-equitacion) |

**Lectura [O]:** la hípica federada **decrece**. El 75 % de las licencias son de mujeres. Andalucía tiene el 32 % del censo pero solo cerca del 9 % de las licencias (5.737 de unas 62.000, comparando 2019 con 2020). Eso confirma lo que dijo el experto: en el sur pesan más la cría y el ocio no federado que el deporte. **Las licencias no sirven para medir el mercado de centros.** Sirven, como mucho, de límite inferior del número de jinetes activos.

### 2.2 Cuántos centros hay (estimación)

No hay censo, así que triangulo tres caminos. **[E]**

| Método | Cálculo | Resultado |
|---|---|---|
| A. Por caballos | 454.174 caballos en uso. Supongo que entre el 25 % y el 40 % viven en centros comerciales (pupilaje o escuela), con una media de 40 a 60 caballos por centro | 1.900–4.500 centros |
| B. Por escuelas | 17.911 galopes al año. Supongo entre 8 y 15 galopes al año por escuela que examina | 1.200–2.200 escuelas, a las que se suman las cuadras que solo hacen pupilaje |
| C. Blog comercial | 1.637 "centros ecuestres" | Mismo orden de magnitud |

**Supuesto de trabajo [E]: unos 2.000 centros comerciales en España (rango de 1.500 a 3.000), de los que entre 400 y 700 están en Andalucía** (entre el 25 % y el 32 %, igual que el censo). **Hay que validarlo** antes de enseñarlo a un inversor. Una vía barata es extraer de Google Maps las categorías "centro ecuestre" e "hípica" por provincia y cruzarlo con los directorios de clubes de las federaciones autonómicas.

### 2.3 TAM, SAM y SOM [E]

ARPA anual efectiva de referencia: **1.490 €** (124 € al mes, ver §4.3).

| Nivel | Definición | Cálculo | Resultado |
|---|---|---|---|
| **TAM** | Todos los centros comerciales de España con suscripción de software | 1.500–3.000 centros × 1.200–1.650 €/año | **1,8–5,0 M€/año** (central: unos 3 M€) |
| **SAM** | Andalucía, centros con pupilaje o escuela de al menos 15 caballos, que se puedan digitalizar (entre el 50 % y el 60 %) | 250–450 centros × 1.490 € | **0,37–0,67 M€/año** |
| **SOM a 36 meses** | Lo que se puede captar con venta del fundador más referidos (ver §4.4) | 38 / 103 / 189 centros | **32 k / 135 k / 293 k€ de ingresos recurrentes anuales** |

**Conclusiones [O]:**
- El escenario base (103 centros) ya es **entre el 15 % y el 25 % del SAM andaluz**. Para llegar hay que salir de Andalucía (Madrid, Comunidad Valenciana y Cataluña concentran el mayor gasto en explotación según el II Estudio) **en el segundo año**.
- **Con solo España y solo suscripción, el techo está en unos 3 M€ de ingresos anuales.** Es una empresa rentable con 2 a 4 personas, no una *startup* de capital riesgo. Para más hacen falta (a) Portugal y Latinoamérica por el idioma, o Francia (más centros, pero Equimondo es francés), y (b) ingresos que no dependan del número de centros (cobros, profesionales, cría).

### 2.4 La idea de "3,40 € al año con 2 millones de usuarios"

- **[H]** 2 millones de usuarios en España serían **33 veces las licencias de hípica** (61.294) y **2,8 veces todos los caballos del país** (722.158).
- **[H]** Equilab, la app líder mundial del jinete, dice tener "más de 1 millón de usuarios" **en todo el mundo** y, según una estimación secundaria, ingresa unos 0,9 M$ al año cobrando **unos 100 $ al año**, no 3,40 €.
- **[H]** Apple se queda con el 15 % de las suscripciones dentro de la app incluso en su programa para pequeños desarrolladores ([Apple](https://developer.apple.com/app-store/small-business-program/)). A 3,40 € al año quedan unos 2,89 € antes de IVA, soporte e infraestructura.
- **[O]** **No es un plan.** Es una multiplicación hecha al revés: se elige un ingreso objetivo y se divide. El usuario final llega gratis a través del centro, y cualquier cobro B2C debe ser un extra pequeño (ver §3.5).

---

## 3. Opciones de monetización

| # | Opción | A favor | En contra | Riesgo | Cuándo tiene sentido | Recomendación |
|---|---|---|---|---|---|---|
| 3.1 | **Suscripción por centro con tramos de caballos** | Es el estándar (Equicty, Stable Secretary). Escala con el ingreso del centro, porque cada caballo de pupilaje paga cientos de euros al mes. Es fácil de explicar. Respeta la regla 1 | Una escuela con 15 caballos y 200 alumnos paga poco para el uso que hace | Bajo | **Ya** | **Sí, es el núcleo.** El desajuste de la escuela se arregla con el tramo **por función**: el módulo Escuela exige el plan Centro. Así no se rompe la regla de no cobrar por usuario |
| 3.1b | Por box | Es la unidad física y no cambia aunque cambien los caballos | Un box vacío paga igual; el gerente lo percibe como un impuesto | Medio | Nunca como unidad principal | **No.** Mejor por caballo dado de alta |
| 3.1c | Tarifa plana (tipo Pegasys) | Simplicidad total | Deja dinero sin cobrar en los centros grandes y espanta a los pequeños | Medio | Solo dentro de un acuerdo con una federación | **Solo para un convenio** con FAH o RFHE |
| 3.2 | **Módulos extra** (cría, rendimiento, Veri*Factu) | Sube el ARPA sin subir la lista | Cada módulo complica la venta. Con Veri*Factu aplazado a 2028, nadie paga "por cumplir" | Bajo | Cría y rendimiento: ya, como plan superior. Veri*Factu: **nunca como extra** | **Facturación incluida en todos los planes de centro.** Cría y rendimiento como parte del plan superior, no como extra suelto (ver §4) |
| 3.3 | **Cuota por cliente final** que paga el centro | Sigue el valor del efecto red | **Rompe la regla 1**: el centro deja de invitar clientes para pagar menos y el producto se queda sin red | **Alto** | Nunca | **No** |
| 3.4 | **Comisión por cobros o reservas** (Stripe Connect) | Ingreso que crece con el volumen. Stripe Connect estándar no cuesta nada a la plataforma si Stripe fija la tarifa del centro (1,5 % + 0,25 € con tarjeta europea; 0,35 € por adeudo SEPA). Si la plataforma controla la tarifa, paga 2 €/cuenta activa/mes + 0,25 % + 0,10 € por transferencia ([Stripe Connect](https://stripe.com/es/connect/pricing), [Stripe](https://stripe.com/es/pricing)) | Los competidores **presumen de no cobrar comisión**. En España el pupilaje se paga sobre todo por transferencia o domiciliación (hipótesis que hay que validar). El 0,5 % de 16.000 € al mes son 80 €, que el gerente vive como "me quitas de mi dinero" | Medio-alto | **Pupilaje: nunca.** Clases sueltas y bonos pagados online por el alumno: a partir del mes 12, si la validación lo acepta | **Cobro integrado sin margen de Relincho el primer año** (aumenta el uso y reduce morosidad). Después, una tasa opcional y transparente del 1–2 % **a cargo del alumno** solo en reservas online |
| 3.5 | **Plan premium del propietario** | Ingreso que no depende del centro. Referencias: Equilab 99,99 $/año, Equisense Rider 99 €/año | Si se recorta la versión gratuita, el centro pierde el argumento de venta "tu cliente lo tiene todo". La conversión B2C a pago suele ser baja | Medio | Cuando haya al menos 3.000 propietarios activos al mes y la ficha se pueda llevar a otro centro (D2 b del doc. 01) | **Más adelante, con 2,99 €/mes o 24,99 €/año IVA incluido.** Solo añadiría cosas: historial portátil entre centros, PDF clínico, almacenamiento de radiografías. **Nunca** quitaría avisos ni historial básico |
| 3.6 | **Profesionales** (gratis y plan Pro) | El profesional es el canal de referidos. Un plan Pro con agenda de varios centros, rutas y **facturación propia** (el herrador también tiene que facturar) le aporta valor real. Hay precedentes: Horsepower (gratis) y Equimondo, que se dirige también a herradores | Si es de pago desde el principio, frena la adopción | Bajo | Gratis **ya**. Plan Pro a partir del mes 12–18 | **Cuenta gratis para siempre. Pro a 14,99 €/mes sin IVA** cuando el profesional trabaje en 3 o más centros con Relincho |
| 3.7 | ***Marketplace* de profesionales** (el propietario busca herrador o veterinario) | Comisión por servicio (Equimov cobra un 13 % en boxes) | Es un problema del huevo y la gallina. El veterinario y el herrador ya tienen la agenda llena y no necesitan captar clientes. Riesgo deontológico con la publicidad veterinaria | Alto | Con más de 500 centros, si alguna vez | **No en 36 meses** |
| 3.8 | **Patrocinio o publicidad** (marcas de pienso) | Un patrocinador puede pagar por contenido de nutrición | Con 100 centros × 50 clientes = 5.000 usuarios, el CPM es irrelevante. **Hay conflicto de intereses**: el centro compra a un proveedor y Relincho le pondría delante a su cliente la competencia. Pérdida de confianza | Alto | Con al menos 5.000 propietarios activos, solo en formato de contenido patrocinado y etiquetado, y con permiso explícito | **Aplazar.** Si llega, que sean acuerdos de marca anuales, nunca anuncios en la ficha del caballo |
| 3.9 | **Datos agregados** | Estudios con la UCA (credibilidad y posibles proyectos financiados). Pegasys los usa para defender el sector | Ver la nota sobre el RGPD abajo. La venta de datos ahuyenta al centro | **Alto** si se venden | Estudios científicos: año 2 o 3. Venta: nunca | **Solo datos anónimos, con fin científico o sectorial, y por convenio.** Su valor es la reputación, no la caja |
| 3.10 | **Hardware o IoT** | Valor emocional ("cámara en el box") | Necesita mucho capital, stock, garantías y soporte. Equisense tuvo que pasar a suscripción. Nightwatch cobra 799 $ más una cuota | Alto | Solo integrando a terceros por API, a partir del año 3 | **No fabricar.** Integrar sensores o cámaras de terceros si los clientes los piden |
| 3.11 | **Pago único** | Atractivo para el centro que odia las cuotas | El coste (servidores, soporte, normativa) es recurrente y el ingreso no. Equisense lo dice abiertamente | Alto | Nunca para el software. Sí para servicios: la migración "Trae tu Excel" (149 €) y la puesta en marcha | **No.** La versión aceptable del "pago único" es **el pago anual por adelantado** (paga 10 y usa 12) |

### Nota sobre el RGPD y los datos agregados (3.9) [H/O]

- **[H]** Los datos anonimizados quedan fuera del RGPD **solo si se puede demostrar que no hay forma razonable de reidentificar a nadie**. El proceso de anonimizar **sí** es un tratamiento de datos personales ([AEPD](https://www.aepd.es/prensa-y-comunicacion/blog/anonimizacion-y-seudonimizacion); [considerando 26](https://gdpr-text.com/es/read/recital-26)). Los datos seudonimizados siguen siendo datos personales.
- **[O]** La salud de un caballo no es un dato personal en sí. Pero el caballo tiene microchip y UELN y está ligado a un propietario identificable en el registro, el centro y la factura. **Un historial clínico con chip, centro y fecha es un dato seudonimizado del propietario**, no un dato anónimo.
- **[H]** En el contrato con el centro, Relincho es **encargado del tratamiento**. Si usa los datos para fines propios, pasa a ser responsable de ese tratamiento y asume sus obligaciones ([RGPD, art. 28.10](https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32016R0679)).
- **[O] Qué se puede hacer:** estadísticas agregadas con umbrales mínimos (por ejemplo, ninguna celda con menos de 10 caballos o 3 centros), sin chip ni centro, con una cláusula expresa en el contrato de encargo y opt-in del centro. **Qué no se puede hacer:** vender a un tercero historiales individuales, ni siquiera "sin nombre"; segmentar publicidad con datos clínicos; cruzar con datos de otras fuentes.

---

## 4. Propuesta de precios para centros hípicos

### 4.1 Qué cambio en las reglas de `pricing.ts`

| Regla actual | Propuesta | Por qué |
|---|---|---|
| 1. Por cuadra y por caballo, **nunca por usuario** | **Se mantiene y se refuerza.** Hay que **quitar `maxUsers`** (3 y 10) en los planes de centro: personal, profesores, clientes y profesionales ilimitados | El límite actual contradice la regla. Un centro con 4 profesores y 3 mozos no cabe en el plan Cuadra |
| 2. No se bloquea el alta de un caballo; aviso al 80 % | **Se mantiene** | Correcta |
| 3. Precios sin IVA | **Se mantiene para el centro y el profesional.** Los precios para el propietario, si existen, **con IVA incluido** | El propietario es un consumidor |
| Facturación como módulo de 39 € (solo incluida en Yeguada) | **Incluida en todos los planes de centro** | Es el trabajo principal del centro, el competidor la regala o la cobra a 45 € como máximo, y Veri*Factu ya no apremia |
| *(nueva)* 4. El cliente final y el profesional **nunca pagan por lo que ya paga el centro** | Cualquier plan B2C o Pro solo **añade** | Protege el argumento de venta al centro |
| *(nueva)* 5. **El tramo puede depender de la función, no de los usuarios** | Escuela (clases, bonos, pistas) disponible desde el plan Centro | Arregla el caso de la escuela con pocos caballos sin cobrar por alumno |

Las claves de plan (`cuadra`, `rendimiento`, `yeguada`) **no cambian** porque viven en la base de datos. Lo que cambia es el nombre comercial y lo que incluye cada plan.

### 4.2 Tabla de planes propuesta [O]

| Plan (clave) | Para quién | Caballos incluidos | €/mes sin IVA | Anual (10 meses) | €/caballo/mes con el plan lleno | Fundador (−40 %) | Incluye |
|---|---|---|---|---|---|---|---|
| **Cuadra** (`cuadra`) | Cuadra de pupilaje sin escuela | 20 | **69** | 690 | 3,45 | 41 | Ficha, sanidad y avisos, documentos, **pupilaje y facturación Veri*Factu**, app del cliente, círculo de profesionales, incidencias y comunicados, libro de explotación, QR, importación desde Excel. **Usuarios ilimitados** |
| **Centro** (`rendimiento`) ★ | Centro con pupilaje y escuela (ICP P1) | 50 | **149** | 1.490 | 2,98 | 89 | Todo lo de Cuadra más **escuela** (clases, pistas, profesores, bonos), **stock y proveedores** con aviso de umbral, rendimiento y periodización, roles de profesor, informe semanal y soporte prioritario |
| **Centro Plus / Yeguada** (`yeguada`) | Centro grande, varias sedes o con cría | Sin límite | **desde 349** | desde 3.490 | — | desde 209 | Todo lo anterior más **cría** (reproducción F1–F4), varias sedes, comparativas, puesta en marcha y soporte por teléfono |
| **Profesional** (nuevo, gratis) | Veterinario, herrador, fisio, dentista | — | **0** | — | — | — | Ve los caballos a los que le dan acceso en todos sus centros, registra visitas y adjuntos y recibe avisos |
| **Profesional Pro** (nuevo, mes 12–18) | El profesional que trabaja en 3 o más centros | — | **14,99** | 149,90 | — | — | Agenda y rutas de varios centros, facturación propia, plantillas de informe |
| **Propietario+** (nuevo, mes 24 o más, opcional) | El propietario | — | **2,99 IVA incl.** | 24,99 IVA incl. | — | — | Historial portátil entre centros, PDF clínico, almacenamiento de radiografías |

**Extras que se mantienen:** bloque de 10 caballos por 25 €/mes, migración por 149 € (gratis en anual y en Plus) y QR a 3 € por caballo. **Desaparece** el módulo de facturación de 39 € para los planes nuevos; las yeguadas de la beta lo conservan.

**Comparación [O]:** un centro de 40 caballos pagaría 149 € (89 € como fundador), frente a 138 € en Equicty (con Finanzas) y 45 € en Equimondo. Relincho se coloca **arriba pero en el rango del mercado**. Se justifica por la app del cliente, los profesionales, el stock y estar en Andalucía. Si en la validación (§6) el precio aceptable resulta estar por debajo de 100 €, la palanca es **bajar el tramo de Centro a 119 €**, no crear un plan gratuito.

**¿Plan gratis para centros? [O] No.** Equimondo y Horsepower lo tienen, pero con venta personal del fundador un plan gratis atrae cuadras sin presupuesto que consumen soporte. Se queda la prueba de 21 días, más la migración y la puesta en marcha hechas por nosotros.

**El programa de fundador [O]:** hoy cierra el 1 ene 2027 (`FOUNDER.freeUntil`). Con el cambio de cliente objetivo, **conviene reabrirlo para centros hasta el 30 jun 2027 o hasta 20 plazas**. El primer cobro sería 60 días después del alta, en vez de una fecha fija.

### 4.3 ARPA de referencia [E]

- Mezcla del escenario base: el 35 % en Cuadra (69 €), el 55 % en Centro (149 €) y el 10 % en Plus (349 €). Media de lista: **unos 141 €**. Con bloques extra de caballos y algún Plus más caro, ajusto a **135 €**.
- El 50 % paga en anual (descuento efectivo del 16,7 %): 135 × 0,917 = **124 €/mes efectivos**, que son 1.490 € al año.
- Escenario conservador: lista de 110 € (más centros en Cuadra), 101 € efectivos. Escenario optimista: lista de 150 €, 138 € efectivos.

### 4.4 Simulación de ingresos a 12, 24 y 36 meses [E]

**Supuestos (todos editables):**
- El mes 1 es enero de 2027. Las altas mensuales son constantes dentro de cada año.
- Los primeros 30 centros son fundadores (pagan el 60 %). El churn se aplica cada mes a toda la base.
- Solo suscripción de centros: **no cuento** Profesional Pro, Propietario+, comisiones ni migraciones. Es intencionado, para no inflar.
- La conversión de demo a cliente queda implícita en las altas: con un 25 % de cierre, 2 altas al mes exigen 8 demos cualificadas al mes.

| Escenario | Altas/mes (año 1 / año 2 / año 3) | Churn mensual | ARPA de lista |
|---|---|---|---|
| Conservador | 1 / 1,5 / 2 | 2,5 % | 110 € |
| Base | 2 / 3,5 / 5 | 1,5 % | 135 € |
| Optimista | 3 / 6 / 9 | 1,0 % | 150 € |

| Escenario | Mes 12: centros · MRR · ingresos del año 1 | Mes 24: centros · MRR · ingresos del año 2 | Mes 36: centros · MRR · **ingresos recurrentes anuales** · ingresos del año 3 |
|---|---|---|---|
| Conservador | 10 · 634 € · 4,3 k€ | 23 · 1.420 € · 13,0 k€ | 38 · 2.679 € · **32 k€** · 24,8 k€ |
| **Base** | 22 · 1.643 € · 11,0 k€ | 57 · 5.611 € · 44,5 k€ | 103 · 11.282 € · **135 k€** · 105 k€ |
| Optimista | 34 · 3.054 € · 19,0 k€ | 98 · 11.898 € · 95,2 k€ | 189 · 24.426 € · **293 k€** · 226 k€ |

**Lectura [O]:**
- El primer año **no paga ni un sueldo** en ningún escenario. Es un año de validación y no hay que planificarlo como un año de ingresos.
- El escenario base del tercer año (135 k€) da para 1 o 2 sueldos. El optimista exige salir de Andalucía y una persona de ventas.
- **Sensibilidad:** si el cobro integrado y Profesional Pro suman un 10–15 % al ARPA a partir del mes 18, el escenario base pasa a unos 150–155 k€ de ingresos recurrentes anuales en el mes 36. Pasar de un churn del 1,5 % a uno del 2,5 % lo baja a unos 115 k€. **El churn pesa más que el precio.**

---

## 5. Unit economics [E salvo que se indique]

**Margen bruto supuesto:** 80 % (alojamiento, base de datos, correo, avisos push, almacenamiento de documentos y soporte). Con pocos clientes, el coste que domina es el soporte, no la infraestructura.

**Contribución mensual por centro** (base, sin fundador): 124 € × 0,8 = **99 €**. Con fundador: unos 60 €.

### 5.1 CAC por canal

| Canal | Cómo se calcula | CAC | Payback (base / fundador) | Capacidad | Comentario |
|---|---|---|---|---|---|
| **Venta directa en Andalucía** (fundador) | 3–4 prospectos cualificados por cierre × 2 visitas × 4 h (con desplazamiento), más 6 h de puesta en marcha, = 30–38 h. A 30 €/h de coste de oportunidad, 900–1.140 €, más 150–250 € de desplazamiento | **1.000–1.400 €** | 10–14 meses / 17–23 meses | 2–4 cierres al mes por persona a tiempo parcial | Es el canal del año 1. **Hay que concentrarlo en Jerez y Sevilla** para crear densidad de profesionales |
| **Federaciones** (FAH o RFHE) | Convenio tipo Pegasys: descuento del 10–15 % al federado y presencia en su comunicación. Coste marginal por centro: 200–500 € | **200–500 €** tras firmar | 2–5 meses | Alta, pero el ciclo es de 6 a 18 meses | Precedente: ABRS+ con Pegasys a 45 £. Riesgo de que pidan exclusividad, marca blanca o precio fijo. La RFHE tiene su propia plataforma de licencias: **ofrecer integración, no competir** |
| **SICAB** (17–22 nov 2026, Sevilla) | **[H]** Stand modular de 4 × 4 m, reserva de 600 € no reembolsable y precio por m² no publicado. **[H]** La renovación y contratación de stands de criadores cerraba el 31 de mayo ([ANCCE](https://www.ancce.es/en/see-news12/3193/sicab-2026-request-the-renewal-of-or-contract-a-breeder-stand/)). **[E]** Stand completo: 3.000–6.000 € con montaje, viaje y 2 personas durante 6 días. Entre 1 y 5 cierres de centros en una feria de criadores PRE | Stand: **600–6.000 €**. Visitante con reuniones cerradas antes: **150–600 €** | Stand: unos 20 meses. Visitante: 2–6 meses | Baja para centros; la feria es de cría | **[O] En 2026, ir como visitante** con 15–20 reuniones cerradas (yeguadas y centros) y demo en tableta. El stand no compensa y probablemente ya no se puede contratar |
| **Referidos de profesionales** | Incentivo: el centro referido tiene 1 mes gratis y el profesional recibe Pro gratis 12 meses, unos 150 € de coste real. Más 3–4 h de venta | **150–300 €** | 2–3 meses | Depende de la densidad: hacen falta 3 o más centros en la zona del profesional | **El mejor canal a partir del mes 9–12.** Hay que medir quién trae a quién desde el primer día |
| Eventos de deporte (Sunshine Tour, Madrid Horse Week) | **[H]** El Sunshine Tour de 2024 reunió unos 3.500 caballos y más de 2.000 jinetes de 60 países ([El Español](https://elespanol.com/invertia/economia/20240229/auge-circuito-andaluz-comprar-caballo-buscan-estrellas-futuro/835916824_0.html)). **[H]** Madrid Horse Week tiene **unos 300 caballos**, no 2.500. Se canceló en 2025 y vuelve del 26 al 29 nov 2026 ([IFEMA](https://www.ifema.es/mutua-madrid-horse-week), [Oxer](https://www.oxersport.com/en/oxer-news/news-ifema/madrid-horse-week-announces-the-cancellation-of-its-2025-edition-and-prepares-for-a-stronger-return-in-2026)) | No estimado | — | — | **[O]** Es público profesional y extranjero, no el ICP de ocio. La gestión de eventos es **otro producto**. No antes de 2028 |

**CAC combinado del escenario base [E]:** año 1, unos 1.100 € (casi todo venta directa); año 2, unos 700 € (con un 40 % de referidos); año 3, unos 500 €.

### 5.2 LTV y relación LTV/CAC

| Escenario | ARPA efectiva | Churn mensual | Vida media | LTV (margen bruto 80 %) | LTV/CAC con 1.100 € de CAC |
|---|---|---|---|---|---|
| Conservador | 101 € | 2,5 % | 40 meses | **3.230 €** | 2,9 |
| Base | 124 € | 1,5 % | 67 meses | **6.600 €** | 6,0 |
| Optimista | 138 € | 1,0 % | 100 meses | **11.000 €** | 10,0 |

**Contexto [H, fuentes secundarias de calidad media]:** en SaaS para pymes, el payback mediano del CAC está entre 12 y 15 meses, y el churn mensual de pymes oscila entre el 2 % y el 5 % según la fuente, que no coinciden ([stealthagents](https://stealthagents.com/research/startup-cac-payback-period-benchmarks-2026), [userjot](https://userjot.com/blog/saas-churn-rate-benchmarks)). **[O]** Un churn del 1,5 % es ambicioso, pero defendible si la facturación del centro vive en Relincho, porque cambiarse de software de facturación a mitad de año duele mucho. **Es el supuesto más importante que hay que medir.**

**Lectura [O]:** el modelo funciona si el churn se queda por debajo del 2 %. Con un churn del 2,5 % y venta directa, la relación LTV/CAC no llega a 3. La palanca no es subir el precio, sino **(1) que el centro facture desde Relincho desde el primer mes** y **(2) bajar el CAC con referidos.**

---

## 6. Riesgos y supuestos que hay que validar con los primeros 5–10 centros

Cada supuesto lleva **la pregunta literal**. Las preguntas se hacen sobre el pasado y los hechos, no sobre intenciones ("¿usarías…?").

| # | Supuesto | Si es falso… | Pregunta exacta | Criterio |
|---|---|---|---|---|
| S1 | El centro paga hoy algo por software o gestoría | No hay presupuesto y el precio de 149 € no se sostiene | *"¿Qué programas, apps o servicios pagáis hoy para gestionar el centro (incluida la gestoría y la facturación) y cuánto al mes en total?"* | Al menos 5 de 8 pagan 50 € al mes o más |
| S2 | El caballo es la unidad de precio correcta | Hace falta el tramo por función o por alumnos | *"¿Cuántos caballos hay hoy en el centro, cuántos son de pupilaje, cuántos de escuela y cuántos alumnos sin caballo viene cada semana?"* | La relación caballos/alumnos predice el plan sin casos absurdos |
| S3 | El precio aceptable está entre 89 y 149 € | Hay que bajar Centro a 119 € o dividir la escuela | Van Westendorp: *"¿A partir de qué precio al mes te parecería tan barato que dudarías de la calidad? ¿Barato pero buena compra? ¿Caro pero te lo plantearías? ¿Tan caro que no lo contratarías?"* (después de la demo) | La mediana del "caro pero me lo planteo" es de 120 € o más |
| S4 | La coordinación con los clientes duele más que la gestión interna | La app del cliente no vende; vende la facturación | *"Cuéntame la última vez que un cliente se enfadó por no enterarse de algo. ¿Qué pasó y cómo lo arreglasteis?"* | 5 de 8 lo cuentan sin que se lo sugiramos |
| S5 | La facturación del pupilaje es un dolor mensual | El churn va a ser alto porque el centro no facturará desde Relincho | *"¿Cómo hicisteis las facturas del pupilaje el mes pasado? ¿Quién, con qué programa y cuántas horas? ¿Cuántos clientes pagaron tarde?"* | Más de 4 h al mes o más del 10 % de pagos con retraso |
| S6 | El cobro es mayoritariamente por transferencia o domiciliación | Cambia el cálculo de la comisión de la opción 3.4 | *"¿Cómo os pagan el pupilaje: transferencia, domiciliación, tarjeta, Bizum o efectivo? ¿En qué proporción?"* | Solo es un dato; no hay umbral |
| S7 | El centro aceptaría una comisión sobre las reservas online | La opción 3.4 queda descartada | *"Si los alumnos reservaran y pagaran las clases sueltas desde la app, ¿preferís que el 1,5 % lo pague el alumno, pagarlo vosotros o una cuota fija más alta?"* | Al menos el 50 % acepta que lo pague el alumno |
| S8 | Los profesionales entran y traen otros centros | El bucle de crecimiento no existe y el CAC se queda por encima de 1.000 € | Al centro: *"¿Cuántos herradores y veterinarios distintos vinieron el último mes? ¿Cómo sabían qué caballos tocaban?"* Al herrador: *"¿En cuántos centros trabajas? ¿Cómo te llega la lista de caballos y cómo les cobras?"* | El herrador trabaja en 4 o más centros y registra 3 visitas en un mes sin que se lo recordemos |
| S9 | El stock con aviso de umbral resuelve un problema real | El módulo de stock baja de prioridad | *"¿Cuándo fue la última vez que os quedasteis sin heno, pienso o viruta? ¿Qué costó?"* | 3 de 8 en el último año |
| S10 | El centro firmaría el uso de datos anónimos para estudios con la UCA | Se descarta la opción 3.9 | *"Si la Universidad de Cádiz hiciera un estudio sobre cojeras con datos anónimos de muchos centros, ¿nos dejaríais incluir los vuestros? ¿Qué condición pondríais?"* | 5 de 8 dicen que sí, con condiciones razonables |
| S11 | El churn va a estar por debajo del 2 % | El modelo no se sostiene (ver §5.2) | *"La última vez que dejasteis de usar un programa o una app, ¿por qué fue?"* y, a los 3 meses del piloto, *"¿Qué tendría que pasar para que lo dejarais?"* | No hay un motivo de abandono que se repita en 3 centros o más |
| S12 | El que decide y el que firma están al alcance | El ciclo de venta se alarga y el CAC se dispara | *"Si decidís contratarlo, ¿quién firma y cuándo cerráis los gastos del año?"* | Decide la persona con la que hablamos en 2 de cada 3 casos |
| S13 | Equimondo, GESTHIP y Hipicgest no están ya en la zona | Hay que competir por sustitución, no por digitalizar a quien no tiene nada | *"¿Habéis probado algún programa de hípicas? ¿Cuál y por qué lo dejasteis o lo seguís usando?"* | Solo es un dato. Si 3 o más usan uno, hay que preparar la migración |

**Riesgos que la validación no cubre [O]:**
- **El techo del mercado** (unos 3 M€ de ingresos anuales en España): es estructural. Hay que decidir antes del mes 18 si se sale de España o si se acepta ser una empresa pequeña y rentable.
- **El precio de la competencia:** Equimondo puede bajar a 0 € con la facturación incluida. La defensa es el servicio local y la red de profesionales, no el precio.
- **La dependencia del fundador:** con venta directa, el número de altas al mes está limitado por las horas disponibles. El escenario base (5 altas al mes en el año 3) exige una segunda persona comercial o el canal de la federación.
- **La regulación:** el aplazamiento de Veri*Factu a 2028 está anunciado, pero hasta que salga en el BOE sigue vigente el calendario de 2027. La facturación tiene que estar lista igualmente; lo que cambia es el mensaje, no el producto.

---

## 7. Cifras que no se han podido verificar

- **Número de centros hípicos en España y en Andalucía:** no hay fuente oficial. El "1.637" de un blog no tiene origen. Mi rango de 1.500 a 3.000 es una estimación.
- **Licencias de hípica del CSD (61.294 en 2024)** y **galopes de 2023 (17.911):** proceden del extracto del buscador porque el PDF no se pudo descargar o leer.
- **Censo del MAPA (641.682 en sep 2024; 929.645 en jul 2026):** extracto del buscador y prensa. El PDF del MAPA falló por el certificado.
- **Usuarios activos (unos 100 k) e ingresos (unos 0,9 M$) de Equilab:** estimación de Lazyweb sin fuente primaria.
- **Precios no publicados:** GESTHIP, Hipicgest, Anolla (tasa de comisión), LIVERYLive (unidad del "desde 2 £"), EC Pro (75 $ o 155 $ según la fuente) y Kavalog.
- **Precio del pupilaje en España (450–700 €/mes):** blog sin fuente.
- **Precio por m² del stand en SICAB:** no publicado. Solo consta la reserva de 600 €.
- **Aplazamiento de Veri*Factu a octubre de 2028:** anunciado en una nota de Hacienda según la prensa. Falta la publicación en el BOE.
- **Número de caballos del Sunshine Tour 2026:** solo hay datos de 2024.
