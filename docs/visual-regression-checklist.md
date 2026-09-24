# Checklist de regresión visual y accesibilidad

Esta checklist debe ejecutarse antes de publicar cambios que afecten a la interfaz. Está pensada para los flujos de una yeguada y para los dispositivos que se utilizan en oficina, pista y cuadra.

## 1. Preparación

- [ ] Trabajar con una base de datos demo cargada (`npm run db:seed` y, si aplica, `npm run seed:rendimiento`).
- [ ] Arrancar la aplicación con `npm run dev`.
- [ ] Confirmar que la ruta demo abre sin autenticación:
  - `/demo`
  - `/yeguada-demo-andalucia/inicio`
- [ ] Confirmar que no aparecen errores en consola del navegador ni peticiones 5xx inesperadas.
- [ ] Probar con preferencias de movimiento normal y `prefers-reduced-motion`.
- [ ] Limpiar cookies/local storage cuando se compruebe onboarding, cookies o estados iniciales.

## 2. Matriz de viewport

Revisar cada pantalla afectada en estos tamaños, comprobando que no hay scroll horizontal accidental:

| Dispositivo | Viewport orientativo | Puntos de atención |
| --- | --- | --- |
| Móvil pequeño | 375 × 667 | Botones, textos largos, barra inferior y aviso de cookies |
| Móvil grande | 390 × 844 | Formularios, tarjetas y safe areas |
| Tablet | 768 × 1024 | Densidad, tablas y navegación lateral |
| Escritorio | 1440 × 900 | Jerarquía, espacios y ancho máximo |
| Escritorio amplio | 1920 × 1080 | Contenido no estirado y columnas equilibradas |

En móvil y tablet:

- [ ] Ningún elemento importante queda cortado o comprimido.
- [ ] Los controles táctiles tienen al menos 44 × 44 px cuando sea razonable.
- [ ] Las cabeceras pueden envolver acciones sin solaparse.
- [ ] Las tablas usan desplazamiento horizontal contenido y no rompen la página.
- [ ] La navegación inferior respeta la safe area y no tapa acciones.
- [ ] Los diálogos caben en pantalla y se pueden cerrar sin precisión excesiva.
- [ ] Los campos no provocan zoom o pérdida de contexto al usar teclado móvil.

## 3. Rutas públicas y conversión

### Landing (`/` y `/landing-v2`)

- [ ] El hero muestra una propuesta de valor clara sin depender de la animación.
- [ ] El CTA principal se distingue visualmente y lleva a la ruta correcta.
- [ ] El CTA secundario sigue visible cuando aparece el banner de cookies.
- [ ] Header, menú móvil, selector de idioma y footer funcionan en ambos idiomas.
- [ ] Precios, FAQ, demo y fundadores mantienen la misma jerarquía visual.
- [ ] Imágenes con `fill` tienen `sizes`, texto alternativo y no producen layout shift visible.
- [ ] El aviso de cookies no tapa contenido ni roba foco de forma inesperada.

### Demo (`/demo`)

- [ ] La entrada “Probar sin registro” es visible y funciona.
- [ ] El usuario entiende que la demo es de solo lectura.
- [ ] El banner de demo no tapa la navegación ni las acciones principales.
- [ ] No se puede modificar información desde un flujo de demo.

### Acceso (`/login`)

- [ ] El formulario funciona con teclado únicamente.
- [ ] Cada campo tiene label, nombre accesible y mensaje de error asociado.
- [ ] Los estados de carga deshabilitan correctamente la acción y explican el progreso.
- [ ] El botón de Google solo aparece si está configurado y no promete una vía inoperativa.
- [ ] El idioma y el enlace de regreso son accesibles en móvil.

## 4. Panel y flujos prioritarios

### Inicio (`/[tenantSlug]/inicio`)

- [ ] El estado de carga conserva la estructura de la pantalla.
- [ ] Las métricas, alertas y acciones urgentes son legibles sin depender del color.
- [ ] El estado de demo/solo lectura es evidente.
- [ ] Las tarjetas mantienen orden y espaciado en móvil.

### Caballos (`/[tenantSlug]/caballos`)

