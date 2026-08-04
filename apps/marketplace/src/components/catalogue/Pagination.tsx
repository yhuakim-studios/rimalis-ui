import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PaginationMeta } from "@digistore/types";
import { cn } from "@/components/primitives";
import { buildCatalogueQuery, type CatalogueParams } from "@/lib/search-params";

/**
 * Page navigation.
 *
 * ## Real links, not buttons
 *
 * Every page is an `<a href>` with the full query string. That makes page 3
 * bookmarkable and shareable, gives middle-click and cmd-click, and — the part
 * that matters commercially — lets a crawler reach every product in the
 * catalogue. A pager built from `onClick` handlers is invisible to a search
 * engine, so pages 2 onward simply do not exist as far as it is concerned.
 *
 * ## The window
 *
 * At most seven slots: first, last, up to five around the current page, and
 * ellipses where a gap is elided. Rendering all N pages is fine at 7 and
 * unusable at 400, and the seed is already at 7 with 20 listings — so the
 * windowing is needed now rather than later.
 *
 * ## `page` past the end
 *
 * The API answers `?page=999` with a **200 and an empty array**, and `meta.total`
 * still holds the real total. So this component can be asked to render a current
 * page above `totalPages`; it does, showing the pager honestly rather than
 * pretending the shopper is on the last page. The empty state above it explains
 * what happened.
 */

const WINDOW = 2;

/** The page numbers to show, with `null` marking an elided gap. */
export function pageWindow(current: number, total: number): Array<number | null> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total]);
  for (let p = current - WINDOW; p <= current + WINDOW; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const withGaps: Array<number | null> = [];
  let previous = 0;
  for (const page of sorted) {
    // A gap of exactly one page becomes that page rather than an ellipsis —
    // "1 … 3" is more clicks and less information than "1 2 3".
    if (page - previous === 2) withGaps.push(previous + 1);
    else if (page - previous > 2) withGaps.push(null);
    withGaps.push(page);
    previous = page;
  }
  return withGaps;
}

const SLOT =
  "grid size-11 place-items-center rounded-input text-caption transition-colors duration-150 ease-out-soft";

export function Pagination({
  meta,
  params,
  basePath,
}: {
  meta: PaginationMeta;
  params: CatalogueParams;
  /** `/products` or `/store/<slug>` — the pager is used by both. */
  basePath: string;
}) {
  if (meta.totalPages <= 1) return null;

  const href = (page: number) => `${basePath}${buildCatalogueQuery({ ...params, page })}`;
  const slots = pageWindow(params.page, meta.totalPages);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1 pt-4">
      {/*
        Previous and Next are rendered as disabled SPANS at the ends, not as
        links to a page that does not exist. A `<a>` with no href is not
        focusable and not announced as a control, which is the correct behaviour
        for an unavailable action — unlike a link to `?page=0`, which the API
        would reject with a 400.
      */}
      {params.page > 1 ? (
        <Link href={href(params.page - 1)} aria-label="Previous page" className={cn(SLOT, "text-ink hover:bg-divider/60")}>
          <ChevronLeft className="size-5" strokeWidth={1.5} />
        </Link>
      ) : (
        <span aria-hidden className={cn(SLOT, "text-ink-subtle")}>
          <ChevronLeft className="size-5" strokeWidth={1.5} />
        </span>
      )}

      {slots.map((page, index) =>
        page === null ? (
          <span key={`gap-${index}`} className={cn(SLOT, "text-ink-subtle")} aria-hidden>
            &hellip;
          </span>
        ) : page === params.page ? (
          // `aria-current="page"` is what tells a screen reader which page this
          // is; the colour alone says it only to sighted users.
          <span key={page} aria-current="page" className={cn(SLOT, "bg-ink font-medium text-white")}>
            {page}
          </span>
        ) : (
          <Link key={page} href={href(page)} className={cn(SLOT, "text-ink hover:bg-divider/60")}>
            {page}
          </Link>
        ),
      )}

      {params.page < meta.totalPages ? (
        <Link href={href(params.page + 1)} aria-label="Next page" className={cn(SLOT, "text-ink hover:bg-divider/60")}>
          <ChevronRight className="size-5" strokeWidth={1.5} />
        </Link>
      ) : (
        <span aria-hidden className={cn(SLOT, "text-ink-subtle")}>
          <ChevronRight className="size-5" strokeWidth={1.5} />
        </span>
      )}
    </nav>
  );
}
