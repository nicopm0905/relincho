# Imágenes de la landing V2

Ninguna de estas fotos existe todavía. Hasta que se suban, la landing usa los
fallbacks indicados abajo, declarados en `src/components/landing-v2/assets.ts`.
Para meter la foto real basta con dejarla en esta carpeta y cambiar la constante
correspondiente en ese fichero: ningún layout necesita tocarse.

| Fichero esperado      | Contenido                                                  | Fallback actual            | Constante        |
| --------------------- | ---------------------------------------------------------- | -------------------------- | ---------------- |
| `hero-poster.jpg`     | Yegua PRE al paso en la finca, luz de tarde                | `/hero-bg.jpg`             | `HERO_POSTER`    |
| `hero.mp4`            | Mismo plano en vídeo, 8-12 s en bucle, sin audio           | ninguno (solo el póster)   | `HERO_VIDEO`     |
| `card-cuadra.jpg`     | Interior de cuadra / boxes, tono oscuro                    | `/hero-bg.jpg`             | `CARD_CUADRA`    |
| `card-campo.jpg`      | Pradera verde con caballos, plano amplio                   | `/hero-bg.jpg`             | `CARD_CAMPO`     |
| `card-textura.jpg`    | Cuero de montura, arena de pista o pared de cuadra         | `/hero-bg-isolated.jpg`    | `CARD_TEXTURA`   |
| `retrato-jinete.jpg`  | Retrato vertical de persona con caballo                    | `/hero-mascot.jpg`         | `RETRATO_JINETE` |

## Logos de la marquesina

La marquesina del hero no usa logos ajenos. Muestra texto (`ANCCE`, `SICAB`,
`RFHE`, `VERI*FACTU`) hasta que haya logos con permiso de uso explícito. Ese
array vive en `src/components/landing-v2/hero-v2.tsx`.
