import "server-only";

import type { ApiError } from "@rimalis/api-client";
import { catalogue, publicCtx } from "./api";
import { formatMoney } from "./money";
import { availabilityOf, imageAlt, primaryImage } from "./listing";

/**
 * Everything the home page renders, from two API requests.
 *
 * ## Why the shaping happens here and not in the components
 *
 * The six home-page sections are `"use client"` — they have carousels, hover
 * state and pagination dots. Client components cannot call the API: under the BFF
 * (ADR-0003) only server code may, and `lib/api.ts` is `server-only` so trying is
 * a build error rather than a production CORS failure.
 *
 * So the components became presentational — they take props — and this module is
 * what fills them. That split has three payoffs beyond just working:
 *
 * 1. **The RSC payload stays small.** A `MarketplaceListing` carries the whole
 *    pool product: `lowStockAt`, `lowStockAlertedAt`, `weightGrams`, `deletedAt`,
 *    every image row. Passing six of those to the browser ships several KB of
 *    fields nothing renders. The view models below carry only what is drawn.
 * 2. **Money is formatted on the server.** `parseMoney` throws on a malformed
 *    amount, and a throw during a server render lands in `error.tsx` with a
 *    request id. The same throw inside a client component after hydration is an
 *    unstyled crash. It also keeps `Intl.NumberFormat` out of the bundle.
 * 3. **The listing-id-vs-product-id trap is closed once.** `listingId` is the
 *    only id in the view model, so a component physically cannot link to
 *    `product.id` — the mistake that 404s, or worse silently picks a vendor.
 *
 * ## Two requests, not five
 *
 * `listListings` at `limit: 100` returns the whole visible catalogue (20 listings
 * today), and categories, store counts and per-category cover images are all
 * derived from that one response rather than fetched again. `listCategories` is
 * the second call, needed because a category with no *imaged* product still has
 * to appear with its real name.
 *
 * If the catalogue outgrows one page this needs revisiting — a `limit` that
 * silently truncates would make the counts wrong rather than absent. `truncated`
 * below is how that surfaces instead of hiding.
 */

/** A product tile. Pre-formatted; the components do no derivation. */
export interface ProductCardView {
  /** ⚠️ The LISTING id — the value `/products/[listingId]` and the cart both want. */
  listingId: string;
  name: string;
  /** Already formatted, e.g. `"₦37,000.00"`. Never a number. */
  price: string;
  imageUrl: string | null;
  /** Never `""` — a product photo in a grid is not decorative. */
  imageAlt: string;
  storeName: string;
  storeSlug: string;
  /** Units remaining, but only when low enough to be worth saying. */
  lowStock: number | null;
  outOfStock: boolean;
}

export interface CategoryView {
  slug: string;
  name: string;
  /**
   * A cover image, taken from a real product in this category rather than from a
   * hand-maintained slug→file map.
   *
   * This is deliberate. A static map has to be edited every time the admin adds a
   * category, and until someone does, the new category renders a broken `<Image
   * src>` — a 404 in the network tab and an empty circle on the page. Deriving it
   * means a category always looks right the moment it has a product, and
   * `null` (→ an icon tile) is a designed state rather than a broken one.
   */
  imageUrl: string | null;
  /** Visible listings in this category. Zero-product categories are dropped. */
  productCount: number;
  /** Depth in the category tree; 0 is top level. */
  depth: number;
}

export interface StoreView {
  slug: string;
  storeName: string;
  productCount: number;
  imageUrl: string | null;
}

export interface HomeData {
  trending: ProductCardView[];
  categories: CategoryView[];
  stores: StoreView[];
  /**
   * Set when the catalogue request failed. The page renders `<ErrorState>` for the
   * data-driven sections and still shows the static ones — a home page that 500s
   * because one query timed out is the worst available first impression.
   */
  error: ApiError | null;
  /** True if the catalogue no longer fits one request, so the counts understate. */
  truncated: boolean;
}

/** How many tiles the trending row shows. Six fills its 2/3/6-column grid exactly. */
const TRENDING_COUNT = 6;

/** One page big enough for the whole visible catalogue. The API caps `limit` at 100. */
const CATALOGUE_LIMIT = 100;

const EMPTY: HomeData = {
  trending: [],
  categories: [],
  stores: [],
  error: null,
  truncated: false,
};

