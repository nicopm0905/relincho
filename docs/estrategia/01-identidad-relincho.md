# Relincho: identidad y visión de producto (v2, centros hípicos)

> **Estado:** borrador para discutir entre socios · 27 oct 2026
> **Sustituye en dirección (no en detalle) a:** `docs/product-definition.md`, escrito para yeguadas.
> **Fuentes:** reunión con un fisioterapeuta ecuestre con certificación FEI y un profesor de la Universidad de Cádiz (oct 2026), el código del repo y lo aprendido en la fase de yeguadas.
> **Documentos hermanos:** `02-modelo-de-negocio.md` (monetización) y `03-roadmap-tdd.md` (calendario de features).

---

## 0. En una frase

**Relincho es la app que organiza la vida de cada caballo y del centro donde vive.** El centro hípico la contrata para su gestión. Sus clientes y los profesionales que tocan al caballo (veterinario, herrador, fisio…) la usan gratis y quedan conectados en un mismo sitio.

Antes éramos *"el cuaderno de trabajo de una yeguada"*. Ahora somos *"el punto de encuentro entre el centro, el dueño y todos los que cuidan del caballo"*.

---

## 1. Por qué cambiamos de foco

### 1.1 Lo que aprendimos en la reunión

| # | Insight | Tipo | Consecuencia para el producto |
|---|---|---|---|
| 1 | Hay más negocio en el **jinete aficionado o de ocio** que en el profesional de deporte. El profesional ya tiene agencias o mánagers que le llevan agenda e inscripciones. | Opinión de experto | El usuario final es el jinete de ocio con 1 o 2 caballos, no el deportista de élite |
| 2 | **Hay que entrar por el centro hípico, no por el propietario.** El centro es quien "genera" y arrastra a sus 50–60 clientes. | Opinión (consenso de los dos expertos) | El centro paga (B2B) y los clientes vienen detrás (B2B2C) |
| 3 | Un centro tiene **cuatro tipos de cliente**: (a) pupilaje y monta él mismo, (b) pupilaje y recibe clases con un profesor, (c) pupilaje y otro le entrena el caballo, (d) sin caballo, solo va a clases | Hecho descrito por quien conoce el sector | El modelo de datos tiene que separar *propietario*, *jinete* y *alumno* |
| 4 | Hoy la coordinación va por **WhatsApp, Excel, notas del móvil y "200 alarmas"**. El dueño "tiene 80 WhatsApp y no lo lee". | Dolor descrito | El canal de avisos e incidencias es nuestro, con trazabilidad y no un chat más |
| 5 | Alrededor del caballo hay **cada vez más profesionales**: veterinario general, especialistas (cojeras, oftalmología, cardiología, dermatología), dentista, herrador, fisio y nutricionista | Hecho | Hace falta un "círculo del caballo" con acceso por rol, no solo el veterinario |
| 6 | El dueño quiere una **zona privada** con su historial: diagnóstico, radiografías, tratamiento, calendario de vacunas, sin tener que buscar en el correo | Dolor descrito | El historial clínico compartido es la pieza que engancha al cliente final |
| 7 | La gestión del centro incluye **consumos y stock**: unos 500 kg de heno al día, 40 t almacenadas y un aviso al 20 %, que es el tiempo que tarda el proveedor | Ejemplo concreto | Hace falta un módulo de inventario con previsión de agotamiento |
| 8 | La relación con el caballo es **casi de mascota, o más**: hay quien pide cámara en el box o quiere saber si "han sacado a pasear" a su caballo | Opinión | Un feed de actividad del caballo ("hoy salió al paddock") tiene mucho valor emocional |
| 9 | Hace unos 10 años **otro grupo lo intentó y fracasó** porque lo enfocó al profesional y no al usuario | Anécdota sin verificar | El riesgo no es técnico sino de enfoque. Simplicidad para el cliente final |
| 10 | **En las cuadras no hay wifi fiable.** Tiene que guardar en local y subir al recuperar conexión | Requisito técnico | La PWA tiene que funcionar offline y sincronizar después |
| 11 | "Nadie instala apps". Una **web responsive o PWA** basta | Opinión del profesor | Nada de apps nativas hasta tener tracción. PWA instalable |
| 12 | Las yeguadas de cría suelen tener **un proveedor único** que les lleva el suministro y **se digitalizan peor** que un centro hípico | Opinión | Es otro motivo para no hacer de la yeguada el segmento principal |
| 13 | **Escala hacia arriba**: un gran evento gestiona muchos caballos con los mismos problemas. Dato verificado: Sunshine Tour, unos 3.500 en 2024; Madrid Horse Week, unos 300, no 2.500 | Oportunidad futura | Es otro producto, para público profesional. No antes de 2028 |
| 14 | **Lead concreto**: un centro ecuestre de Jerez va a reabrir antes de fin de año con dos socios nuevos | Oportunidad | Primer candidato a piloto. Se entra a través del contacto de la UCA |

