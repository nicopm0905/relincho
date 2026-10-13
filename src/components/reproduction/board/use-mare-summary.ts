import { useFormatter, useTranslations } from "next-intl";
import type { MareOverview } from "@/server/services/reproduction/overview";

/** The one line that matters for each mare, by phase. */
export function useMareSummary() {
  const t = useTranslations("repro.summary");
  const format = useFormatter();
  const day = (value: Date | string) => format.dateTime(new Date(value), { day: "numeric", month: "short" });

  return (m: MareOverview): string => {
    const i = m.insight;
    switch (i.phase) {
      case "IN_HEAT": {
        const parts = [
          i.lastExam?.follicleMm ? t("follicle", { mm: i.lastExam.follicleMm }) : null,
          i.ovulation ? t("ovulation", { date: day(i.ovulation.expected) }) : null,
        ].filter(Boolean);
        return parts.join(" · ") || t("heatSigns");
      }
      case "COVERED":
        return i.nextCheck ? t("check", { label: i.nextCheck.label, date: day(i.nextCheck.due) }) : t("pendingScan");
      case "PREGNANT":
      case "FOALING_SOON":
        return i.gestation
          ? t("gestation", { days: i.gestation.days, date: day(i.gestation.expected) })
          : t("pregnant");
      case "POSTPARTUM":
        return i.foalHeat ? t("foalHeat", { from: day(i.foalHeat.from), to: day(i.foalHeat.to) }) : t("foaled");
      case "DIESTRUS":
        return i.nextEstrus ? t("nextEstrus", { date: day(i.nextEstrus.estrusFrom) }) : t("cycling");
      case "ANESTRUS":
        return t("anestrus");
      default:
        return t("noData");
    }
  };
}

export function mareCycleHref(tenantSlug: string, m: MareOverview) {
  const id = m.cycle?.id ?? m.latestCycleId;
  return id ? `/${tenantSlug}/reproduccion/${id}` : `/${tenantSlug}/caballos/${m.mare.id}?tab=reproduccion`;
}
