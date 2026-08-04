import { Container } from "@/components/layout";
import { ProductGridSkeleton } from "@/components/catalogue";
import { Skeleton } from "@/components/primitives";

/**
 * The catalogue's loading state.
 *
 * Shaped like the real page — heading, count line, filter column, sort control,
 * grid — because that is the entire point of a skeleton over a spinner: it
 * reserves the space the content will occupy, so nothing jumps when it arrives.
 * A centred spinner reserves nothing and guarantees a layout shift.
 *
 * Which makes this file's obligation clear: **when `page.tsx`'s layout changes,
 * this changes with it.** A skeleton that no longer matches promises a layout and
 * then breaks it, which is worse than showing nothing.
 *
 * ## ⚠️ Why this file is inside a `(browse)` route group
 *
 * It was at `products/loading.tsx`, one level up. A `loading.tsx` wraps its own
 * segment **and every descendant** in a Suspense boundary, so from there it also
 * wrapped `products/[listingId]` — and a boundary above a route makes Next flush
 * the shell before that route's `notFound()` resolves, committing the response as
 * **200**. Every dead product URL was returning a soft 404.
 *
 * The `(browse)` group scopes this boundary to the catalogue alone. Route groups
 * do not appear in the URL, so `/products` is unchanged.
 *
 * **Do not move this file, or `page.tsx`, back up to `products/`.** The group is
 * not organisational tidiness; it is the fix. See the long note in
 * `products/[listingId]/page.tsx`.
 */

export default function Loading() {
  return (
    <Container className="py-8 md:py-12">
      <div className="flex flex-col gap-2 pb-8">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-40" />
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        <div className="hidden w-64 shrink-0 flex-col gap-8 lg:flex">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-20" />
            {/* Seven rows: the seed has six categories plus "All categories", so
                the panel does not resize when the real list lands. */}
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-12" />
            <div className="flex gap-3">
              <Skeleton className="h-12 flex-1" />
              <Skeleton className="h-12 flex-1" />
            </div>
            <Skeleton className="h-12 w-full" />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-48" />
          </div>
          <ProductGridSkeleton />
        </div>
      </div>
    </Container>
  );
}
