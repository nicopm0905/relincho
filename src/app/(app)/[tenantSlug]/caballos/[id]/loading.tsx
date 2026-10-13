import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

/** Same shape as the record: header with photo and facts, then tabs. */
export default function Loading() {
  const t = useTranslations("horseDetail");
  return (
    <div className="animate-in fade-in-0 space-y-6 duration-300" aria-busy="true" aria-label={t("loading")}>
      <Skeleton className="h-5 w-24" />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="flex flex-col gap-5 p-6 sm:flex-row">
          <Skeleton className="size-24 rounded-2xl sm:size-32" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-72 max-w-full" />
            <Skeleton className="h-4 w-60 max-w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-7 w-44" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-border lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2 p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-28" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-4 border-b border-border pb-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-5 w-20" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
