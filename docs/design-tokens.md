# Tokens de diseño de la app

Todo color, radio, sombra y tamaño de texto de la app sale de `src/app/globals.css`.
Ningún componente lleva hex sueltos ni clases de paleta cruda (`amber-500`, `sky-400`…):
si hace falta un color nuevo, se añade aquí como token y se justifica.

`tests/accessibility.test.ts` comprueba el contraste de los pares de tokens en claro y
en oscuro (texto ≥ 4.5:1, anillos/barras/puntos ≥ 3:1). Cambiar un color que rompa AA
hace fallar `npm run check:a11y`.

## Color

| Token | Uso | Por qué cambió |
|---|---|---|
| `--primary` `#647825` | Botón primario, activo del menú | `#71852b` daba 4.1:1 con texto blanco: fallaba AA |
| `--ring` `#7a9130` | Anillo de foco | `#8ea644` daba 2.7:1 sobre la tarjeta: el foco no se veía |
| `--destructive` `#c0362c` | Texto y bordes de error | `#ef4444` daba 3.8:1 como texto |
| `--warning`, `--success` | Semánticos genéricos | No se usaban; ahora son tintas legibles, no fondos |

### Estados (`--state-*`)

Un solo sistema de color para el estado de un animal, compartido por badge, pipeline,
calendario y tarjetas. Cada estado tiene tres tonos:

- `state-X` (base): barras, puntos, bordes. ≥ 3:1 sobre la tarjeta.
- `state-X-ink`: texto. ≥ 4.5:1 sobre `state-X-soft` y sobre la tarjeta.
- `state-X-soft`: fondo de badge o de fila.

| Estado | Significado |
|---|---|
| `empty` | Yegua vacía / sin seguimiento |
| `heat` | En celo o en seguimiento folicular |
| `covered` | Cubierta, pendiente de diagnóstico |
| `pregnant` | Gestante |
| `foaled` | Parida / posparto |
| `alert` | Vence pronto o ya venció, sin riesgo inmediato |
| `danger` | Riesgo: tiempo de espera, pérdida, cobro muy vencido |
| `ok` | Al día |

Uso: `bg-state-heat-soft text-state-heat-ink`, `bg-state-pregnant` en una barra.

### Modo oscuro

La paleta `.dark` es la misma oliva cálida bajada de luz (fondo `#12130f`, tarjeta
`#1a1c16`). Antes era gris neutro (`#111`) y parecía otra marca. La app no ofrece
todavía selector de tema: el modo oscuro queda preparado pero fuera de la demo.

## Tipografía

Escala cerrada. Cada texto elige un papel, no un número de píxeles:

| Clase | Tamaño | Uso |
|---|---|---|
| `text-display` | 40px / 600 | La cifra principal de un KPI |
| `text-title` | 30px | Título de página (`PageHeader`), en `font-serif` |
| `text-heading` | 17px | Título de sección o de tarjeta |
| `text-body` | 14px | Texto corriente, filas de lista |
| `text-label` | 13px | Etiquetas, subtítulos de fila |
| `text-caption` | 12px | Metadatos, pistas bajo un KPI |
| `text-micro` | 11px, versalitas | Etiquetas de grupo del menú, badges |

- **Newsreader** (`font-serif`) solo en títulos de página y en el nombre del caballo
  en su ficha: da el tono editorial y premium sin perder legibilidad en datos.
- **Plus Jakarta Sans** para todo lo demás. Las cifras van con `tabular-nums`.

## Radios

`--radius` pasa de `0.625rem` a `0.5rem`: tarjetas (`rounded-2xl`) a 16px y botones
(`rounded-xl`) a 12px. Con 20px la app parecía un juguete al lado de un dato serio.

## Sombras

Tres alturas, teñidas del oliva del texto (sobre fondo cálido, una sombra negra ensucia):

| Clase | Token | Uso |
|---|---|---|
| `shadow-card` (y el alias `shadow-bento`) | `--elevation-1` | Tarjeta en reposo |
| `shadow-raised` | `--elevation-2` | Hover de algo clicable |
| `shadow-overlay` | `--elevation-3` | Menús, diálogos, toasts |

## Espaciado

Escala de Tailwind (múltiplos de 4px) con un ritmo fijo:

- Entre secciones de una página: `space-y-8` (32px).
- Entre la cabecera de una sección y su contenido: `space-y-3` (12px).
- Relleno de tarjeta: `p-5` (20px) en escritorio, `p-4` en móvil.
