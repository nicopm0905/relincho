import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Primary action last, so it lands nearest the page content. */
  actions?: React.ReactNode;
  /** Renders a quiet back link above the title. */
  backHref?: string;
  backLabel?: string;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel = "Atrás",
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {backHref && (
        <Link
          href={backHref}
          className="-ml-1 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <CaretLeft weight="bold" className="h-3.5 w-3.5" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[22px] leading-tight font-semibold tracking-tight text-foreground sm:text-[26px]">
            {title}
          </h1>
          {description && (
            <p className="text-[13.5px] text-muted-foreground">{description}</p>
          )}
        </div>
        {/* Stacked and full width on phones; buttons never shrink, so a row
            is only safe once there is room for it. */}
        {actions && (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center [&>*]:w-full sm:[&>*]:w-auto">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/** Quiet heading for a block inside a page that is not a Card. */
export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-border pb-2.5 sm:items-end sm:gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