export async function loadHomeData(): Promise<HomeData> {
  const ctx = publicCtx();

  // In parallel: one is not derivable from the other, and sequencing them would
  // add a full Supabase round trip to every home-page render.
  const [listings, categories] = await Promise.all([
    catalogue.listListings(ctx, { limit: CATALOGUE_LIMIT, sort: "newest" }),
    catalogue.listCategories(ctx),
  ]);

  if (!listings.ok) return { ...EMPTY, error: listings.error };

  const items = listings.data;
  const total = listings.meta?.total ?? items.length;

  // ---------------------------------------------------------------------------
  // Trending — the newest listings, which is what the API's default sort gives.
  // ---------------------------------------------------------------------------
  const trending: ProductCardView[] = items.slice(0, TRENDING_COUNT).map((listing) => {
    const image = primaryImage(listing.product.images);
    const availability = availabilityOf(listing);

    return {
      listingId: listing.id,
      name: listing.product.name,
      // `effectivePrice`, never `basePrice` or `vendorPrice`. Those are the two
      // inputs to a price; this is the resolved answer, and it is what the
      // customer is charged.
      price: formatMoney(listing.effectivePrice),
      imageUrl: image?.url ?? null,
      imageAlt: imageAlt(image, listing.product.name),
      storeName: listing.vendor.storeName,
      storeSlug: listing.vendor.slug,
      lowStock: availability.kind === "low_stock" ? availability.available : null,
      outOfStock: availability.kind === "out_of_stock",
    };
  });

  // ---------------------------------------------------------------------------
  // Categories — real names and counts, with a cover image borrowed from a
  // product. Ordered by the API's own list so parents precede children.
  // ---------------------------------------------------------------------------
  const covers = new Map<string, string>();
  const counts = new Map<string, number>();
  for (const listing of items) {
    const slug = listing.product.category?.slug;
    if (!slug) continue;
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
    if (!covers.has(slug)) {
      const url = primaryImage(listing.product.images)?.url;
      if (url) covers.set(slug, url);
    }
  }

  const categoryList = categories.ok ? categories.data : [];
  const depthOf = (parentId: string | null): number => {
    // The API guarantees the returned set is connected — every ancestor of every
    // returned category is present — so this walk always terminates at a root.
    // See `buildCategoryTree`, which documents why that guarantee exists.
    let depth = 0;
    let current = parentId;
    const byId = new Map(categoryList.map((c) => [c.id, c]));
    while (current) {
      depth += 1;
      current = byId.get(current)?.parentId ?? null;
    }
    return depth;
  };

  const categoryViews: CategoryView[] = categoryList
    // A category with nothing in it links to an empty page, which is a worse
    // experience than not offering it. The API already excludes categories with
    // no visible listings, but it also returns their ANCESTORS to keep the tree
    // connected, and an ancestor can legitimately hold zero listings of its own.
    .filter((category) => (counts.get(category.slug) ?? 0) > 0)
    .map((category) => ({
      slug: category.slug,
      name: category.name,
      imageUrl: covers.get(category.slug) ?? null,
      productCount: counts.get(category.slug) ?? 0,
      depth: depthOf(category.parentId),
    }));

  // ---------------------------------------------------------------------------
  // Stores — one entry per vendor with visible listings.
  // ---------------------------------------------------------------------------
  const storeMap = new Map<string, StoreView>();
  for (const listing of items) {
    const existing = storeMap.get(listing.vendor.slug);
    if (existing) {
      existing.productCount += 1;
      existing.imageUrl ??= primaryImage(listing.product.images)?.url ?? null;
      continue;
    }
    storeMap.set(listing.vendor.slug, {
      slug: listing.vendor.slug,
      storeName: listing.vendor.storeName,
      productCount: 1,
      // The vendor's own `logoUrl` would be better, but browse rows carry it as
      // `null` for every seeded vendor, so a product photo is the honest choice
      // over an empty tile.
      imageUrl: primaryImage(listing.product.images)?.url ?? null,
    });
  }

  return {
    trending,
    categories: categoryViews,
    stores: [...storeMap.values()].sort((a, b) => b.productCount - a.productCount),
    error: null,
    truncated: total > items.length,
  };
}
