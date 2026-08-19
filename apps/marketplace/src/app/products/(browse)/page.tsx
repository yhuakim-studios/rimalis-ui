import type { Metadata } from "next";
import { PackageSearch, SlidersHorizontal } from "lucide-react";
import { Container, Section } from "@/components/layout";
import { EmptyState, ErrorState } from "@/components/feedback";
import { FilterPanel, Pagination, ProductGrid, SortSelect } from "@/components/catalogue";
import { catalogue, publicCtx } from "@/lib/api";
import {
  PAGE_SIZE,
  buildCatalogueQuery,
  parseCatalogueParams,
  toApiQuery,
  type RawSearchParams,
} from "@/lib/search-params";

/**
 * The catalogue.
 *
 * ## `force-dynamic`, and why no `revalidate`
 *
 * `open-next.config.ts` is `defineCloudflareConfig({})`, so the adapter's
 * `incrementalCache` defaults to `"dummy"` — **any `revalidate` added now is a
 * silent no-op**. Adding one would look like caching and cache nothing, which is
 * worse than not caching, because the next person would trust it. Phase 8 creates
 * the R2 bucket, sets `incrementalCache`, and adds `revalidate` as one deliberate
 * change that can actually be verified with a cache HIT.
 *
 * ## Both requests, one `Promise.all`
 *
 * The categories are needed to resolve the URL's category *slug* into the *id* the
 * API wants, so the two look sequential. They are not: the listings request needs
 * the resolved id, but issuing them in parallel and doing the resolution after
 * both land costs one extra query on a filtered page and saves a full round trip
 * on every page. Against Supabase over the internet that round trip is ~200ms of
 * a shopper's time.
 *
 * The cost is that a category filter is applied in a second request — see below.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "All products",
  description: "Browse every product across every vendor on Rimalis.",
};

export default async function ProductsPage({
  searchParams,
}: {
  // In Next 16 `searchParams` is a PROMISE. Forgetting to await it does not always
  // error — it silently yields an object with no keys, so every filter quietly
  // stops applying and the page looks fine.
  searchParams: Promise<RawSearchParams>;
}) {
  const params = parseCatalogueParams(await searchParams);
  const ctx = publicCtx();

  // Fired together. `listCategories` is also what the filter panel renders, so
  // it is not an extra request made only for the slug lookup.
  const [categoriesResult, firstListings] = await Promise.all([
    catalogue.listCategories(ctx),
    catalogue.listListings(ctx, toApiQuery(params, [])),
  ]);

  // A failed category fetch must not take down the catalogue: the panel is
  // navigation, the grid is the product. Degrade to an empty panel.
  const categories = categoriesResult.ok ? categoriesResult.data : [];

  // The slug could only be resolved once the categories arrived, so a filtered
  // request is re-issued with the id. Unfiltered — the common case, and every
  // crawler — pays nothing for this.
  const query = toApiQuery(params, categories);
  const listings =
    query.categoryId === undefined ? firstListings : await catalogue.listListings(ctx, query);

  if (!listings.ok) {
    // An inline ErrorState rather than `throw` → error.tsx, so the header, the
    // filter panel and the shopper's search term all survive. Throwing would
    // replace the whole page for a failure in one section of it.
    return (
      <Section>
        <Container>
          <ErrorState error={listings.error} title="We couldn't load the catalogue" />
        </Container>
      </Section>
    );
  }

  const { data: items, meta } = listings;

  // `meta` is typed as present on this endpoint, but a defensive default keeps a
  // server-side envelope bug from crashing the pager rather than degrading it.
  const total = meta?.total ?? items.length;
  const pagination = meta ?? { page: params.page, limit: PAGE_SIZE, total, totalPages: 1 };

  const filtered =
    Boolean(params.q) ||
    Boolean(params.category) ||
    params.min !== undefined ||
    params.max !== undefined;

  return (
    <Container className="py-8 md:py-12">
      <header className="flex flex-col gap-2 pb-8">
        <h1 className="text-heading text-ink">
          {params.q ? `Results for "${params.q}"` : "All products"}
        </h1>
        <p className="text-body text-ink-muted">
          {/* The count is stated plainly. "Showing 1-24 of 137" is the single most
              useful sentence on a catalogue page and the one most often omitted. */}
          {total === 0
            ? "No matching products"
            : `${total} ${total === 1 ? "product" : "products"}${
                pagination.totalPages > 1 ? ` · page ${params.page} of ${pagination.totalPages}` : ""
              }`}
        </p>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        {/*
          The filter panel is a `<details>` on mobile and always-open from `lg`.
          A native disclosure rather than a JS drawer: it works before hydration,
          keyboard and screen-reader behaviour come free, and there is no focus
          trap to get wrong. `[&_summary]:hidden` at `lg` would be an arbitrary
          selector, so the two states are two elements instead — the duplication
          is nine lines and buys a dependency-free mobile filter.
        */}
        <details className="group rounded-card bg-surface p-4 shadow-card lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-body font-medium text-ink">
            <SlidersHorizontal className="size-5" strokeWidth={1.5} />
            Filters
          </summary>
          <div className="pt-6">
            <FilterPanel categories={categories} params={params} basePath="/products" />
          </div>
        </details>

        <div className="hidden w-64 shrink-0 lg:block">
          <FilterPanel categories={categories} params={params} basePath="/products" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <span className="text-caption text-ink-muted">
              {items.length > 0 && `Showing ${items.length} of ${total}`}
            </span>
            <div className="w-48">
              <SortSelect params={params} basePath="/products" />
            </div>
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={<PackageSearch className="size-7" strokeWidth={1.5} />}
              // The copy differs by cause, which is the whole reason an empty
              // state takes two props. "No products yet" on a filtered search is
              // misleading — there are products, just not these.
              title={filtered ? "No products match these filters" : "No products yet"}
              body={
                params.page > pagination.totalPages && total > 0
                  ? // Pluralised, because with 20 products at 24 per page this
                    // reads "There are only 1 pages" — and the single-page case
                    // is the common one on a filtered search, not an edge case.
                    pagination.totalPages === 1
                    ? "All the results fit on one page. Try starting from the beginning."
                    : `There are only ${pagination.totalPages} pages of results. Try starting from the first one.`
                  : filtered
                    ? "Try widening your price range, choosing a different category, or searching for something else."
                    : "Vendors are still setting up their stores. Check back shortly."
              }
              action={
                filtered
                  ? { label: "Clear filters and browse all", href: "/products" }
                  : undefined
              }
            />
          ) : (
            <>
              <ProductGrid listings={items} />
              <Pagination
                page={params.page}
                totalPages={pagination.totalPages}
                hrefForPage={(page) => `/products${buildCatalogueQuery({ ...params, page })}`}
              />
            </>
          )}
        </div>
      </div>
    </Container>
  );
}
