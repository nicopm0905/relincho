import { createTRPCRouter, tenantProcedure } from "../init";
import { getFarmHeat } from "@/server/services/weather";

/**
 * El tiempo de la finca. Nadie lo apunta: la ubicación sale de la cuenta y la
 * previsión hora a hora de MET Norway (gratis, sin clave).
 */
export const weatherRouter = createTRPCRouter({
  /** Calor de hoy y de los dos días siguientes; null si no hay previsión. */
  heat: tenantProcedure.query(async ({ ctx }) => {
    return getFarmHeat(ctx.tenantId).catch(() => null);
  }),
});
