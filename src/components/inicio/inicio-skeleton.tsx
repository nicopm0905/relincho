import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

/** Same shape as the loaded page, so nothing jumps when the data arrives. */
export function InicioSkeleton() {
  const t = useTranslations("home");
  return (
    <div
      className="animate-in fade-in-0 space-y-10 duration-300"
      aria-busy="true"
      aria-label={t("loading")}
    >
      <div className="space-y-2">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-4 w-64 max-w-[80vw]" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-48" />
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, group) => (
            <div key={group} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="mb-4 flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((__, row) => (
                  <div key={row} className="flex items-center gap-3">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/5" />
                      <Skeleton className="h-3 w-3/5" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, kpi) => (
          <Skeleton key={kpi} className="h-32 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