**Advertencia:** todo esto sale de **una reunión con dos personas** de un mismo entorno (Jerez, fisioterapia y universidad). Es oro como hipótesis, pero no es validación. Ver §10.

### 1.2 Por qué el centro hípico es mejor primer cliente que la yeguada

| Criterio | Yeguada PRE | Centro hípico |
|---|---|---|
| Frecuencia de uso | Estacional: picos en cubriciones y partos | Diaria: clases, pupilaje, visitas |
| Personas implicadas | Pocas: dueño, mayoral, veterinario | Muchas: 50–60 clientes, profesores y profesionales |
| Efecto red | Bajo | **Alto**: cada cliente y cada herrador es un canal hacia otro centro |
| Digitalización | Baja, depende de un proveedor único | Media. Ya cobran cuotas y gestionan reservas |
| Dolor de facturación | Medio | **Alto**: pupilaje más extras mensuales a muchos clientes |
| Tamaño del mercado | Nicho PRE andaluz | Todos los centros de España, de todas las disciplinas |
| Lo que ya tenemos | Muy cubierto (reproducción F1–F4) | Bastante cubierto (pupilaje, facturación, portal, sanidad) |

**No tiramos la yeguada.** La reproducción es el módulo más trabajado del repo y es una ventaja diferencial. Pasa a ser un **módulo "Cría" opcional**: para los centros que también crían y para el segmento yeguada como vertical secundario.

---

## 2. Misión, visión y propuesta de valor

**Misión:** que nadie que cuide de un caballo tenga que depender de su memoria, de un Excel o de un WhatsApp perdido.

**Visión a 5 años:** ser la red donde vive el historial de los caballos de ocio de España y del sur de Europa. Cada centro, dueño y profesional conectado alrededor del mismo caballo.

**Propuesta de valor por actor:**

| Actor | Qué gana | Frase de venta |
|---|---|---|
| **Dueño o gerente del centro** | Menos llamadas y WhatsApps, facturación mensual automática, stock bajo control, imagen profesional ante sus clientes | *"Tu centro organizado y tus clientes informados sin que tengas que coger el teléfono."* |
| **Propietario del caballo** | Todo lo de su caballo en el móvil: avisos, historial clínico, facturas, incidencias y novedades | *"Tu caballo, en tu bolsillo."* |
| **Alumno sin caballo** | Reservar y cancelar clases, enterarse de suspensiones y competiciones, pagar bonos | *"Tus clases sin perseguir a nadie."* |
| **Profesional** (veterinario, herrador, fisio…) | Agenda de todos sus centros, la ficha del caballo antes de llegar y un sitio donde dejar el informe | *"Llega sabiendo qué caballo, qué tiene y dónde está."* |

**Posicionamiento:** no somos un ERP genérico de centros deportivos ni una app de entrenamiento para jinetes de élite. Somos **la herramienta de gestión del centro que, además, conecta al centro con sus clientes y con los profesionales, hecha para la normativa y la forma de trabajar españolas**.

> ⚠️ **Corrección tras la investigación de mercado (`02-modelo-de-negocio.md` §1):** la afirmación de la reunión de que *"nadie lo reúne todo"* **es falsa**. Horsepower (Reino Unido) ya ofrece gestión, propietarios y profesionales gratis, clases y facturación por 9,99–19,99 £ al mes. Equimondo (francés, con web en España y más de 900 centros según su propia web) regala la gestión y cobra 19–45 € al mes por la facturación. El "círculo del caballo" **no nos defiende de la competencia: es el mínimo para competir**. Lo que nos diferencia es: (1) la normativa española integrada (Veri*Factu, libro de explotación, REGA), (2) el castellano y la presencia física en Andalucía, (3) la densidad de la red local de herradores y veterinarios, y (4) la profundidad sanitaria y de cría que ya tenemos.

