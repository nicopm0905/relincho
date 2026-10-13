// Fuera del módulo "use client" de las pestañas: una constante exportada desde
// un componente de cliente llega al servidor como referencia, no como array.
export const HORSE_TABS = ["resumen", "reproduccion", "sanidad", "pedigri", "diario", "documentos"] as const;
export type HorseTab = (typeof HORSE_TABS)[number];
