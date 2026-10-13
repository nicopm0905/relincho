import { cn } from "@/lib/utils";

export type StateTone =
  | "empty"
  | "heat"
  | "covered"
  | "pregnant"
  | "foaled"
  | "alert"
  | "danger"
  | "ok";

const tones: Record<StateTone, { badge: string; dot: string }> = {
  empty: { badge: "bg-state-empty-soft text-state-empty-ink", dot: "bg-state-empty" },
  heat: { badge: "bg-state-heat-soft text-state-heat-ink", dot: "bg-state-heat" },
  covered: { badge: "bg-state-covered-soft text-state-covered-ink", dot: "bg-state-covered" },
  pregnant: { badge: "bg-state-pregnant-soft text-state-pregnant-ink", dot: "bg-state-pregnant" },
  foaled: { badge: "bg-state-foaled-soft text-state-foaled-ink", dot: "bg-state-foaled" },
  alert: { badge: "bg-state-alert-soft text-state-alert-ink", dot: "bg-state-alert" },
  danger: { badge: "bg-state-danger-soft text-state-danger-ink", dot: "bg-state-danger" },
  ok: { badge: "bg-state-ok-soft text-state-ok-ink", dot: "bg-state-ok" },
};

/**
 * The one way to show the state of an animal: same colours in the list, the
 * record, the breeding board and the calendar (tokens in globals.css).
 */
export function StateBadge({
  tone,
  children,
  className,
}: {
  tone: StateTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full shrink-0 items-center gap-1.5 rounded-full px-2.5 text-caption font-semibold whitespace-nowrap",
        tones[tone].badge,
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tones[tone].dot)} />
      <span className="truncate">{children}</span>
    </span>
  );
}

export function stateDotClass(tone: StateTone) {
  return tones[tone].dot;
}
