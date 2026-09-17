/**
 * Rutas de imagen de la landing V2.
 *
 * Cada constante apunta a la foto definitiva en `public/landing-v2/`. Mientras
 * esa foto no exista, apunta al fallback indicado en el spec, de modo que meter
 * la foto real sea cambiar una linea aqui y no tocar ningun layout.
 */

// TODO: sustituir por foto propia — yegua PRE al paso en la finca, luz de tarde.
export const HERO_POSTER = "/hero-bg.jpg";

/**
 * Vídeo de fondo del hero. Cuando exista `public/landing-v2/hero.mp4` (8-12 s,
 * en bucle y sin audio), pon aqui su ruta y el hero lo reproducira sobre el
 * poster. Con `null` el hero se queda solo con la imagen.
 */
// TODO: sustituir por vídeo propio — mismo plano que el poster.
export const HERO_VIDEO: string | null = null;

// TODO: sustituir por foto propia — interior de cuadra / boxes, tono oscuro.
export const CARD_CUADRA = "/hero-bg.jpg";

// TODO: sustituir por foto propia — pradera verde con caballos, plano amplio.
export const CARD_CAMPO = "/hero-bg.jpg";

// TODO: sustituir por foto propia — cuero de montura, arena de pista o pared de cuadra.
export const CARD_TEXTURA = "/hero-bg-isolated.jpg";

// TODO: sustituir por foto propia — retrato vertical de persona con caballo.
export const RETRATO_JINETE = "/hero-mascot.jpg";

export const LOGO = "/logo.png";

/** Curva de easing compartida por toda la landing V2. */
export const EASE = [0.22, 1, 0.36, 1] as const;

/** Paleta de la V2. Oliva de marca, no un verde generico. */
export const COLORS = {
  bg: "#0b0d08",
  olive: "#a3b846",
  oliveDark: "#7d9033",
} as const;
