import type { MarketplaceListing } from "@rimalis/types";
import { ProductCard, ProductCardSkeleton } from "./ProductCard";

/**
 * The product grid.
 *
 * `1 / 2 / 3 / 4` columns across the breakpoints — the design system's
 * 1 / 2–3 / 4–6 responsive rule, landing at 4-up on `xl` where the 1320px measure
 * gives each card ~300px. `gap-6` is 24px, an 8-point step.
 *
 * `<ul>` rather than a grid of divs so the count is announced. `ProductCard`
 * renders an `<li>`, which is why nothing here wraps its children.
 */

export function ProductGrid({ listings }: { listings: readonly MarketplaceListing[] }) {
  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {listings.map((listing) => (
        // `listing.id`, not `product.id` — the same product from two vendors
        // appears twice, and keying on the product id would collapse them into
        // one and make React reuse the wrong card's state.
        <ProductCard key={listing.id} listing={listing} />
      ))}
    </ul>
  );
}

/**
 * The grid's loading state.
 *
 * Same column classes and same gap as the real grid, deliberately duplicated
 * rather than shared through a constant: they must match, and a shared constant
 * would let someone change the grid and believe the skeleton followed. Twelve
 * cards is half a page — enough to fill the fold at every breakpoint without
 * rendering 24 shimmering boxes.
 */
export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <ul
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      // One announcement for the whole grid, not one per placeholder — every
      // `Skeleton` inside is `aria-hidden`.
      aria-busy
      aria-label="Loading products"
    >
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </ul>
  );
}
