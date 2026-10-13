import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

/** Same shape as the board: header, three figures and five columns. */
export default function Loading() {
  const t = useTranslations("repro");
  return (
    <div className="animate-in fade-in-0 space-y-6 duration-300" aria-busy="true" aria-label={t("loading")}>
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl last:col-span-2 sm:last:col-span-1" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, column) => (
          <div key={column} className="space-y-2 rounded-2xl bg-muted/50 p-2.5">
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 3 }).map((__, card) => (
              <Skeleton key={card} className="h-24 rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
