import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Progressive-loading placeholders. The operational snapshot is fetched in
 * tiers; while a tier is in flight its screens render these instead of a
 * misleading "0". Layout matches the real content so nothing shifts.
 */

export function KpiSkeletonGrid({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div
      className={
        className ?? "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4"
      }
    >
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="mt-4 h-7 w-16" />
            <Skeleton className="mt-2 h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = "h-72" }: { height?: string }) {
  return (
    <div className={`${height} flex items-end gap-3 px-2 pb-2`}>
      {[70, 45, 85, 30, 60, 50].map((h, i) => (
        <Skeleton key={i} className="flex-1 rounded-md" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-4 w-8" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-7 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/**
 * Whole-screen placeholder: real page heading (so navigation feels instant)
 * plus KPI and table placeholders while that screen's data tier loads.
 */
export function PageLoading({
  title,
  subtitle,
  kpis = 5,
  rows = 6,
}: {
  title: string;
  subtitle?: string;
  kpis?: number;
  rows?: number;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground mt-1">{subtitle}</p> : null}
      </div>
      {kpis > 0 ? (
        <KpiSkeletonGrid count={kpis} className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4" />
      ) : null}
      <Card>
        <CardContent className="p-0">
          <TableSkeleton rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
