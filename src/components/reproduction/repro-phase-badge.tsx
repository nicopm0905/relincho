import { useTranslations } from "next-intl";
import type { ReproPhase } from "@/lib/repro-engine";
import { StateBadge, type StateTone } from "@/components/ui/state-badge";

/** Phase of the breeding engine, folded into the five steps a breeder uses. */
export const phaseTone: Record<ReproPhase, StateTone> = {
  ANESTRUS: "empty",
  UNTRACKED: "empty",
  DIESTRUS: "heat",
  IN_HEAT: "heat",
  COVERED: "covered",
  PREGNANT: "pregnant",
  FOALING_SOON: "pregnant",
  POSTPARTUM: "foaled",
};

export function ReproPhaseBadge({ phase, className }: { phase: ReproPhase; className?: string }) {
  const t = useTranslations("reproPhase");
  return (
    <StateBadge tone={phase === "FOALING_SOON" ? "danger" : phaseTone[phase]} className={className}>
      {t(phase)}
    </StateBadge>
  );
}
