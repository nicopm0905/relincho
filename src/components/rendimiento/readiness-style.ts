import type { ReadinessLevel } from "@/lib/readiness";

/** Estilo del semáforo: color + icono + texto, nunca el color solo. */
export const READINESS_STYLE: Record<
  ReadinessLevel,
  { box: string; dot: string; text: string; badge: "success" | "warning" | "destructive" | "secondary" }
> = {
  VERDE: {
    box: "border-green-300/70 bg-green-50/60 dark:bg-green-500/10",
    dot: "bg-green-600",
    text: "text-green-800 dark:text-green-300",
    badge: "success",
  },
  AMBAR: {
    box: "border-amber-300/70 bg-amber-50/60 dark:bg-amber-500/10",
    dot: "bg-amber-500",
    text: "text-amber-900 dark:text-amber-300",
    badge: "warning",
  },
  ROJO: {
    box: "border-red-300/70 bg-red-50/60 dark:bg-red-500/10",
    dot: "bg-red-600",
    text: "text-red-800 dark:text-red-300",
    badge: "destructive",
  },
  SIN_CHEQUEO: {
    box: "border-border bg-muted/40",
    dot: "bg-muted-foreground/40",
    text: "text-foreground",
    badge: "secondary",
  },
};
