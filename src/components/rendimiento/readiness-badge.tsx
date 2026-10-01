import { Badge } from "@/components/ui/badge";
import type { ReadinessLevel } from "@/lib/readiness";
import { READINESS_STYLE } from "./readiness-style";

interface Props {
  readiness: {
    level: ReadinessLevel;
    label: string;
    firstReason: string | null;
  } | null;
}

/** Semáforo compacto para listas: punto + texto, y el motivo al pasar el ratón. */
export function ReadinessBadge({ readiness }: Props) {
  if (!readiness) return null;
  const style = READINESS_STYLE[readiness.level];
  return (
    <Badge variant={style.badge} title={readiness.firstReason ?? readiness.label}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {readiness.label}
    </Badge>
  );
}