---

## 3. Quién paga, quién usa y cómo crecemos

```
                         paga la suscripción
           ┌──────────────── CENTRO HÍPICO ────────────────┐
           │      (gerente, encargado, profesores, mozos)  │
           │                                               │
     invita gratis                                    invita gratis
           │                                               │
           ▼                                               ▼
   CLIENTES DEL CENTRO                        PROFESIONALES DEL CABALLO
   · propietario que monta                    · veterinario y especialistas
   · propietario con clases                   · herrador
   · propietario con caballo entrenado        · fisio, dentista, nutricionista
   · alumno sin caballo                       · entrenador externo
           │                                               │
           └──────────── recomiendan Relincho ─────────────┘
                     a OTROS centros donde trabajan o montan
```

**Bucle de crecimiento (hipótesis):** un herrador o veterinario trabaja con 5–15 centros. Si recibe su agenda de un centro en Relincho, querrá recibir la de los demás. Esa presión llega a los otros centros. Lo mismo pasa con un propietario que cambia de cuadra. **El profesional es el canal de venta más barato que tenemos.** Diseñamos su experiencia para que lo pida.

**Regla de precio que se mantiene:** se cobra por centro y por volumen de caballos, **nunca por usuario**. Si cobráramos por cliente o profesional invitado, el centro dejaría de invitarlos y perderíamos el efecto red. El detalle está en `02-modelo-de-negocio.md`.

---

## 4. Segmentos

| Prioridad | Segmento | Perfil | Por qué |
|---|---|---|---|
| **P1** | **Centro hípico con pupilaje y escuela** | 20–80 boxes, clases propias, entre 30 y 100 clientes, Andalucía primero (Jerez, Sevilla, Cádiz, Córdoba) | Dolor diario, efecto red y lead real en Jerez |
| P2 | Cuadra solo de pupilaje | Sin escuela y con clientes propietarios | El mismo producto sin el módulo de clases |
| P2 | Yeguada o ganadería | El ICP anterior (PRE, 10–60 yeguas) | Ya está construido. Se vende como plan con el módulo Cría |
| P3 | Profesional independiente | Herrador o veterinario que quiere su agenda multi-centro | Puerta de entrada gratuita o barata y motor de referidos |
| Futuro | Eventos y concursos | Sunshine Tour, Madrid Horse Week… | Volumen enorme y venta compleja. A partir de 2027 |
| **No ahora** | Jinete profesional de deporte | Ya tiene mánager y agencia | Lo dijo el propio experto. Es el error del intento fallido |
| **No ahora** | Propietario suelto (B2C directo) | 1 o 2 caballos sin centro en Relincho | Adquisición cara y sin efecto red. Llega solo a través del centro |

---

## 5. Arquitectura de producto: las capas

Seguimos la estructura que propuso el experto (gestión, actividad y relación) y añadimos dos capas de futuro.

### Capa 0. El caballo (núcleo, lo que ya existe)
La ficha del caballo es el centro de todo: identificación, propietario, box, historial, documentos y sanidad. **Primero el caballo, luego el módulo** sigue siendo el principio rector.

### Capa 1. Operación del centro (para el gerente)
- **Instalaciones:** boxes, paddocks, pistas y ocupación.
- **Consumos y stock:** heno, pienso, viruta y suplementos. Consumo diario por caballo o global, **previsión de agotamiento y aviso al umbral** (p. ej. 20 %).
- **Proveedores y pedidos:** a quién se pide, plazo de entrega y su historial.
- **Personal:** mozos y profesores, con turnos y tareas.
- **Costes por caballo y rentabilidad del centro.**

