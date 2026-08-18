/**
 * Reading list state out of the URL.
 *
 * Every admin list keeps its filters in the query string — no client state, no
 * `useState`, so a filtered view is shareable, survives a reload, and works with
 * the back button. What that costs is parsing, and the parsing has two traps that
 * both produce a 400 from the API rather than a sensible default.
 *
 * **`Number()` on a bad page.** `Number("abc")` is `NaN`, and `String(NaN)` is the
 * literal `"NaN"`, which reaches the API as `?page=NaN` and fails Zod's
 * `z.coerce.number()`. `?page=0` and `?page=-3` fail its `.min(1)`. So a garbage
 * page number must become 1 here, not travel.
 *
 * **Empty strings.** `buildQuery` in the API client drops `undefined`, `null` AND
 * `""`, which is exactly right — the API rejects `?status=` with a 400. But it
 * means a filter must be `undefined` rather than `""` to mean "no filter", and a
 * `<form method="get">` submits every empty input as `""`. `optional()` below is
 * what turns one into the other.
 */

/**
 * A page number, floored at 1.
 *
 * Anything unparseable, zero or negative becomes 1 — a nonsense page in a URL
 * should show the first page, not an error. There is deliberately no upper clamp:
 * the total page count is not known until the API answers, and `?page=999` on a
 * short list correctly returns an empty page with honest pagination rather than
 * being silently rewritten to the last one.
 */
export function pageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return 1;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

/**
 * A filter value, or `undefined` when it is absent or blank.
 *
 * Repeated params (`?status=A&status=B`) take the first rather than joining them:
 * the API's filters are all single-valued, and `"A,B"` would match nothing while
 * looking like it should match both.
 */
export function optional(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * A filter constrained to a known set, or `undefined`.
 *
 * Used for enum-shaped filters the API would 400 on. That is a real difference
 * from the vendor app's order list, which passes `?status=` straight through
 * specifically to avoid keeping a second copy of the enum in the frontend — right
 * there, because a wrong value produces a 400 the admin caused by hand-editing a
 * URL.
 *
 * Here the same reasoning inverts for the screens that render a `<select>` of
 * statuses: the list is already in the frontend because the control needs it, so
 * validating against it costs nothing and turns a hand-mangled URL into "no
 * filter" instead of an error page. Use `optional()` where no such list exists.
 */
export function oneOf<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
): T | undefined {
  const raw = optional(value);
  if (raw === undefined) return undefined;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;
}

/**
 * Builds an href for a page of the current list, preserving every other filter.
 *
 * `page` is dropped when it is 1 so the first page has one canonical URL rather
 * than two — `/vendors` and `/vendors?page=1` being different strings is how a
 * "current page" comparison starts failing.
 */
export function hrefForPage(
  basePath: string,
  params: Record<string, string | undefined>,
  page: number,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page") continue;
    if (value !== undefined && value !== "") search.set(key, value);
  }
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/**
 * Copy for an empty list, distinguishing the three reasons a list can be empty.
 *
 * They look the same in the response — zero rows — and they need completely
 * different words, which is exactly the kind of thing that gets written once,
 * wrongly, and never revisited:
 *
 *   nothing exists yet     → explain how rows get created
 *   filters exclude it     → offer to clear them
 *   the page is past the end → say so, because the rows DO exist
 *
 * The third is the one that goes wrong. `?page=999` on a list with twelve vendors
 * returns zero rows and a `total` of twelve, and a naive empty state announces
 * "vendors appear here once someone applies" to an admin looking at a platform
 * full of vendors. That is not a cosmetic slip: it says the data is missing when
 * the data is fine, which is the same class of mistake as a transport failure
 * borrowing a 404's copy.
 *
 * `total` from `meta` is what separates them, so it must be passed in — the row
 * array alone cannot tell you.
 */
export function emptyCopy(opts: {
  filtered: boolean;
  /** `meta.total` — matching rows across ALL pages, not the current page's length. */
  total: number;
  page: number;
  /** Plural, lower case: "vendors", "orders". */
  noun: string;
  /** What to say when there is genuinely nothing, ever. */
  genuinelyEmpty: string;
}): { title: string; body: string } {
  if (opts.total > 0 && opts.page > 1) {
    return {
      title: `Page ${String(opts.page)} is past the end`,
      body: `There ${opts.total === 1 ? "is" : "are"} ${String(opts.total)} matching ${
        opts.total === 1 ? opts.noun.replace(/s$/, "") : opts.noun
      }, just not this far in. Go back to the first page.`,
    };
  }
  if (opts.filtered) {
    return {
      title: `No ${opts.noun} match`,
      body: "Nothing here with those filters. Clear them to see everything.",
    };
  }
  return { title: `No ${opts.noun} yet`, body: opts.genuinelyEmpty };
}
