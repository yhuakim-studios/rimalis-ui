import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PackageSearch, Store } from "lucide-react";
import { Container } from "@/components/layout";
import { EmptyState, ErrorState } from "@/components/feedback";
import { Pagination, ProductGrid, SortSelect } from "@/components/catalogue";
import { catalogue, publicCtx } from "@/lib/api";
import { PAGE_SIZE, parseCatalogueParams, toApiQuery, type RawSearchParams } from "@/lib/search-params";

/**
 * A vendor's storefront.
 *
 * ## `/store/` is SINGULAR, and that is a shipped contract
 *
 * Not a style choice. `digistore-api`'s notification templates hardcode
 * `${APP_URL}/store/:slug` when they build transactional emails, so this path is
 * already in customers' inboxes. Pluralising it breaks every one of those links
 * retroactively, and nothing in either codebase would fail a build to tell you.
 *
 * ## One request, not two
 *
 * `GET /store/:slug/products` returns `data: { vendor, items }` — a wrapper rather
 * than a bare array, precisely so the header and the grid come from one round
 * trip. (The OpenAPI document described this as a bare array until it was fixed;
 * see the note in `packages/types/src/index.ts`.)
 *
 * The second request here is for `getStorefront`, and it is not redundant: the
 * embedded `vendor` is a `VendorSummary` with only id/slug/storeName/logoUrl,
 * while the page's header wants `description` and `bannerUrl`. They run in
 * parallel, and a failure of the fuller one degrades the header rather than the
 * page.
 *
 * ## A suspended vendor is a 404, not a 403
 *
 * The API returns "Store not found" for pending, rejected and suspended vendors
 * alike, because the existence of an unapproved application is not public
 * information. So a 404 here does not imply the slug is wrong — which is why the
 * not-found copy avoids saying so.
 */

export const dynamic = "force-dynamic";

/**
 * ⚠️ **DO NOT ADD A `loading.tsx` TO THIS ROUTE OR TO `store/`.**
 *
 * This route returns a correct 404 for an unknown or unapproved slug precisely
 * because no Suspense boundary sits at or above it. Add one and every store 404
 * silently becomes a 200 with not-found content — a soft 404, invisible in a
 * browser and wrong for every crawler and link checker. See the long note in
 * `products/[listingId]/page.tsx`, which is the route that had the bug and the
 * comparison that found it.
 *
 * If a skeleton is wanted for `/store/:slug` later, the boundary has to go *below*
 * the fetch that decides whether the store exists — a `<Suspense>` around the
 * product grid inside the page, never a `loading.tsx` for the route.
 *
 * `notFound()` is called here as well as in the page. It does not set the status
 * on its own (tested — Next resolves metadata concurrently with the page, not as a
 * gate before it), but it is correct and costs nothing.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await catalogue.getStorefront(publicCtx(), slug);
  if (!result.ok) {
    if (catalogue.isNotFound(result.error)) notFound();
    return { title: "Store" };
  }

  return {
    title: result.data.storeName,
    description:
      result.data.description ?? `Shop ${result.data.storeName} on Digistore.`,
  };
}

export default async function StorePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  // Both are Promises in Next 16, and both are awaited together rather than in
  // sequence — they resolve independently.
  const [{ slug }, rawSearch] = await Promise.all([params, searchParams]);
  const catalogueParams = parseCatalogueParams(rawSearch);
  const ctx = publicCtx();

  // The category filter is not offered on a storefront (a single vendor's
  // catalogue is small enough to browse), so no slug→id resolution is needed and
  // there is no second listings request.
  const [storefront, listings] = await Promise.all([
    catalogue.getStorefront(ctx, slug),
    catalogue.listStorefrontListings(ctx, slug, toApiQuery(catalogueParams, [])),
  ]);

  // The listings request is the one that decides whether this page exists — it
  // 404s on an unknown or unapproved slug just as `getStorefront` does, and it is
  // the request the page cannot render without.
  if (!listings.ok) {
    if (catalogue.isNotFound(listings.error)) notFound();
    return (
      <Container className="py-8 md:py-12">
        <ErrorState error={listings.error} title="We couldn't load this store" />
      </Container>
    );
  }

  const { vendor, items } = listings.data;
  // Falls back to the embedded summary, so a failure of the fuller request costs
  // the description and banner rather than the page.
  const profile = storefront.ok ? storefront.data : null;
  const basePath = `/store/${encodeURIComponent(slug)}`;

  const total = listings.meta?.total ?? items.length;
  const pagination =
    listings.meta ?? { page: catalogueParams.page, limit: PAGE_SIZE, total, totalPages: 1 };

  return (
    <>
      {profile?.bannerUrl && (
        <div className="relative h-40 w-full bg-canvas md:h-56">
          <Image
            src={profile.bannerUrl}
            // Decorative: the store name is a heading immediately below, so
            // describing the banner would repeat it. This is the case `alt=""`
            // exists for.
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        </div>
      )}

      <Container className="py-8 md:py-12">
        <header className="flex flex-col gap-4 pb-8">
          <div className="flex items-center gap-4">
            {vendor.logoUrl ? (
              <Image
                src={vendor.logoUrl}
                alt={`${vendor.storeName} logo`}
                width={64}
                height={64}
                className="size-16 shrink-0 rounded-input object-cover"
              />
            ) : (
              <span
                className="grid size-16 shrink-0 place-items-center rounded-input bg-brand-50 text-brand-700"
                aria-hidden
              >
                <Store className="size-7" strokeWidth={1.5} />
              </span>
            )}

            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-heading text-ink">{vendor.storeName}</h1>
              <p className="text-caption text-ink-muted">
                {total === 0
                  ? "No products listed"
                  : `${total} ${total === 1 ? "product" : "products"}`}
              </p>
            </div>
          </div>

          {profile?.description && (
            <p className="max-w-2xl text-body text-ink-muted">{profile.description}</p>
          )}
        </header>

        <div className="flex flex-col gap-6">
          {items.length > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-caption text-ink-muted">
                Showing {items.length} of {total}
              </span>
              <div className="w-48">
                <SortSelect params={catalogueParams} basePath={basePath} />
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <EmptyState
              icon={<PackageSearch className="size-7" strokeWidth={1.5} />}
              title={
                catalogueParams.q
                  ? `Nothing here matches "${catalogueParams.q}"`
                  : "This store has no products yet"
              }
              body={
                catalogueParams.q
                  ? `${vendor.storeName} may carry it under another name, or it may be listed by a different vendor.`
                  : `${vendor.storeName} hasn't listed anything for sale yet. There is plenty elsewhere on Digistore.`
              }
              action={{ label: "Browse all products", href: "/products" }}
            />
          ) : (
            <>
              <ProductGrid listings={items} />
              <Pagination meta={pagination} params={catalogueParams} basePath={basePath} />
            </>
          )}
        </div>
      </Container>
    </>
  );
}
