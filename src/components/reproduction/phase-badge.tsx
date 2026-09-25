import { Badge } from "@/components/ui/badge";
import { reproPhaseLabels, type ReproPhase } from "@/lib/repro-engine";

type Variant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";

export const phaseVariant: Record<ReproPhase, Variant> = {
  ANESTRUS: "secondary",
  UNTRACKED: "outline",
  DIESTRUS: "outline",
  IN_HEAT: "warning",
  COVERED: "info",
  PREGNANT: "success",
  FOALING_SOON: "destructive",
  POSTPARTUM: "default",
};

export function PhaseBadge({ phase }: { phase: ReproPhase }) {
  return <Badge variant={phaseVariant[phase]}>{reproPhaseLabels[phase]}</Badge>;
}