### Capa 2. Actividad (agenda del centro)
- **Clases:** grupales e individuales, profesor, pista, nivel, alumnos con o sin caballo, plazas, bonos y cancelaciones.
- **Entrenamientos:** caballos que entrena otra persona, con planificación macro, meso y microciclo (ya existe en *Rendimiento*).
- **Monta libre:** reserva de pista.
- **Competiciones y eventos:** quién va, con qué caballo, inscripción y transporte.
- **Visitas de profesionales:** el herrador viene el jueves a 8 caballos, el veterinario el lunes.

### Capa 3. Relación (centro ↔ cliente ↔ profesionales)
- **App del cliente (PWA):** mis caballos, mis clases, mis facturas y mis avisos.
- **Zona privada del caballo:** historial clínico, diagnósticos, radiografías y tratamientos. **La ven solo el propietario, el centro y los profesionales a los que se da acceso.**
- **Círculo del caballo:** cada profesional, con su especialidad, ve y escribe solo lo suyo.
- **Avisos automáticos:** herraje, vacunas, desparasitación y dentista, con 7 días de antelación configurables. Llegan a la vez **al propietario, al centro y al profesional**.
- **Incidencias:** el centro comunica algo (manta rota, cojera, no ha comido) con foto. Queda registrado, el dueño lo lee y lo confirma.
- **Comunicados:** suspensiones, competiciones y avisos generales, por grupos (alumnos, propietarios, disciplina).
- **Feed de actividad del caballo:** salió al paddock, trabajó 40 min o le vio el herrador. Es el "han sacado a pasear a mi caballo".
- **Pagos:** facturas del pupilaje y extras, cobro con tarjeta o SEPA (ya existe en el portal).

### Capa 4. Comunidad (más adelante, solo si hay tracción)
Grupos por disciplina (doma, salto, completo, raid, enganche), calendario de concursos de la zona y contenido técnico de marcas o patrocinadores **con el permiso explícito del usuario**.

### Capa 5. Datos e IoT (exploratoria)
GPS en la cabezada, sensores de actividad en el box (detección precoz de cólicos), consumo de agua y cámara del box. **No construimos hardware.** Si llega, se hace con integraciones de terceros. Los datos agregados para estudios se tratan solo anonimizados y con consentimiento (RGPD, ver §9).

### Mapa de módulos y estado en el repo

| Módulo | Capa | Estado actual en el repo | Qué falta para el nuevo foco |
|---|---|---|---|
| Ficha del caballo | 0 | ✅ Hecho (`caballos`, importador Excel, QR de box, escáner de chip) | Campos de centro: box, propietario frente a jinete y disciplina |
| Sanidad y tratamientos | 0 / 3 | ✅ Hecho (`HealthEvent`, libro de tratamientos, recordatorios) | Avisos a propietario y profesional, no solo al centro |
| Documentos | 0 / 3 | ✅ Hecho (R2 privado) | Permisos por profesional y subida desde el profesional |
| Tareas y calendario | 1 / 2 | 🟡 Parcial (`Task`, `Event` genérico) | Agenda tipada: clases, visitas y competiciones |
| Alimentación | 1 | 🟡 Parcial (`FeedingPlan`, `FeedingLog`, nutrición) | Conectarla con el stock: consumo real que descuenta inventario |
| Stock y proveedores | 1 | 🔴 Casi nuevo (existe `Product` con `stock` y nada más) | Movimientos de stock, umbrales, previsión, proveedores y pedidos |
| Pupilaje | 1 / 3 | ✅ Hecho (`BoardingContract` y extras con prorrateo) | Tipos de servicio: pupilaje completo, media pensión, entrenamiento |
| Facturación Veri*Factu | 1 | ✅ Hecho (falta el envío real a la AEAT) | Facturar clases y bonos |
| Contactos | 1 | ✅ Hecho | Pasar de "contacto" a "cliente con cuenta" |
| Clases y reservas | 2 | 🔴 Nuevo | Todo: pistas, profesores, niveles, plazas, bonos y cancelaciones |
| Rendimiento y periodización | 2 | ✅ Hecho (Macro, Meso, Micro y `DailyLoad`) | Abrirlo al entrenador externo y al fisio |
| Portal del propietario | 3 | 🟡 Parcial (`/portal` con caballos, documentos y facturas) | Convertirlo en **la app del cliente**: avisos, incidencias, feed y clases |
| Roles externos | 3 | 🟡 Parcial (`VET_EXTERNAL`, `OWNER_EXTERNAL`, `HorseAccess`) | Rol de profesional con especialidad, rol de alumno o jinete y profesor |
| Incidencias y comunicados | 3 | 🔴 Nuevo | Modelo, notificaciones y confirmación de lectura |
| Notificaciones push | 3 | 🔴 Nuevo (pendiente desde la fase anterior) | Web Push en la PWA, email de respaldo y luego WhatsApp Business |
| PWA offline | transversal | 🔴 Nuevo | Service worker, cola local y sincronización |
| Kiosko y diario con IA | 2 | ✅ Hecho | Reutilizar como "parte del día" del mozo, que alimenta el feed del cliente |
| Reproducción | Cría | ✅ Hecho (F1–F4) | Nada. Pasa a ser un add-on |
| Movimientos REGA y libro de explotación | legal | ✅ Hecho | Nada. Es obligatorio también para centros |
| Comunidad | 4 | ⚪ Futuro | — |
| IoT y datos | 5 | ⚪ Futuro | — |

