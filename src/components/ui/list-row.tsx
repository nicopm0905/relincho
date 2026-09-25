import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

interface ListRowProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Small leading mark: an avatar, initials or a monochrome icon. */
  leading?: React.ReactNode;
  /** Right-hand metadata: a date, an amount, a status badge. */
  meta?: React.ReactNode;
  href?: string;
  className?: string;
}

/**
 * The one row shape used by every list in the app. Keeping a single
 * component is what stops each module drifting into its own look.
 */
export function ListRow({
  title,
  subtitle,
  leading,
  meta,
  href,
  className,
}: ListRowProps) {
  const content = (
    <div
      className={cn(
        "flex items-center gap-3 py-3",
        href && "-mx-2 rounded-xl px-2 transition-[background-color,transform] hover:bg-primary/[0.05] hover:translate-x-0.5",
        className,
      )}
    >
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-foreground">
          {title}
        </div>
        {subtitle && (
          <div className="truncate text-[12.5px] text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>
      {meta && (
        <div className="flex shrink-0 items-center gap-2 text-[12.5px] text-muted-foreground">
          {meta}
        </div>
      )}
      {href && (
        <CaretRight
          weight="bold"
          className="h-3 w-3 shrink-0 text-muted-foreground/50"
        />
      )}
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

/** Monochrome leading mark. Colour is reserved for status, not decoration. */
export function RowIcon({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "alert";
}) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full [&>svg]:h-4 [&>svg]:w-4",
        tone === "alert"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
          : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

/** Divided container for a set of rows. */
export function ListRows({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("divide-y divide-border/70", className)}>{children}</div>
  );
}
