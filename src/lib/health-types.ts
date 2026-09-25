/**
 * Nombres de los tipos de evento sanitario. Viven fuera de los componentes de
 * cliente a propósito: si una página de servidor importa una constante de un
 * fichero "use client", recibe una referencia vacía y acaba enseñando
 * "VACCINE" en vez de "Vacuna".
 */
export const healthTypeLabels: Record<string, string> = {
  VACCINE: "Vacuna",
  DEWORMING: "Desparasitación",
  DENTAL: "Dental",
  FARRIER: "Herrador",
  VET_CHECKUP: "Revisión vet.",
  TREATMENT: "Tratamiento",
  INJURY: "Lesión",
  OTHER: "Otro",
};
