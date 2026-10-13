import Link from "next/link";
import { useTranslations } from "next-intl";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  /** Context under the title: what this page covers, or how many items. */
  description?: React.ReactNode;
  /** Small marks next to the title, such as a status badge. */
  meta?: React.ReactNode;
  /** One primary action, last. Secondary actions before it, or in a menu. */
  actions?: React.ReactNode;
  /** Trail of parent pages. The current page is the title, not a crumb. */
  breadcrumbs?: Breadcrumb[];
  /** Shorthand for a single parent crumb. */
  backHref?: string;
  backLabel?: string;
  className?: string;
}

/**
 * The one page header: trail, serif title, context and the page's primary
 * action. Every screen opens with it so they all read in the same order.
 */
export function PageHeader({
  title,
  description,
  meta,
  actions,
  breadcrumbs,
  backHref,
  backLabel,
  className,
}: PageHeaderProps) {
  const t = useTranslations("common");
  const trail =
    breadcrumbs ?? (backHref ? [{ label: backLabel ?? t("back"), href: backHref }] : []);
  const parent = [...trail].reverse().find((crumb) => crumb.href);

  return (
    <header className={cn("space-y-3", className)}>
      {trail.length > 0 && (
        <nav aria-label={t("breadcrumbs")}>
          {/* Phones only have room for the way back. */}
          {parent && (
            <Link
              href={parent.href!}
              className="-ml-1 inline-flex min-h-8 items-center gap-1 rounded-md px-1 text-label font-medium text-muted-foreground transition-colors hover:text-foreground sm:hidden"
            >
              <CaretLeft weight="bold" aria-hidden className="h-3.5 w-3.5" />
              {parent.label}
            </Link>
          )}
          <ol className="hidden flex-wrap items-center gap-1 text-label text-muted-foreground sm:flex">
            {trail.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="rounded-sm font-medium transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
                <CaretRight aria-hidden weight="bold" className="h-3 w-3 opacity-60" />
              </li>
            ))}
            <li aria-current="page" className="truncate text-foreground">
              {title}
            </li>
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="font-serif text-title font-medium text-foreground">
              {title}
            </h1>
            {meta}
          </div>
          {description && (
            <p className="text-body text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

/** Quiet heading for a block inside a page that is not a Card. */
export function SectionHeading({
  title,
  description,
  action,
  className,
  id,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 sm:items-end sm:gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 id={id} className="text-heading font-semibold text-foreground">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-label text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
