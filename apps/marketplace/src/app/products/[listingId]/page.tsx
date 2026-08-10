import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Store } from "lucide-react";
import { Container } from "@/components/layout";
import { ErrorState } from "@/components/feedback";
import { AttributeList, Gallery } from "@/components/catalogue";
import { Badge, ButtonLink } from "@/components/primitives";
import { AddToCartForm, SaveButton } from "@/components/cart";
import { catalogue, publicCtx } from "@/lib/api";
import { readWishlist } from "@/lib/wishlist";
import { formatMoney } from "@/lib/money";
import { availabilityOf, primaryImage } from "@/lib/listing";

/**
 * One listing.
 *
 * ## `[listingId]` is a LISTING id, not a product id
 *
 * The segment is named `listingId` rather than `id` on purpose. One product carried
 * by three vendors has one product id and three listing ids, so a product id here
 * cannot say whose price applies — and it 404s, which is the good outcome. The
 * bad one is a cart line built from it.
 *
 * ## Two different failures both mean not-found
 *
 * A well-formed id matching nothing is a **404**. A malformed one — `/products/x`,
 * a truncated link, a crawler guessing — is a **400** from the API's own
 * validation, before its service layer runs. To a shopper these are the same
 * event, so both call `notFound()`. `isNotFound()` in the API client holds that
 * rule so it is not re-derived per page.
 *
 * Crucially, a `network` or `timeout` failure is NOT either of those. A shopper
 * told "product not found" because Railway is mid-deploy concludes the product is
 * gone and does not come back; they get `<ErrorState>` and a retry instead. That
 * distinction is why `isNotFound()` checks `kind === "http"` first.
 */

export const dynamic = "force-dynamic";

