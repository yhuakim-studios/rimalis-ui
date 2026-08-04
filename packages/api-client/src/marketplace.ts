import type {
  Category,
  ListListingsQuery,
  MarketplaceListing,
  MarketplaceListingDetail,
  PaginationMeta,
  StorefrontListings,
  VendorPublic,
} from "@digistore/types";
import { request, type RequestContext } from "./http";
import type { Result } from "./result";

/**
 * The public catalogue endpoints. No authentication anywhere in this file.
 *
 * Each function is a thin, typed description of one endpoint — the transport
 * rules all live in `http.ts`. What earns its place here is the *shape*: which
 * `TData` and `TMeta` each endpoint actually returns, since three of the five
 * are not what a reader would guess from the endpoint name.
 */

/**
 * `GET /marketplace/products` — the main catalogue.
 *
 * One row per LISTING, so a product carried by three vendors appears three
 * times at three prices.
 *
 * Note the return type: browse rows are `MarketplaceListing`, **not**
 * `MarketplaceListingDetail`. They carry at most the primary image and no
 * `product.attributes`.
 *
 * A page past the end is a **success with an empty array**, not a 404 — render
 * an empty state. `meta.total` still reports the real total, which is what lets
 * a pager show "no results on page 999 of 7" honestly.
 */
export const listListings = (
  ctx: RequestContext,
  query: ListListingsQuery = {},
): Promise<Result<MarketplaceListing[], PaginationMeta>> =>
  request({ ...ctx, path: "/marketplace/products", query: { ...query } });

/**
 * `GET /marketplace/products/:id` — one listing, with gallery and attributes.
 *
 * `id` is a **listing** id (`MarketplaceListing.id`), not a product id.
 *
 * ⚠️ **Two different failures mean "not found" to a shopper.** A well-formed id
 * matching nothing is a `404`; a malformed id is a `400` from the API's own
 * validation, before the service runs. A page routing on a URL segment must
 * treat both as not-found — `isNotFound()` below exists so that check is written
 * once rather than remembered at each call site.
 */
export const getListing = (
  ctx: RequestContext,
  id: string,
): Promise<Result<MarketplaceListingDetail>> =>
  request({ ...ctx, path: `/marketplace/products/${encodeURIComponent(id)}` });

/**
 * `GET /marketplace/categories` — a FLAT array, not paginated and not nested.
 *
 * Returns only categories with at least one publicly visible listing, **plus
 * every ancestor of those**, so the set is guaranteed connected: no category is
 * returned whose `parentId` points at something absent. That guarantee is what
 * lets `buildCategoryTree()` be a simple two-pass function rather than one that
 * has to reparent orphans.
 */
export const listCategories = (ctx: RequestContext): Promise<Result<Category[]>> =>
  request({ ...ctx, path: "/marketplace/categories" });

/**
 * `GET /store/:slug` — a public storefront.
 *
 * Only APPROVED vendors are visible. A pending, rejected or suspended store is a
 * `404` rather than a `403`, because the existence of an unapproved application
 * is not public information. So a 404 here does not mean the slug is wrong.
 *
 * `slug` is singular — `/store/`, never `/stores/`. The API hardcodes this path
 * into transactional emails off its own `APP_URL`, so it is a shipped contract
 * with links already in customers' inboxes.
 */
export const getStorefront = (
  ctx: RequestContext,
  slug: string,
): Promise<Result<VendorPublic>> =>
  request({ ...ctx, path: `/store/${encodeURIComponent(slug)}` });

/**
 * `GET /store/:slug/products` — one storefront's listings.
 *
 * ⚠️ `data` is `{ vendor, items }`, **not** a bare array, while `meta` is normal
 * pagination over `items`. The wrapper exists so a storefront page renders its
 * header and its grid from one request — so prefer this over calling
 * `getStorefront` and `listListings` separately.
 *
 * It carries `VendorSummary` rather than the fuller `VendorPublic`, so a page
 * needing `description` or `bannerUrl` does still need `getStorefront`.
 */
export const listStorefrontListings = (
  ctx: RequestContext,
  slug: string,
  query: ListListingsQuery = {},
): Promise<Result<StorefrontListings, PaginationMeta>> =>
  request({
    ...ctx,
    path: `/store/${encodeURIComponent(slug)}/products`,
    query: { ...query },
  });

/**
 * Whether an error should render a not-found page.
 *
 * Both a 404 and a 400-on-a-malformed-id mean the same thing to a shopper: the
 * thing at this URL does not exist. Only a `kind: "http"` error qualifies — a
 * `network` or `timeout` failure must never be reported as not-found, because a
 * shopper told a product is gone when the API is mid-deploy concludes it is gone
 * and leaves.
 */
export const isNotFound = (error: { kind: string; status: number }): boolean =>
  error.kind === "http" && (error.status === 404 || error.status === 400);
