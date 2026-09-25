import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** `card` draws its own surface; `plain` sits inside an existing card. */
  variant?: "card" | "plain";
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "card",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        variant === "card"
          ? "rounded-2xl border border-dashed border-border/80 bg-card/70 py-14 shadow-bento"
          : "py-10",
        className,
      )}
    >
      {icon && (
        <div className="mb-3 text-muted-foreground/60 [&>svg]:h-7 [&>svg]:w-7">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px] text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
