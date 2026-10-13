# Guion de demo para inversores · 7 minutos

**Objetivo:** que el inversor salga pensando tres cosas:

1. Es un producto serio y terminado.
2. Resuelve un dolor real del día a día de una yeguada.
3. Está bien construido y puede crecer.

**Estructura:** dolor (Inicio) → profundidad (ficha y reproducción) → escala (facturación Veri\*Factu, libro de explotación, varias yeguadas, móvil).

**Yeguada:** *Yeguada Valdeolivo*, en Utrera, con 26 yeguas, 3 sementales y 6 potros (datos inventados; ver «Preparación»).

---

## Preparación (la víspera)

| Hecho | Qué | Por qué |
|---|---|---|
| ☐ | `DEMO_OWNER_EMAILS="tu@gmail.com" npm run db:seed:demo` | Las fechas son relativas al día del seed. Con datos de hace una semana, los avisos salen caducados. |
| ☐ | Hacer la demo sobre **producción** (build), no sobre `npm run dev` | En `next dev` el botón «N» de Next tapa la primera pestaña del móvil, y la primera carga de cada pantalla tarda segundos. |
| ☐ | Entrar con tu cuenta de Google y elegir **Yeguada Valdeolivo** | Tu usuario tiene dos yeguadas: el selector aparece y sirve para el minuto de escala. |
| ☐ | Navegador a pantalla completa, 1440 px o más, zoom 100 %, modo claro | Así es como están revisadas las pantallas. |
| ☐ | Móvil con la misma cuenta abierto en **Inicio** | Para el último minuto. |
| ☐ | Abrir una vez cada pantalla del guion | Calienta la caché y evita esperas en directo. |
| ☐ | **No** pulsar «Generar facturas del mes» al ensayar | Si se pulsa, las facturas ya existen en la demo. Si pasa, repite el seed: funciona aunque haya facturas emitidas. |

---

## Minuto a minuto

### 0:00 – 1:00 · Inicio: el dolor
**Pantalla:** Inicio («Hoy»).

**Qué decir:**
> «Una yeguada de Pura Raza Española con 25 yeguas lleva la reproducción en una libreta y en el WhatsApp del veterinario. Cada mañana alguien tiene que acordarse de qué yegua toca ecografiar, cuál está a punto de parir y qué vacuna ha caducado. Si se le pasa, pierde una gestación o una inspección. Esto es lo primero que ven al abrir Relincho.»

**Señalar, sin hacer clic todavía:**
- **Partos próximos:** *Bética XX*, en rojo: «el calcio en leche está por encima de 200 ppm, parto probable en 24–72 horas». Eso lo deduce el sistema a partir de lo que anota el mozo.
- **Reproducción:** ecografías, ventanas de cubrición y lo que ya va tarde.
- **Sanidad:** las desparasitaciones y la vacuna vencidas, con sus días de retraso.
- **Las cuatro cifras:** gestantes, fertilidad de la temporada frente a la anterior, partos de este mes y censo.

**Frase de paso:**
> «En cinco segundos sabes el estado de la yeguada. Y cada aviso lleva a su origen.»

### 1:00 – 2:30 · Caballos y ficha: la profundidad
**Acción:** *Caballos* en el menú.

> «El censo con el estado de cada animal: quién está gestante, quién en celo y quién tiene algo vencido.»

**Acciones:**
1. Pulsar el filtro **«Con avisos»** (3) para mostrar que se encuentra lo urgente con un clic.
2. Quitar el filtro y abrir **Ilusionada IV**.

**Ficha · qué decir:**
> «Identidad completa, con UELN, microchip y Libro Genealógico; quiénes son sus padres; y su estado. Está gestante, aquí se ve el día de gestación y la fecha de parto prevista.»

**Acción:** pestaña **Pedigrí**.
> «Tres generaciones, como en el certificado de la ANCCE. Es lo que un criador enseña a un comprador. Cada ascendiente es una ficha más.»

**Opcional (10 s):** botón **Ficha de venta**, que genera el PDF para un comprador.

### 2:30 – 4:30 · Reproducción: el corazón del producto
**Acción:** *Reproducción* en el menú.

> «Aquí está toda la temporada. Arriba, lo que le importa al dueño del negocio:
> - la fertilidad, un 67 %, siete puntos mejor que el año pasado;
> - lo que le cuesta en semen cada potro que consigue, 608 €;
> - los partos de los próximos 60 días.»

