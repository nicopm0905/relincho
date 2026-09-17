"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

interface CountUpOptions {
  from: number;
  to: number;
  /** El contador arranca cuando esto pasa a true, y solo una vez. */
  active: boolean;
  durationMs?: number;
}

/**
 * Cuenta de `from` a `to` con un cubic ease-out sobre requestAnimationFrame y
 * devuelve el importe ya formateado en euros a la espanola (`14.250,00 €`).
 * Con `prefers-reduced-motion` pinta el valor final sin animar.
 */
export function useCountUp({
  from,
  to,
  active,
  durationMs = 1200,
}: CountUpOptions): string {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(from);

  useEffect(() => {
    // Con reduced motion no hay animacion que arrancar: el valor final se
    // deriva en el render, mas abajo.
    if (!active || reduceMotion) return;

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (to - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, from, to, durationMs, reduceMotion]);

  const current = reduceMotion ? (active ? to : from) : value;

  return `${current.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}
