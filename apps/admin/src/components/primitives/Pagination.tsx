import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/components/primitives";

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
 * ## Why it takes an `href` function rather than the catalogue's params
 *
 * It started coupled to `CatalogueParams` + `basePath`, which was right while
 * the catalogue and the storefront were its only callers. Order history is the
 * third, and its URL has a `status` filter and no notion of `sort` or `min` —
 * so the choice was a second pager or one that does not know what a query string
 * means. A `hrefForPage` callback keeps every caller's URL rules where they
 * belong: with the page that owns that URL.
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

export interface PaginationProps {
  /** The page being shown. May exceed `totalPages` — see the header. */
  page: number;
  totalPages: number;
  /** Builds the URL for a page number. The caller owns its own query string. */
  hrefForPage: (page: number) => string;
}

export function Pagination({ page, totalPages, hrefForPage }: PaginationProps) {
  if (totalPages <= 1) return null;

  const href = hrefForPage;
  const slots = pageWindow(page, totalPages);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1 pt-4">
      {/*
        Previous and Next are rendered as disabled SPANS at the ends, not as
        links to a page that does not exist. A `<a>` with no href is not
        focusable and not announced as a control, which is the correct behaviour
        for an unavailable action — unlike a link to `?page=0`, which the API
        would reject with a 400.
      */}
      {page > 1 ? (
        <Link href={href(page - 1)} aria-label="Previous page" className={cn(SLOT, "text-ink hover:bg-divider/60")}>
          <ChevronLeft className="size-5" strokeWidth={1.5} />
        </Link>
      ) : (
        <span aria-hidden className={cn(SLOT, "text-ink-subtle")}>
          <ChevronLeft className="size-5" strokeWidth={1.5} />
        </span>
      )}

      {slots.map((slot, index) =>
        slot === null ? (
          <span key={`gap-${index}`} className={cn(SLOT, "text-ink-subtle")} aria-hidden>
            &hellip;
          </span>
        ) : slot === page ? (
          // `aria-current="page"` is what tells a screen reader which page this
          // is; the colour alone says it only to sighted users.
          <span key={slot} aria-current="page" className={cn(SLOT, "bg-ink font-medium text-white")}>
            {slot}
          </span>
        ) : (
          <Link key={slot} href={href(slot)} className={cn(SLOT, "text-ink hover:bg-divider/60")}>
            {slot}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link href={href(page + 1)} aria-label="Next page" className={cn(SLOT, "text-ink hover:bg-divider/60")}>
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