**Pipeline:**
> «Cada yegua en su paso, de vacía a parida. Y en cada tarjeta está lo siguiente que hay que hacer.»

**Acción en directo (la más importante de la demo):**
1. En **Gestantes**, tarjeta de **Alhambra V**: pulsar **«Registrar eco»**.
2. Se abre su temporada con el formulario ya abierto.
3. En **Latido** elegir **Sí** y pulsar **Guardar Eco**.
4. Volver a *Reproducción*.

> «Un clic. El sistema ya sabe que la siguiente es la ecografía de confirmación y cuándo toca. Ha predicho celos, ovulaciones y partos a partir de lo que anota el veterinario, y aprende el ciclo de cada yegua.»

**Señalar:** la **Agenda** de los próximos 14 días, agrupada por día.

**Acción:** pestaña **Estadísticas**.
> «Fertilidad por semental y por método. Esto es lo que decide qué semental usar la próxima temporada y cuánto cuesta cada gestación.»

### 4:30 – 6:00 · Escala y cumplimiento
**Acción:** *Facturación* en el menú. Pulsar **«Generar facturas del mes»**.

> «Los caballos de pupilaje de otros propietarios se facturan solos: un clic, tres facturas emitidas y numeradas. Cada una genera su registro Veri\*Factu con huella encadenada a la anterior y el QR en el PDF, como exige la ley antifraude.»

**Acción:** abrir el **PDF** de una factura para enseñar el QR.

**Acción:** *Libro de explotación* en el menú.
> «El libro oficial de la explotación (RD 804/2011 y la orden andaluza) se lleva solo: nacimientos, compras y bajas. Ahora mismo, *Todo en regla*. Ante una inspección, el PDF sale de este botón.»

**Acción:** abrir el **selector de yeguadas** escribiendo `/dashboard` en la barra de direcciones (tu usuario tiene dos).
> «Cada yeguada es un espacio aislado. El mismo usuario puede trabajar con varias, y hay roles distintos: propietario, gestor, mozo, veterinario externo, y propietarios de caballos en pupilaje con su propio portal.»

### 6:00 – 7:00 · Móvil y cierre
**Acción:** enseñar el móvil con *Inicio* abierto.
> «El mozo y el veterinario lo usan en la cuadra, desde el móvil: los mismos avisos, y las acciones rápidas para apuntar un cuidado o una tarea sin salir de Inicio.»

**Cierre (sin pantalla):**
> «Relincho ya cubre lo que una yeguada hace cada día, la reproducción, que es donde se juega el dinero, y lo que le exige la ley. Lo siguiente es [lo que pidas: pilotos en SICAB, el envío a la AEAT, captación].»

---

## Si algo falla (plan B)

| Problema | Qué hacer |
|---|---|
| Una pantalla tarda | Seguir hablando: «mientras carga…». En producción y con la caché caliente no debería pasar. |
| El formulario de eco no se abre | Volver a *Reproducción* y entrar en la tarjeta de la yegua. El botón **Ecografía** está en su temporada. |
| «Generar facturas» dice que ya existen | Se pulsó en el ensayo. Enseñar las facturas ya emitidas y su PDF: el mensaje es el mismo. |
| Avisos con fechas raras | El seed no se ejecutó la víspera. Repetir `npm run db:seed:demo` (unos 30 s). |
| Sin conexión | No hay versión offline: llevar capturas de cada pantalla en el portátil. |

## Preguntas difíciles (respuestas honestas)

- **«¿Ya envía las facturas a Hacienda?»**
  Hoy genera el registro Veri\*Factu completo: XML, huella encadenada y QR. Los registros son inalterables en la base de datos. El envío automático a la AEAT necesita el certificado de cada yeguada y es el siguiente paso. Está en el plan antes de la obligatoriedad.
- **«¿Cómo se aíslan los datos de cada yeguada?»**
  Cada consulta pasa por el contexto de la yeguada y por el rol del usuario; los externos solo ven sus caballos. La base de datos tiene RLS, pero hoy protege sobre todo la API de datos: el aislamiento de la aplicación está en el código, y esa es la parte que conviene auditar antes de escalar.
- **«¿Los datos son reales?»**
  No. Es una yeguada de demostración con nombres inventados y datos generados a fecha de hoy, para que la demo se vea como un día cualquiera.
- **«¿Cuánto cuesta de verdad una gestación?»**
  La cifra cuenta solo el semen con coste registrado, incluidos los celos que no quedaron; la monta natural sin coste no entra. Lo explica la nota al pie de *Estadísticas*.
