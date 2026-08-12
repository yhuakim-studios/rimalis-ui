import { Card, Skeleton } from "@/components/primitives";

/**
 * The dashboard's loading state — a skeleton in the shape of the real content, not a
 * spinner.
 *
 * The shape matters: four tiles, a chart card, a list. A generic spinner tells a
 * vendor to wait; a skeleton tells them what is coming and keeps the layout from
 * jumping when it arrives.
 *
 * This covers `(dashboard)` as a whole, so it stands in for whichever route is
 * loading. It is deliberately the dashboard's shape rather than a neutral one —
 * `/` is the entry point and the slowest page, and a per-route `loading.tsx` for the
 * others would be four files describing lists that all look alike.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      {/* The label is announced; the bars are decoration and must not be read out. */}
      <span className="sr-only" role="status">
        Loading your store
      </span>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden>
        {[0, 1, 2, 3].map((index) => (
          <Card key={index} padding="sm" tone="flat" className="flex flex-col gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-3 w-20" />
          </Card>
        ))}
      </div>

      <Card className="flex flex-col gap-4" aria-hidden>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-[180px] w-full" />
      </Card>

      <Card padding="none" aria-hidden>
        <div className="flex flex-col divide-y divide-divider">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex items-center gap-3 p-4">
              <Skeleton className="size-11 shrink-0 rounded-input" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
