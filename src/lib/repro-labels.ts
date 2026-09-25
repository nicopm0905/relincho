/** Codigos y etiquetas de reproduccion compartidos por servidor y formularios. */

export const EXAM_TREATMENTS = [
  "HCG",
  "DESLORELIN",
  "PGF2A",
  "ALTRENOGEST",
  "OXYTOCIN",
  "UTERINE_LAVAGE",
  "ANTIBIOTIC",
  "OTHER",
] as const;
export type ExamTreatment = (typeof EXAM_TREATMENTS)[number];

export const treatmentLabels: Record<ExamTreatment, string> = {
  HCG: "hCG (inducción)",
  DESLORELIN: "Deslorelina (inducción)",
  PGF2A: "PGF2α (prostaglandina)",
  ALTRENOGEST: "Altrenogest (progestágeno)",
  OXYTOCIN: "Oxitocina",
  UTERINE_LAVAGE: "Lavado uterino",
  ANTIBIOTIC: "Antibiótico intrauterino",
  OTHER: "Otro",
};

export const MARE_CONDITIONS = [
  "ENDOMETRITIS",
  "FLUID_POST_BREEDING",
  "RETAINED_PLACENTA",
  "TWINNING",
  "DYSTOCIA",
  "CERVICAL_ISSUE",
  "OTHER",
] as const;
export type MareCondition = (typeof MARE_CONDITIONS)[number];

export const conditionLabels: Record<MareCondition, string> = {
  ENDOMETRITIS: "Endometritis",
  FLUID_POST_BREEDING: "Líquido tras la cubrición",
  RETAINED_PLACENTA: "Retención de placenta",
  TWINNING: "Tendencia a gemelos",
  DYSTOCIA: "Parto distócico previo",
  CERVICAL_ISSUE: "Problema de cérvix",
  OTHER: "Otro",
};

export const corpusLuteumLabels: Record<string, string> = {
  NONE: "Sin CL",
  LEFT: "Izquierdo",
  RIGHT: "Derecho",
  BOTH: "Ambos",
};

export const cervixLabels: Record<string, string> = {
  CLOSED: "Cerrado",
  RELAXING: "Relajándose",
  OPEN: "Abierto",
};

export const sideLabels: Record<string, string> = { LEFT: "Izquierdo", RIGHT: "Derecho" };

export const teasingLabels = [
  "0 · Rechaza",
  "1 · Indiferente",
  "2 · Algún signo",
  "3 · Receptiva",
  "4 · Celo franco",
] as const;

export const edemaLabels = ["0 · Sin edema", "1 · Leve", "2 · Moderado", "3 · Marcado"] as const;

export const methodLabels: Record<string, string> = {
  NATURAL: "Monta natural",
  AI_FRESH: "IA semen fresco",
  AI_REFRIGERATED: "IA semen refrigerado",
  AI_FROZEN: "IA semen congelado",
  ET: "Transferencia embrionaria",
};

export const monthLabels = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
] as const;
