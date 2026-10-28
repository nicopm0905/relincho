/**
 * Ventanas congeladas: no se despliega a producción (roadmap §3).
 * Fechas en hora de Madrid, ambos extremos incluidos. Un hotfix dentro de una
 * ventana necesita el OK de los dos socios (`DEPLOY_HOTFIX=1`).
 */
export const FREEZES = [
  { from: "2026-11-16", to: "2026-11-23", why: "SICAB 2026" },
  { from: "2026-12-18", to: "2027-01-07", why: "Navidad, primeras semanas del piloto" },
];

/** Fecha `YYYY-MM-DD` en Madrid ("sv-SE" formatea así). */
export function madridDay(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(now);
}

/** La ventana congelada que contiene `now`, o `null`. */
export function isFrozen(now = new Date(), freezes = FREEZES) {
  const day = madridDay(now);
  return freezes.find((f) => day >= f.from && day <= f.to) ?? null;
}
