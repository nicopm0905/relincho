import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  /** Draws attention to a number that needs action. Use for at most one tile. */
  emphasis?: boolean;
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
  href,
}: StatCardProps) {
  const body = (
    <div
      className={cn(
        "group flex h-full flex-col justify-between gap-4 rounded-2xl border bg-card p-4 shadow-bento transition-[border-color,box-shadow,transform] duration-200",
        emphasis ? "border-amber-300/70 bg-amber-50/40" : "border-border",
        href && "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-raised",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12.5px] font-medium text-muted-foreground">
          {label}
        </span>
        {href && (
          <CaretRight
            weight="bold"
            className="h-3 w-3 shrink-0 translate-x-0 text-muted-foreground/0 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground"
          />
        )}
      </div>
      <div>
        <div
          className={cn(
            "text-[28px] leading-none font-semibold tracking-tight tabular-nums",
            emphasis ? "text-amber-700" : "text-foreground",
          )}
        >
          {value}
        </div>
        {hint && (
          <p className="mt-1.5 text-[12px] text-muted-foreground">{hint}</p>
        )}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
