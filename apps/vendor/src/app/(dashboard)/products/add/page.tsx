import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, PackageSearch, Search } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/feedback";
import { CatalogueCard } from "@/components/products";
import { Card, Input, Pagination, Select } from "@/components/primitives";
import { categories as categoriesApi, ctxFor, requireApprovedVendor, vendor as vendorApi } from "@/lib/auth";
import { pluralise } from "@/lib/format";

export const metadata: Metadata = { title: "Add a product" };

const PAGE_SIZE = 20;

/**
 * Guards a hand-edited `?category=`.
 *
 * The API validates `categoryId` as a uuid and answers 400, which would surface as
 * "something went wrong" for a URL the vendor probably did not type. Dropping an
 * unparseable value shows the unfiltered catalogue instead — the filter is lost,
 * which is visible, rather than the page breaking, which is not explicable.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Browse the Rimalis catalogue and pick something to sell.
 *
 * ## Why this screen exists, and why it is not "create a product"
 *
 * A vendor cannot author a product. `POST /vendor/products` takes a `productId`
 * from the **admin-curated pool** and creates a *listing* — the vendor's price and
 * stock cap against a product somebody else defined. That is the domain model, not
 * a limitation of this screen: `Product` carries the SKU, description, images and
 * shared stock, and `VendorProduct` carries what one seller does with it.
 *
 * So the missing piece was never a form. It was a way to find a `productId`, and
 * until `GET /vendor/products/catalogue` existed there was none — `GET
 * /admin/products` is `requireRole("ADMIN")`, and the marketplace endpoints return
 * *listings*, so a product nobody carries yet is invisible on them. Which is
 * precisely the product a vendor wants to find.
 *
 * ## The filters are `GET` form submissions, not client state
 *
 * The search box and the category select submit to this same route as a plain
 * `GET`, so the query lives in the URL. Three things fall out for free: a filtered
 * catalogue is a shareable link, the browser Back button steps through searches,
 * and the whole page stays a Server Component with no fetch-on-type, no debounce,
 * and no loading spinner. The cost is a round trip per search, which for a
 * catalogue this size is cheaper than shipping a search index to the client.
 *
 * `page` is deliberately NOT carried into a new search — a vendor on page 3 who
 * searches for "macbook" wants the first page of results, and preserving the
 * offset would show them an empty page and no explanation.
 *
 * ## "Hide what I already sell" defaults to OFF
 *
 * Tempting to default it on, since the point of the screen is finding something
 * new. But a vendor who searches for a product they already carry and gets nothing
 * concludes the catalogue does not have it, and goes to support. Present-and-marked
 * is the honest answer; `CatalogueCard` renders "In your store" with a link to the
 * listing.
 */
export default async function AddProductPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string; hide?: string }>;
}) {
  const { q, category, page: pageParam, hide } = await searchParams;
  const { session } = await requireApprovedVendor("/products/add");
  const ctx = ctxFor(session);

  const parsed = Number.parseInt(pageParam ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;

  const search = q?.trim();
  const excludeListed = hide === "1";

  const [result, categoriesResult] = await Promise.all([
    vendorApi.browseCatalogue(ctx, {
      page,
      limit: PAGE_SIZE,
      ...(search ? { search } : {}),
      // An invalid uuid is a 400 from the API's own validator, so a hand-edited
      // `?category=nonsense` must not be forwarded as though it were a filter.
      ...(category && UUID.test(category) ? { categoryId: category } : {}),
      ...(excludeListed ? { excludeListed: true } : {}),
    }),
    // Non-blocking: a failed category list costs the dropdown, not the page. The
    // search box and the results are what this screen is for.
    categoriesApi.listAll(ctx),
  ]);

  const hrefForPage = (target: number) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (category) query.set("category", category);
    if (excludeListed) query.set("hide", "1");
    if (target > 1) query.set("page", String(target));
    const suffix = query.toString();
    return suffix ? `/products/add?${suffix}` : "/products/add";
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link
          href="/products"
          prefetch={false}
          className="inline-flex w-fit items-center gap-1.5 text-meta text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden />
          Your products
        </Link>
        <h1 className="text-heading font-semibold tracking-tight">Add a product</h1>
        <p className="text-caption text-ink-muted">
          Choose from the Rimalis catalogue and set your own price. Rimalis adds the products;
          you decide which ones you sell and for how much.
        </p>
      </div>

      {/*
        One `GET` form for all three controls, so they submit together — a category
        chosen while a search is open must not discard the search. `page` is absent
        on purpose; see the header.
      */}
      <Card padding="lg" className="flex flex-col gap-3">
        <form method="GET" className="flex flex-col gap-3">
          <Input
            label="Search the catalogue"
            name="q"
            type="search"
            defaultValue={search ?? ""}
            placeholder="Product name or SKU"
            hint="Matches names and SKUs. Leave empty to see everything."
          />

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            {categoriesResult.ok ? (
              <Select label="Category" name="category" defaultValue={category ?? ""}>
                <option value="">All categories</option>
                {categoriesResult.data.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            ) : (
              // The list failed; the search box still works. Saying so beats a
              // dropdown that is silently missing.
              <p className="text-meta text-ink-subtle">
                Categories couldn&apos;t be loaded just now — search by name or SKU instead.
              </p>
            )}

            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-input bg-brand-600 px-4 text-caption font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <Search className="size-4" strokeWidth={1.75} aria-hidden />
              Search
            </button>
          </div>

          <label className="flex items-center gap-2 text-meta text-ink-muted">
            <input
              type="checkbox"
              name="hide"
              value="1"
              defaultChecked={excludeListed}
              className="size-4 rounded border-divider-strong accent-brand-600"
            />
            Hide products already in my store
          </label>
        </form>

        {(search || category || excludeListed) && (
          <Link
            href="/products/add"
            prefetch={false}
            className="w-fit text-meta font-medium text-ink underline decoration-divider-strong underline-offset-4"
          >
            Clear filters
          </Link>
        )}
      </Card>

      {!result.ok ? (
        <Card padding="lg">
          <ErrorState error={result.error} title="We couldn't load the catalogue" />
        </Card>
      ) : result.data.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<PackageSearch className="size-6" strokeWidth={1.5} />}
            title={search || category ? "Nothing matched" : "The catalogue is empty"}
            body={
              search || category
                ? "Try a shorter search, or clear the filters to see everything Rimalis stocks."
                : excludeListed
                  ? "You already list everything in the catalogue. New products appear here as Rimalis adds them."
                  : "Rimalis hasn't published any products yet. They'll appear here when it does."
            }
            {...(search || category || excludeListed
              ? { action: { label: "Clear filters", href: "/products/add" } }
              : {})}
          />
        </Card>
      ) : (
        <>
          <p className="text-meta text-ink-subtle">
            {pluralise(result.meta.total, "product")}
            {excludeListed && " you don't yet sell"}
          </p>

          <ul className="flex flex-col gap-3">
            {result.data.map((product) => (
              <CatalogueCard key={product.id} product={product} />
            ))}
          </ul>

          <Pagination
            page={result.meta.page}
            totalPages={result.meta.totalPages}
            hrefForPage={hrefForPage}
          />
        </>
      )}
    </div>
  );
}