- [ ] El buscador, filtros y selector de estado tienen nombres accesibles.
- [ ] Las tarjetas enlazan correctamente a la ficha y no generan overflow.
- [ ] La ficha mantiene acciones, foto y datos principales en móvil.
- [ ] El alta y la edición muestran errores junto al campo correspondiente.

### Sanidad y entrenamiento

- [ ] Los formularios se pueden completar sin ratón.
- [ ] Labels, fechas, selects, notas y errores están relacionados correctamente.
- [ ] El envío muestra estado pendiente, éxito y error sin saltos bruscos.
- [ ] Las listas vacías explican la siguiente acción.

### Facturación y movimientos

- [ ] Las tablas tienen cabeceras asociadas y `scope="col"` cuando corresponda.
- [ ] El scroll horizontal se mantiene dentro del contenedor.
- [ ] Los diálogos tienen título, descripción, foco inicial y cierre accesible.
- [ ] Alta/baja y estados seleccionados se anuncian con `aria-pressed` o semántica equivalente.
- [ ] Los formularios no se envían al pulsar botones auxiliares.

### Kiosko (`/[tenantSlug]/kiosko`)

- [ ] El selector de comida tiene estado seleccionado perceptible y anunciable.
- [ ] El gesto de deslizar tiene alternativas equivalentes con teclado y toque.
- [ ] “Omitir” y “Marcar repartido” tienen foco visible y feedback claro.
- [ ] Las tarjetas y botones se pueden usar con una mano en móvil.
- [ ] El modo oscuro conserva contraste suficiente.

## 5. Accesibilidad manual

- [ ] Pulsar `Tab` desde el inicio permite llegar al skip link.
- [ ] El skip link enfoca un único `main#main-content`.
- [ ] El foco nunca desaparece detrás de una cabecera, diálogo o barra inferior.
- [ ] Todos los controles tienen nombre accesible; los icon-only incluyen `aria-label`.
- [ ] Los diálogos atrapan el foco y lo devuelven al control que los abrió.
- [ ] `Escape` cierra menús y diálogos cuando el patrón lo permite.
- [ ] Los headings siguen un orden lógico sin saltos innecesarios.
- [ ] Los estados se comunican con texto, iconos o atributos, no solo con color.
- [ ] Con `prefers-reduced-motion`, no se pierde información ni funcionalidad.
- [ ] El contraste de texto normal, texto grande, controles y estados de error es suficiente.

## 6. Estados que siempre deben revisarse

Para cada pantalla afectada, comprobar al menos:

- [ ] Carga inicial / skeleton.
- [ ] Datos completos.
- [ ] Lista vacía.
- [ ] Error de red o validación.
- [ ] Acción pendiente.
- [ ] Acción completada con toast.
- [ ] Acción no permitida en demo o por permisos.
- [ ] Modo oscuro.
- [ ] Idioma español e inglés, si la pantalla está traducida.

## 7. Puerta de calidad antes de publicar

Ejecutar desde la raíz del proyecto:

```bash
npm run check:quality       # puerta local: tipos + pruebas + accesibilidad
npm run check:http           # requiere un servidor levantado y variables configuradas
npx eslint <archivos-modificados>
```

Criterios de salida:

- [ ] `npm run check:quality` termina correctamente; es la puerta automática de CI.
- [ ] `npm run check:diff` termina correctamente cuando se revisa el diff antes de integrar.
- [ ] Todos los comandos manuales aplicables terminan correctamente.
- [ ] No hay errores nuevos de consola, red o hidratación.
- [ ] No se han introducido dependencias solo para resolver un aviso visual aislado.
- [ ] Las capturas de las rutas afectadas se han comparado en móvil y escritorio.
- [ ] Los cambios de copy, color o interacción tienen una comprobación equivalente en ambos idiomas cuando proceda.
- [ ] Cualquier incidencia pendiente queda anotada con ruta, viewport, pasos para reproducir y severidad.

## Registro de incidencia

Cuando algo falle, registrar:

```text
Ruta:
Viewport:
Modo / idioma:
Flujo:
Resultado esperado:
Resultado observado:
Severidad: bloqueante | alta | media | baja
Captura o referencia:
```