/**
 * Metadata needs the listing, and so does the page — two fetches for one render.
 *
 * Accepted rather than worked around. Next dedupes identical `fetch` calls within
 * a render pass, but our client sets `x-request-id` per context and does not
 * currently opt into that cache, so this is genuinely a second request. The
 * alternative — a module-level memo keyed by id — is shared mutable state in a
 * Worker isolate serving concurrent users, which is the exact hazard documented on
 * `RequestContext.accessToken`. A second public GET is the cheaper mistake.
 * Phase 8 revisits it alongside the R2 cache, where `revalidate` makes it moot.
 *
 * ## ⚠️ THIS ROUTE MUST NOT HAVE A `loading.tsx`, AND NEITHER MAY ANY ANCESTOR
 *
 * A `loading.tsx` wraps its segment and every descendant in an implicit Suspense
 * boundary. That lets Next flush the shell as soon as it is ready, and **the HTTP
 * status is committed at that first flush**. A `notFound()` that resolves later
 * then renders the not-found UI inside a response already sent as **200**.
 *
 * That is a soft 404: a search engine reads the 200, keeps the dead URL indexed,
 * and goes on sending shoppers to it. Monitoring and link checkers see a healthy
 * page. It is invisible in a browser — the page looks exactly right, only the
 * status line is wrong.
 *
 * Which is why `/products` lives in a `(browse)` route group. Its own
 * `loading.tsx` used to sit at `products/`, where it wrapped this route too; the
 * group scopes that boundary to the catalogue without changing the URL. Do not
 * move `page.tsx` or `loading.tsx` back up a level — `products/(browse)/` exists
 * for this and nothing else.
 *
 * **Moving the not-found decision into `generateMetadata` does NOT fix it.** That
 * was the obvious theory and it is wrong; it was tested and the status stayed
 * 200. Next resolves metadata concurrently with the page rather than as a gate
 * before it, so with a boundary present there is no point in the pipeline where a
 * `notFound()` still precedes the flush. The call below is kept anyway — it is
 * correct, it is free, and it removes one way for a future edit to regress this —
 * but it is not the mechanism that produces the 404.
 *
 * The cost is that this route has no skeleton. The whole page depends on the one
 * fetch that decides whether it exists, so there is nothing to stream before that
 * answer, and no arrangement of Suspense recovers both. A correct status wins over
 * a skeleton on a page whose URLs a search engine will crawl.
 *
 * Found by asserting on status codes rather than on rendered copy: the walkthrough
 * checked `%{http_code}` and caught it, while every visual check had passed.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ listingId: string }>;
}): Promise<Metadata> {
  const { listingId } = await params;
  const result = await catalogue.getListing(publicCtx(), listingId);

  if (!result.ok) {
    // See above. A 404 or a malformed-id 400 both mean "nothing here".
    if (catalogue.isNotFound(result.error)) notFound();
    // A transport failure is NOT not-found — let the page render <ErrorState>
    // with a retry rather than telling a shopper the product is gone.
    return { title: "Product" };
  }

  const listing = result.data;
  const image = primaryImage(listing.product.images);

  return {
    title: `${listing.product.name} — ${listing.vendor.storeName}`,
    description:
      listing.product.description ??
      `${listing.product.name} from ${listing.vendor.storeName} on Rimalis.`,
    openGraph: {
      title: listing.product.name,
      // `images` may be empty — spread rather than index, so a product with no
      // photos produces no `images` key instead of `[undefined]`.
      ...(image ? { images: [{ url: image.url }] } : {}),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  // A Promise in Next 16. Awaiting it is not optional.
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  const [result, saved] = await Promise.all([
    catalogue.getListing(publicCtx(), listingId),
    // The saved-items cookie, so the heart renders in its true state in the
    // first byte rather than flipping after hydration.
    readWishlist(),
  ]);

  if (!result.ok) {
    // See the header: 404 and 400 both mean "no such thing at this URL", and a
    // transport failure means something else entirely.
    if (catalogue.isNotFound(result.error)) notFound();

    return (
      <Container className="py-8 md:py-12">
        <ErrorState error={result.error} title="We couldn't load this product" />
      </Container>
    );
  }

  const listing = result.data;
  const { product, vendor } = listing;
  const availability = availabilityOf(listing);

  return (
    <Container className="py-8 md:py-12">
      {/* A real breadcrumb trail, so a shopper arriving from a search engine can
          get to the category rather than only to the home page. */}
      <nav aria-label="Breadcrumb" className="pb-8">
        <ol className="flex flex-wrap items-center gap-2 text-caption text-ink-muted">
          <li>
            <Link href="/products" className="hover:text-ink">
              All products
            </Link>
          </li>
          {product.category && (
            <>
              <li aria-hidden>
                <ChevronRight className="size-4" strokeWidth={1.5} />
              </li>
              <li>
                <Link
                  href={`/products?category=${encodeURIComponent(product.category.slug)}`}
                  className="hover:text-ink"
                >
                  {product.category.name}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden>
            <ChevronRight className="size-4" strokeWidth={1.5} />
          </li>
          <li aria-current="page" className="text-ink">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
        <Gallery images={product.images} productName={product.name} />

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h1 className="text-heading text-ink">{product.name}</h1>

            <Link
              href={`/store/${encodeURIComponent(vendor.slug)}`}
              className="inline-flex min-h-11 w-fit items-center gap-2 text-body text-ink-muted transition-colors duration-150 ease-out-soft hover:text-ink"
            >
              <Store className="size-5" strokeWidth={1.5} />
              {/* Naming the vendor is load-bearing on a multi-vendor
                  marketplace: the price on this page belongs to THIS store, and
                  the same product is elsewhere at a different one. */}
              Sold by {vendor.storeName}
            </Link>
          </div>

          <div className="flex flex-col gap-2">
            {/* `effectivePrice`, never `basePrice` or `vendorPrice` — those are
                the inputs; this is the resolved answer. */}
            <p className="text-display text-ink">{formatMoney(listing.effectivePrice)}</p>

            {availability.kind === "out_of_stock" ? (
              <Badge tone="danger">Out of stock</Badge>
            ) : availability.kind === "low_stock" ? (
              <Badge tone="brand">Only {availability.available} left</Badge>
            ) : (
              <Badge tone="brand">In stock</Badge>
            )}
          </div>

          {/*
            `available` is derived here rather than inside the form, so the one
            place that knows how `effectiveStock` and `isActive` combine stays
            `lib/listing.ts`. The form takes a number and a ceiling; it does not
            re-derive availability and cannot disagree with the badge above it.
          */}
          <div className="flex flex-wrap items-start gap-3">
            <AddToCartForm
              listingId={listing.id}
              available={availability.kind === "out_of_stock" ? 0 : availability.available}
              productName={product.name}
            />
            <SaveButton
              listingId={listing.id}
              productName={product.name}
              saved={saved.includes(listing.id)}
            />
          </div>

          {product.description && (
            <section className="flex flex-col gap-3 border-t border-divider pt-6">
              <h2 className="text-caption font-semibold text-ink">Description</h2>
              {/* `whitespace-pre-line` so a vendor's line breaks survive.
                  NOT `dangerouslySetInnerHTML`: the description is
                  vendor-supplied text from a public API, and rendering it as
                  HTML would be stored XSS on every product page. */}
              <p className="whitespace-pre-line text-body text-ink-muted">
                {product.description}
              </p>
            </section>
          )}

          {/* Detail-only. `attributes` is absent from browse rows, which is why
              this page's DTO is `MarketplaceListingDetail`. */}
          <AttributeList attributes={product.attributes} />

          <dl className="flex flex-col gap-2 border-t border-divider pt-6">
            <div className="flex justify-between gap-4">
              <dt className="text-caption text-ink-muted">SKU</dt>
              <dd className="font-mono text-caption text-ink-subtle">{product.sku}</dd>
            </div>
          </dl>

          <ButtonLink href={`/store/${encodeURIComponent(vendor.slug)}`} variant="secondary" fullWidth>
            Visit {vendor.storeName}
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
