import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** Draws attention to a number that needs action. Use for at most one tile. */
  emphasis?: boolean;
  /** Display-size figure for the 3-4 numbers a page is really about. */
  prominent?: boolean;
  href?: string;
}

/**
 * Deliberately flat: no icon chip, no colour. A dashboard reads faster when
 * the numbers are the only thing competing for attention.
 */
export function StatCard({
  label,
  value,
  hint,
  emphasis = false,
  prominent = false,
  href,
}: StatCardProps) {
  const body = (
    <div
      className={cn(
        "group flex h-full flex-col justify-between gap-4 rounded-2xl border bg-card p-4 shadow-card transition-[border-color,box-shadow,transform] duration-200 sm:p-5",
        emphasis ? "border-state-alert/40 bg-state-alert-soft" : "border-border",
        href && "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-raised",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "text-label font-medium",
            emphasis ? "text-state-alert-ink" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
        {href && (
          <CaretRight
            weight="bold"
            aria-hidden
            className="h-3 w-3 shrink-0 translate-x-0 text-muted-foreground/0 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground"
          />
        )}
      </div>
      <div>
        <div
          className={cn(
            "font-semibold tracking-tight tabular-nums",
            prominent ? "text-title sm:text-display" : "text-title",
            emphasis ? "text-state-alert-ink" : "text-foreground",
          )}
        >
          {value}
        </div>
        {hint && (
          <p className="mt-1.5 text-caption text-muted-foreground">{hint}</p>
        )}
      </div>
    </div>
  );

  return href ? (
    <Link
      href={href}
      className="block h-full rounded-2xl focus-visible:outline-offset-4"
    >
      {body}
    </Link>
  ) : (
    body
  );
}
