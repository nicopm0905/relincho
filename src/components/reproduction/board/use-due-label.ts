import { useFormatter, useTranslations } from "next-intl";
import { calendarDayOffset } from "@/lib/day-window";

export type DueTone = "overdue" | "now" | "later";

/**
 * Windows (scan from day 28 to 35, a heat) only count as overdue once they
 * close; while open they read "until <date>".
 */
export function useDueLabel() {
  const t = useTranslations("home.due");
  const tAgenda = useTranslations("repro.agenda");
  const format = useFormatter();
  const day = (value: Date) => format.dateTime(value, { day: "numeric", month: "short" });

  return (from: Date, to: Date, overdue: boolean, now = new Date()): { label: string; tone: DueTone } => {
    if (overdue) return { label: t("overdue", { days: Math.max(0, -calendarDayOffset(to, now)) }), tone: "overdue" };
    const start = calendarDayOffset(from, now);
    if (start > 1) return { label: t("inDays", { days: start }), tone: "later" };
    if (start === 1) return { label: t("tomorrow"), tone: "later" };
    if (calendarDayOffset(to, now) <= 0) return { label: t("today"), tone: "now" };
    return { label: tAgenda("until", { date: day(to) }), tone: "now" };
  };
}
