/** Etiquetas en castellano de los enums de rendimiento y nutricion. */

export const workTypeLabels: Record<string, string> = {
  DESCANSO: "Descanso",
  RECUPERACION_ACTIVA: "Recuperación activa",
  PISTA_TECNICA: "Pista técnica",
  PISTA_ALTA_INTENSIDAD: "Alta intensidad",
  CAMPO_FONDO: "Campo / fondo",
  GIMNASIA_SALTO: "Gimnasia de salto",
  COMPETICION: "Competición",
};

/** Version corta para las celdas estrechas del microciclo. */
export const workTypeShortLabels: Record<string, string> = {
  DESCANSO: "Descanso",
  RECUPERACION_ACTIVA: "Recuperación",
  PISTA_TECNICA: "Pista técnica",
  PISTA_ALTA_INTENSIDAD: "Intensidad",
  CAMPO_FONDO: "Campo",
  GIMNASIA_SALTO: "Salto",
  COMPETICION: "Competición",
};

export const phaseLabels: Record<string, string> = {
  ACUMULACION: "Acumulación",
  TRANSMUTACION: "Transmutación",
  REALIZACION: "Realización",
  TRANSICION: "Transición",
};

export const phaseDescriptions: Record<string, string> = {
  ACUMULACION: "Alto volumen, intensidad contenida",
  TRANSMUTACION: "Se cambia volumen por intensidad",
  REALIZACION: "Tapering y descarga previa a competir",
  TRANSICION: "Entrada progresiva a la temporada",
};

export const disciplineLabels: Record<string, string> = {
  DOMA_CLASICA: "Doma clásica",
  DOMA_VAQUERA: "Doma vaquera",
  SALTO: "Salto",
  COMPLETO: "Concurso completo",
  RAID: "Raid",
  ENGANCHES: "Enganches",
  FUNCIONALIDAD: "Funcionalidad",
  OCIO: "Ocio",
};

export const reproductiveStatusLabels: Record<string, string> = {
  NA: "No aplica",
  CICLANDO: "Ciclando",
  GESTANTE: "Gestante",
  LACTANDO: "Lactando",
  SEMENTAL_EN_MONTA: "Semental en monta",
  SEMENTAL_REPOSO: "Semental en reposo",
};

export const dayStatusLabels: Record<string, string> = {
  PLANNED: "Planificado",
  COMPLETED: "Hecho",
  MISSED: "Perdido",
  ADJUSTED: "Reajustado",
};

export const fatigueZoneLabels: Record<string, string> = {
  BAJA: "Carga ligera",
  MEDIA: "Carga media",
  ALTA: "Carga alta",
};

export const bufferStatusLabels: Record<string, string> = {
  idle: "Sin desviaciones",
  active: "Margen en uso",
  exhausted: "Margen agotado",
};

/**
 * Color de cada fase en las graficas de carga. Cuatro slots de una paleta
 * categorica validada: separacion suficiente para daltonismo y para vision
 * normal, en tema claro y oscuro. El orden es fijo, nunca se cicla.
 */
export const phaseBarColor: Record<string, string> = {
  ACUMULACION: "bg-phase-acumulacion",
  TRANSMUTACION: "bg-phase-transmutacion",
  REALIZACION: "bg-phase-realizacion",
  TRANSICION: "bg-phase-transicion",
};

/**
 * El color solo marca estado, nunca decora. Un dia planificado es neutro;
 * el verde, el ambar y el rojo dicen que ya ha pasado algo con el.
 */
export const dayStatusTone: Record<string, string> = {
  PLANNED: "text-muted-foreground",
  COMPLETED: "text-emerald-700",
  MISSED: "text-rose-700",
  ADJUSTED: "text-amber-700",
};

export const dayStatusDot: Record<string, string> = {
  PLANNED: "bg-border",
  COMPLETED: "bg-emerald-500",
  MISSED: "bg-rose-500",
  ADJUSTED: "bg-amber-500",
};