**Lectura honesta:** alrededor del 60 % de lo que pide un centro hípico **ya existe** en el repo, aunque pensado desde la yeguada. Hay cuatro piezas nuevas grandes: **clases y reservas**, **app del cliente con avisos e incidencias**, **stock y proveedores**, y **notificaciones con PWA offline**.

---

## 6. Personas y roles (nuevo modelo)

| Rol | Hoy en `enum Role` | Ve | Hace |
|---|---|---|---|
| Gerente o dueño del centro | `OWNER` | Todo el centro | Todo, incluida la facturación y la configuración |
| Encargado | `MANAGER` | Todo menos la configuración sensible | Operación diaria |
| Mozo | `GROOM` | Caballos y tareas del día | Registrar comidas, salidas, incidencias y tareas |
| **Profesor o instructor** | 🔴 nuevo | Sus clases, sus alumnos y los caballos que usa | Pasar lista, notas de progreso y cancelar |
| **Profesional externo** (con especialidad: veterinario, herrador, fisio, dentista, nutricionista, entrenador) | 🟡 `VET_EXTERNAL` (solo veterinario) | Los caballos con acceso concedido, **en todos sus centros** | Registrar visitas, informes y adjuntos y proponer la siguiente cita |
| **Propietario** | 🟡 `OWNER_EXTERNAL` | Sus caballos, facturas y avisos | Consultar, confirmar incidencias, pedir servicios y pagar |
| **Alumno o jinete** | 🔴 nuevo | Sus clases y comunicados | Reservar, cancelar y pagar bonos |

Una persona puede tener varios roles en varios centros. Por ejemplo, un propietario que además da clases, o un herrador que también es propietario. Hoy `Membership` liga un usuario a un centro, y eso ya lo permite. Lo que no existe es la **vista agregada multi-centro**, que es una decisión abierta (ver §8, D1).

---

## 7. Principios de producto (actualizados)

1. **El centro paga y el cliente final engancha.** Cada feature del centro se pregunta qué ve su cliente. Cada feature del cliente se pregunta cuánto trabajo le quita al centro.
2. **Primero el caballo.** Todo registro se entiende desde su ficha.
3. **Un dato se apunta una vez y lo ve quien debe.** El herrador registra el herraje y lo ven el dueño, el centro y el próximo recordatorio.
4. **Privado por defecto.** El historial clínico es del caballo y de su propietario. El centro y los profesionales acceden con permisos explícitos y revocables.
5. **El canal es Relincho, no WhatsApp.** WhatsApp puede *avisar* ("tienes una incidencia"), pero el registro, la foto y la confirmación viven en Relincho.
6. **Funciona en la cuadra.** Primero el móvil, funcionamiento offline, botones grandes y tres toques para lo frecuente.
7. **Simplicidad para el cliente final.** El intento anterior fracasó por complejidad profesional. El propietario no configura nada.
8. **Sin falsas promesas.** No anunciamos IoT, comunidad ni integraciones que no existan.
9. **Probado antes de subir.** TDD y quality gate en verde antes de cada push (ver `03-roadmap-tdd.md`).

---

## 8. Decisiones de arquitectura abiertas

