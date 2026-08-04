import type { Category, ListListingsQuery, ListingSort } from "@digistore/types";

/**
 * The single owner of the catalogue URL's query string.
 *
 * Two vocabularies meet here and nowhere else. The **URL** uses short, human,
 * shareable names (`?q=airpods&category=audio&min=20000`); the **API** uses its
 * own (`search`, `categoryId`, `minPrice`). If that translation happened at each
 * page, the two would drift, and the failure mode is silent — a mistyped
 * parameter name is not an error, it is a filter that stops applying.
 *
 * ## Parsing is lenient, always
 *
 * Every input here is attacker-controlled and, more commonly, human-edited. A
 * hand-typed `?page=abc&min=-5&sort=cheapest` must render a page, never an error
 * boundary: a shopper who mangles a URL wants the catalogue, and a crawler
 * following a malformed link should get a 200 rather than teach the search engine
 * that this route is broken. So every field falls back to its default rather
 * than rejecting.
 *
 * ## `limit` is fixed and never read from the URL
 *
 * Accepting it would let any crawler request `limit=100` on every page of the
 * catalogue — the API's own maximum — turning one bot into a hundred-row query
 * per request against Supabase. There is no shopper-facing reason to change the
 * page size, so there is no parameter for it.
 */

/** Fixed page size. The API caps `limit` at 100 and 400s above it; 24 divides
 * the 2/3/4-column grid evenly at every breakpoint. */
export const PAGE_SIZE = 24;

const SORTS = ["newest", "price_asc", "price_desc"] as const;

const DEFAULT_SORT: ListingSort = "newest";

/**
 * The URL's own shape, after parsing. Distinct from `ListListingsQuery`, which is
 * the API's — keeping them as two types is what stops one being passed where the
 * other belongs.
 */
export interface CatalogueParams {
  /** Free-text search. Trimmed; empty becomes `undefined`. */
  q?: string;
  /** Category **slug**, not id — a slug is readable and stable in a shared link. */
  category?: string;
  /** Minimum price in whole Naira. Always ≥ 1; see `parsePrice`. */
  min?: number;
  max?: number;
  sort: ListingSort;
  page: number;
}

/**
 * Next 16 hands `searchParams` in as this shape: a value may be absent, a single
 * string, or an array when the key repeats (`?q=a&q=b`).
 */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/** First value wins on a repeated key — arbitrary, but deterministic, which is
 * what matters for a URL two people might share. */
const single = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return value;
};

/**
 * A price bound in whole Naira, or `undefined`.
 *
 * ⚠️ **Rejects 0, and that is not a rounding decision.** The API declares
 * `minPrice`/`maxPrice` with `exclusiveMinimum: 0`, so `minPrice=0` is a **400**
 * — not "no minimum". A shopper who types 0 into a min-price box, or clears it
 * to `?min=0`, would otherwise take the whole catalogue page down with a
 * validation error. Clamping to `undefined` is the only behaviour that both
 * matches the shopper's intent (no lower bound) and keeps the request legal.
 *
 * Also drops negatives, non-finite values and fractions. Fractions because a
 * price filter in kobo is not a thing anyone wants to express in a URL, and
 * rounding one silently would make the filter disagree with what was typed.
 */
const parsePrice = (raw: string | undefined): number | undefined => {
  if (raw === undefined || raw.trim() === "") return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) return undefined;
  return value;
};

const parsePage = (raw: string | undefined): number => {
  if (raw === undefined) return 1;
  const value = Number(raw);
  // An out-of-range page is NOT an error: the API answers `?page=999` with a
  // successful empty array and the real `total`, which the pager renders as an
  // empty state. Only a non-number or a non-positive value falls back to 1.
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) return 1;
  return value;
};

const parseSort = (raw: string | undefined): ListingSort =>
  SORTS.includes(raw as ListingSort) ? (raw as ListingSort) : DEFAULT_SORT;

/** Parses the URL. Never throws, never rejects — see the module header. */
export function parseCatalogueParams(raw: RawSearchParams): CatalogueParams {
  const q = single(raw["q"])?.trim();
  const category = single(raw["category"])?.trim();
  const min = parsePrice(single(raw["min"]));
  const max = parsePrice(single(raw["max"]));

  return {
    ...(q ? { q } : {}),
    ...(category ? { category } : {}),
    // A reversed range (`?min=900&max=100`) would match nothing and read as a
    // broken catalogue. Swapping is the charitable reading of an obvious typo,
    // and it keeps the empty state honest — an empty result then really means
    // nothing matched.
    ...(min !== undefined && max !== undefined && min > max
      ? { min: max, max: min }
      : { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) }),
    sort: parseSort(single(raw["sort"])),
    page: parsePage(single(raw["page"])),
  };
}

/**
 * Translates parsed URL params into the API's query, resolving the category slug
 * to an id against the category list the filter panel has already fetched.
 *
 * The slug→id resolution has to happen somewhere, and doing it here means one
 * lookup and one clear failure mode: **an unknown slug drops the filter rather
 * than sending a bogus `categoryId`**. Sending one would be a 400 (the API wants
 * a uuid) or, worse with a well-formed-but-wrong uuid, a silently empty result
 * that looks like "this category has no products".
 */
export function toApiQuery(
  params: CatalogueParams,
  categories: readonly Category[],
): ListListingsQuery {
  const category = params.category
    ? categories.find((c) => c.slug === params.category)
    : undefined;

  return {
    page: params.page,
    limit: PAGE_SIZE,
    sort: params.sort,
    ...(params.q ? { search: params.q } : {}),
    ...(category ? { categoryId: category.id } : {}),
    ...(params.min !== undefined ? { minPrice: params.min } : {}),
    ...(params.max !== undefined ? { maxPrice: params.max } : {}),
  };
}

/**
 * Serialises params back to a query string for a link.
 *
 * Omits defaults, so the canonical catalogue URL is `/products` rather than
 * `/products?sort=newest&page=1`. That is not tidiness: two URLs for one page
 * split its search-engine authority and make the "is this filter active?" check
 * in the UI ambiguous.
 */
export function buildCatalogueQuery(params: Partial<CatalogueParams>): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.min !== undefined) search.set("min", String(params.min));
  if (params.max !== undefined) search.set("max", String(params.max));
  if (params.sort && params.sort !== DEFAULT_SORT) search.set("sort", params.sort);
  if (params.page !== undefined && params.page > 1) search.set("page", String(params.page));
  const serialised = search.toString();
  return serialised ? `?${serialised}` : "";
}

/**
 * A URL with some params changed and the rest kept.
 *
 * **Resets `page` to 1 unless `page` is what changed.** Changing a filter while
 * on page 5 and staying on page 5 lands the shopper in an empty state that looks
 * like the filter returned nothing — the single most common pagination bug in
 * faceted search, and the reason this helper exists instead of callers spreading
 * objects by hand.
 */
export function withParams(
  current: CatalogueParams,
  changes: Partial<CatalogueParams>,
): Partial<CatalogueParams> {
  const next: Partial<CatalogueParams> = { ...current, ...changes };
  if (changes.page === undefined) delete next.page;
  return next;
}

/** True when any filter narrows the catalogue — drives the "Clear all" affordance
 * and the wording of the empty state, which must not say "no products exist"
 * when it means "no products match". */
export const hasActiveFilters = (params: CatalogueParams): boolean =>
  Boolean(params.q || params.category || params.min !== undefined || params.max !== undefined);
