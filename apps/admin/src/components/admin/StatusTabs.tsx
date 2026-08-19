import Link from "next/link";
import { cn } from "@/components/primitives";

/**
 * A tab strip of links, generalised from the vendor app's `orders/StatusTabs`.
 *
 * Links, not buttons — the same reasoning as `ButtonLink`. Each tab is a
 * navigation to a different URL, so it gets middle-click, cmd-click, copy-address
 * and a shareable state for free, and needs no client JavaScript to work.
 *
 * ## Why this exists alongside `FilterBar`
 *
 * They overlap and are not the same. A `FilterBar` is for filters an admin
 * *composes* — a search term plus a date range plus a vendor. Tabs are for the one
 * filter that is really a **view**: the statuses of an order, the states of a
 * vendor. Those are mutually exclusive, small in number, and switched between
 * constantly, so they deserve one click rather than a select plus a submit.
 *
 * A screen may have both, and several do: tabs for status, a bar for the rest.
 * When it does, the tabs must carry the bar's parameters in their hrefs or
 * switching tabs silently discards the search — hence `params`.
 */

export interface StatusTab {
  /** The query value. `undefined` for the "all" tab, which omits the parameter. */
  value?: string;
  label: string;
  /** Rendered after the label when known — a queue length worth seeing. */
  count?: number;
}

export interface StatusTabsProps {
  basePath: string;
  /** The parameter these tabs set. Usually `status`. */
  param: string;
  tabs: readonly StatusTab[];
  /** What is currently selected; `undefined` selects the "all" tab. */
  current?: string | undefined;
  /**
   * Other filters to preserve when switching tabs.
   *
   * `page` must NOT be in here: changing the view should land on page 1, and
   * carrying a page number across a filter change is how an admin ends up on an
   * empty page wondering where the rows went.
   */
  params?: Record<string, string | undefined>;
}

export function StatusTabs({ basePath, param, tabs, current, params = {} }: StatusTabsProps) {
  const hrefFor = (value: string | undefined): string => {
    const search = new URLSearchParams();
    for (const [key, existing] of Object.entries(params)) {
      if (key === param || key === "page") continue;
      if (existing !== undefined && existing !== "") search.set(key, existing);
    }
    if (value !== undefined) search.set(param, value);
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  return (
    <nav
      // A tab strip is navigation, and naming it lets a screen reader user jump
      // to it. `aria-label` rather than a heading because it has no visible one.
      aria-label="Filter by status"
      className="-mx-1 overflow-x-auto"
    >
      <ul className="flex gap-1 px-1">
        {tabs.map((tab) => {
          const selected = tab.value === current;
          return (
            <li key={tab.value ?? "all"} className="shrink-0">
              <Link
                href={hrefFor(tab.value)}
                prefetch={false}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "flex min-h-9 items-center gap-1.5 rounded-pill px-3 text-caption transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                  selected
                    ? "bg-brand-600 font-semibold text-white"
                    : "bg-canvas text-ink-muted hover:text-ink",
                )}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      "tabular-nums",
                      selected ? "text-white/70" : "text-ink-subtle",
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