Hay que tomarlas **antes** de construir las capas 2 y 3. Para cada una dejo mi recomendación.

| ID | Decisión | Opciones | Recomendación |
|---|---|---|---|
| **D1** | **Identidad multi-centro.** Un herrador o un propietario con relación con varios centros | (a) Una cuenta por centro, como hoy. (b) `User` global con vista agregada "Mis centros" y "Mis caballos" que lee de cada `Membership` | **(b)**. El modelo ya lo permite, solo falta la vista y las consultas multi-tenant seguras. Sin esto no hay efecto red de profesionales |
| **D2** | **¿De quién es el historial del caballo?** Hoy `Horse` pertenece a un `Tenant` | (a) Del centro. Si el caballo se va, se pierde. (b) Del caballo y su propietario, con el centro como custodio. Portabilidad al cambiar de cuadra | **(a) ahora y (b) en el diseño.** Exportar o transferir la ficha entre centros en v2. No migrar el modelo hasta tener 2 o 3 centros reales |
| **D3** | **Offline** | (a) Solo lectura cacheada. (b) Cola de escrituras local con reintento. (c) Base local completa con sincronización (CRDT) | **(b)** solo para las acciones del mozo y del profesional (comida, salida, incidencia, visita). Lo demás, online |
| **D4** | **Notificaciones** | Web Push, email, SMS, WhatsApp Business API | **Web Push y email** primero. WhatsApp Business cuando haya ingresos, porque cuesta por mensaje y requiere plantillas aprobadas |
| **D5** | **Clases y reservas: ¿construir o integrar?** | Construir o integrar un motor de reservas de terceros | **Construir.** Es el núcleo del día a día del centro y está ligado a caballos y profesores. Un genérico no entiende de caballos |
| **D6** | **Cobro a clientes finales** | Cobra el centro con su Stripe (Connect) o solo emitimos factura | Ya se cobra desde el portal. Valorar Stripe Connect cuando se haga el módulo de bonos (ver modelo de negocio) |
| **D7** | **Datos agregados** | No usarlos, usarlos anonimizados con consentimiento o venderlos | **No vender datos personales jamás.** Solo agregados anónimos, con base legal y opt-in. Ver §9 |

---

## 9. Riesgos y dónde discrepo de la reunión

1. **Sesgo de una sola reunión.** Dos expertos de un mismo entorno no son el mercado. Antes de construir clases y reservas, **hay que validar con 5–10 centros** (§10).
2. **"La información es poder" y el modelo de datos o publicidad.** El RGPD y la confianza del cliente lo limitan mucho. Los datos de salud del caballo no son datos personales, pero los de su dueño sí, y el centro es responsable del tratamiento. Si el centro sospecha que "vendemos sus datos", no nos contrata. **El negocio es la suscripción.** Los datos, como mucho, son un extra anónimo y opt-in.
3. **Pago único: no.** Un SaaS con hosting, soporte, Veri*Factu y evolución constante necesita ingresos recurrentes. Un pago único hace que mantener a cada cliente sea un coste sin ingresos asociados.
4. **"3,40 € al año por usuario y 2 millones de usuarios"** no es un plan: hay que contrastarlo con el número real de jinetes en España (ver el informe de mercado). El B2C directo no es la vía de entrada.
5. **Explosión de alcance.** Las capas 1 a 5 son un producto de cinco años. Riesgo de hacer 10 módulos a medias. **Hay que cerrar primero un bucle completo**: centro, cliente y un profesional (el herrador) con avisos.
6. **SICAB 2026 (17–22 nov) es una feria de criadores PRE.** El mensaje "yeguada" sigue siendo el correcto para esa feria. Allí también hay centros hípicos: **llevar los dos mensajes** y medir cuál engancha más.
7. **Arranque en frío de los profesionales.** El herrador no entra por un solo centro. El valor para él aparece con 2 o 3 centros en su zona, así que conviene **concentrar la venta geográficamente** (Jerez y Sevilla) en vez de dispersarla.
8. **Competencia: ya existe y es barata.** Equimondo (gestión gratis y facturación a 45 € como máximo) es lo que encuentra un centro español que busca en Google. Con los precios actuales, Relincho es lo más caro de la comparativa para un centro de 40 caballos. Vamos a **sustituir** herramientas, no solo a digitalizar a quien no tiene nada. Los precios se corrigen en `02-modelo-de-negocio.md` §4.
9. **Responsabilidad clínica.** El veterinario escribe diagnósticos y Relincho los guarda: hace falta autoría clara, sellado de tiempo e inalterabilidad, como ya hacemos con Veri*Factu.
10. **El mercado español es pequeño.** Las licencias federativas bajan (72.987 en 2021 frente a 61.294 en 2024, según el CSD). La estimación del mercado total es de 1,8 a 5 M€ al año. Solo con España y solo con suscripción, el techo es una empresa rentable de 2 a 4 personas. Crecer más exige Portugal o Latinoamérica e ingresos por cobros o por profesionales.

