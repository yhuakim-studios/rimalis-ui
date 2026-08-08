"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Category } from "@rimalis/types";
import { Button, Input } from "@/components/primitives";
import { buildCatalogueQuery, hasActiveFilters, type CatalogueParams } from "@/lib/search-params";
import { buildCategoryTree, flattenTree } from "@/lib/listing";

/**
 * Category and price filters.
 *
 * ## Categories are links; price is a form
 *
 * A category is one click with one outcome, so each is an `<a href>` — shareable,
 * crawlable, and it works with the back button. Price is two coupled numbers that
 * are only meaningful together, so it is a form submitted once; navigating on
 * every keystroke of a min-price field would fire a request per digit and, since
 * the API's rate limit is per-IP and shared by all shoppers under the BFF, that
 * is a real cost rather than a theoretical one.
 *
 * ## The nesting is the point
 *
 * The tree comes from `buildCategoryTree`, which relies on the API's guarantee
 * that the returned set is **connected** — every ancestor of every returned
 * category is present. Before that guarantee existed, nested categories arrived
 * with their parents missing and a naive builder silently dropped the entire
 * subtree from this panel, with no error anywhere. `orphans` is rendered at the
 * top level rather than discarded, so a regression shows up as a flat category
 * instead of a vanished one.
 *
 * ## Prices here are whole Naira, not kobo
 *
 * The API's `minPrice`/`maxPrice` are Naira numbers, and a shopper types Naira.
 * `lib/money.ts` is not involved: nothing here does arithmetic, and converting to
 * kobo just to convert back would be two chances to be wrong for no gain.
 */

export function FilterPanel({
  categories,
  params,
  basePath,
}: {
  categories: readonly Category[];
  params: CatalogueParams;
  basePath: string;
}) {
  const router = useRouter();
  const { roots, orphans } = buildCategoryTree(categories);
  const items = flattenTree([...roots, ...orphans]);

  // Strings, not numbers: an empty box is `""`, and `useState<number>` would
  // force a sentinel (0 or NaN) for that — where 0 is a legal-looking value the
  // API rejects with a 400. Parsing happens once, on submit.
  const [min, setMin] = useState(params.min?.toString() ?? "");
  const [max, setMax] = useState(params.max?.toString() ?? "");

  const href = (changes: Partial<CatalogueParams>) =>
    `${basePath}${buildCatalogueQuery({ ...params, ...changes, page: undefined })}`;

  const onPriceSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parse = (raw: string): number | undefined => {
      const value = Number(raw.trim());
      // Same rule as `parsePrice` in search-params: 0 and below become
      // `undefined`, because `minPrice=0` is a 400 rather than "no minimum".
      // Deliberately duplicated as a guard rather than imported, since the URL
      // is re-parsed on the server anyway — this only keeps the request legal.
      return raw.trim() === "" || !Number.isFinite(value) || !Number.isInteger(value) || value <= 0
        ? undefined
        : value;
    };
    router.push(href({ min: parse(min), max: parse(max) }));
  };

  return (
    <aside aria-label="Filters" className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-caption font-semibold text-ink">Category</h2>
        <ul className="flex flex-col">
          <li>
            <FilterLink href={href({ category: undefined })} active={!params.category}>
              All categories
            </FilterLink>
          </li>
          {items.map(({ category, depth }) => (
            <li key={category.id}>
              <FilterLink
                href={href({
                  // Clicking the active category clears it — the affordance a
                  // shopper reaches for before finding "All categories".
                  category: params.category === category.slug ? undefined : category.slug,
                })}
                active={params.category === category.slug}
                depth={depth}
              >
                {category.name}
              </FilterLink>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <form onSubmit={onPriceSubmit} className="flex flex-col gap-3">
          <h2 className="text-caption font-semibold text-ink">Price</h2>
          <div className="flex items-end gap-3">
            <Input
              label="Min (₦)"
              type="number"
              inputMode="numeric"
              // `min={1}` and not `0`: the API declares `exclusiveMinimum: 0`, so
              // a submitted 0 is a 400. The browser hint and the server rule
              // agree, which is what stops a shopper hitting a validation error
              // they cannot interpret.
              min={1}
              step={1}
              value={min}
              onChange={(event) => setMin(event.target.value)}
              placeholder="0"
            />
            <Input
              label="Max (₦)"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={max}
              onChange={(event) => setMax(event.target.value)}
              placeholder="Any"
            />
          </div>
          <Button type="submit" variant="secondary" fullWidth>
            Apply price
          </Button>
        </form>
      </section>

      {hasActiveFilters(params) && (
        <Button
          variant="tertiary"
          icon={<X className="size-5" strokeWidth={1.5} />}
          onClick={() => {
            setMin("");
            setMax("");
            // `sort` and the search term survive: clearing filters means
            // "widen the results", not "undo my search".
            router.push(`${basePath}${buildCatalogueQuery({ q: params.q, sort: params.sort })}`);
          }}
        >
          Clear filters
        </Button>
      )}
    </aside>
  );
}

function FilterLink({
  href,
  active,
  depth = 0,
  children,
}: {
  href: string;
  active: boolean;
  depth?: number;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      // `aria-current` rather than colour alone, so the active filter is
      // announced and not merely visible.
      aria-current={active ? "true" : undefined}
      className={
        "flex min-h-11 items-center rounded-input px-3 text-body transition-colors duration-150 ease-out-soft " +
        (active ? "bg-brand-50 font-medium text-brand-700" : "text-ink-muted hover:bg-divider/60 hover:text-ink")
      }
      // Indentation by depth. An inline style rather than a class because the
      // value is data-driven — a `pl-${depth}` template string is exactly the
      // dynamic class Tailwind cannot see at build time and would emit nothing
      // for. Still an 8-point multiple.
      style={depth > 0 ? { paddingLeft: `${12 + depth * 16}px` } : undefined}
    >
      {children}
    </a>
  );
}
