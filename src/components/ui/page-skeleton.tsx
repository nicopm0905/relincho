import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-in fade-in-0 space-y-6 duration-300" aria-busy="true" aria-label="Cargando página">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44 rounded-lg" />
          <Skeleton className="h-4 w-72 max-w-[80vw] rounded-md" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-bento">
        <div className="mb-5 flex items-center justify-between">
          <Skeleton className="h-5 w-40 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
        <div className="space-y-1">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 py-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5 rounded-md" />
                <Skeleton className="h-3 w-3/5 rounded-md" />
              </div>
              <Skeleton className="hidden h-4 w-20 rounded-md sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CollectionSkeleton() {
  return (
    <div className="animate-in fade-in-0 space-y-6 duration-300" aria-busy="true" aria-label="Cargando página">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36 rounded-lg" />
          <Skeleton className="h-4 w-64 max-w-[80vw] rounded-md" />
        </div>
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="hidden h-10 w-40 rounded-xl sm:block" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="aspect-[4/3] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