---

## 10. Validación: qué tenemos que comprobar y cómo

| Hipótesis | Experimento | Criterio de éxito |
|---|---|---|
| H1. El centro hípico sufre más por la coordinación con clientes que por la gestión interna | 8 entrevistas a gerentes de centros: *"Cuéntame la última vez que un cliente se enfadó por no enterarse de algo"* | Al menos 5 de 8 lo citan sin que se lo sugiramos |
| H2. El centro pagaría por darle la app a sus clientes | Enseñar un mockup del portal del cliente y preguntar el precio con Van Westendorp | Al menos 4 centros dan un precio aceptable ≥ el plan actual |
| H3. Los clientes usarían la app | Piloto en un centro: invitar a 20 clientes | Al menos el 50 % la abre en la primera semana y el 30 % sigue activo a las 4 semanas |
| H4. El herrador y el veterinario la usarían para registrar | Piloto con el herrador del centro piloto | Registra al menos 3 visitas en Relincho en un mes sin que se lo recordemos |
| H5. El stock con aviso de agotamiento ahorra un problema real | Preguntar: *"¿Cuándo fue la última vez que os quedasteis sin heno o viruta?"* | Al menos 3 de 8 lo han sufrido en el último año |

**Siguientes pasos:**
1. Recibir el **dossier de capas y servicios** que prometió el fisioterapeuta, a través del contacto de la UCA, y contrastarlo con la §5.
2. Contactar con los dos socios del **centro de Jerez que reabre** como piloto número 1 (oferta de cliente fundador adaptada de `pilot_offer`).
3. Definir el nuevo ICP del centro hípico y su scoring de leads, que sustituye al de la yeguada.
4. Ejecutar el roadmap de `03-roadmap-tdd.md`.

---

## 11. Marca

- **Nombre:** se mantiene **Relincho**. Es cercano, español y ecuestre sin ser técnico, y funciona igual para un centro que para un dueño. En la reunión surgió algo como "Nico Stables" como ejemplo de comunidad, no como propuesta de nombre.
- **Tono:** cercano y de cuadra, sin jerga de software. Se tutea al cliente final y se trata de forma profesional al centro.
- **Lemas candidatos:**
  - *"Tu caballo, en tu bolsillo."* (cliente final)
  - *"Tu centro organizado. Tus clientes, informados."* (centro)
  - *"Todos los que cuidan de tu caballo, en un solo sitio."* (círculo del caballo)
- El nombre técnico del repo (`equigest`) no cambia.

---

## 12. Lo que Relincho NO es (por ahora)

- Una app de entrenamiento GPS para jinetes, tipo Equilab. Como mucho la integramos.
- Un fabricante de hardware o IoT.
- Una red social abierta.
- Un software de gestión de concursos (inscripciones o resultados de la RFHE).
- Un sustituto del criterio veterinario, contable o legal.
- Un ERP genérico.

---

## Glosario

- **Pupilaje:** servicio mensual de alojamiento y cuidado del caballo de un cliente en el centro.
- **Media pensión:** el caballo de un propietario lo monta otra persona parte de la semana, compartiendo el gasto.
- **Círculo del caballo:** el propietario, el centro y los profesionales con acceso a la ficha de un caballo concreto.
- **Centro hípico o ecuestre:** instalación con boxes, pistas y servicios de pupilaje o escuela.
- **Yeguada o ganadería:** explotación dedicada a la cría.
