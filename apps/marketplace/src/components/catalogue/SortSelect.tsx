"use client";

import { useRouter } from "next/navigation";
import type { ListingSort } from "@rimalis/types";
import { Select } from "@/components/primitives";
import { buildCatalogueQuery, type CatalogueParams } from "@/lib/search-params";

/**
 * Sort order.
 *
 * A native `<select>` that navigates on change. Not a custom dropdown: the native
 * one gets the platform picker on mobile, keyboard typeahead and correct focus
 * behaviour for free, and a hand-rolled listbox is the most commonly broken
 * widget on the web.
 *
 * Navigating on `change` rather than requiring an Apply button is right here
 * because sort is a single value with an immediate, obvious effect — unlike the
 * price range, which is two coupled numbers and therefore a form.
 *
 * `page` resets to 1. Changing the sort while on page 5 would show page 5 of a
 * completely different ordering, which is not a page the shopper asked for.
 */

const LABELS: Record<ListingSort, string> = {
  newest: "Newest first",
  // Worth being explicit that these are exact rather than best-effort: they read
  // a trigger-maintained `effective_price` column, so a listing priced by
  // fallback to the pool product's base price interleaves correctly with one
  // carrying a vendor override. That was not true before migration 20260803120000.
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
};

export function SortSelect({
  params,
  basePath,
}: {
  params: CatalogueParams;
  basePath: string;
}) {
  const router = useRouter();

  return (
    <Select
      label="Sort by"
      labelHidden
      value={params.sort}
      onChange={(event) => {
        router.push(
          `${basePath}${buildCatalogueQuery({
            ...params,
            sort: event.target.value as ListingSort,
            page: undefined,
          })}`,
        );
      }}
    >
      {(Object.keys(LABELS) as ListingSort[]).map((sort) => (
        <option key={sort} value={sort}>
          {LABELS[sort]}
        </option>
      ))}
    </Select>
  );
}
