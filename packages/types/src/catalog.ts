import type { IsoDateTime, Money, Uuid } from "./common";

/**
 * The public catalogue: categories, products, listings and storefronts.
 *
 * ## The one thing to get right about this module
 *
 * A **product** is an admin-curated catalogue entry. A **listing**
 * (`vendorProduct`) is one vendor offering that product. Marketplace endpoints
 * return LISTINGS, so the same product carried by three vendors appears three
 * times, at three prices. That is the domain model's whole point.
 *
 * Which means: `MarketplaceListing.id` is the id you use everywhere — in the URL
 * of a detail page, in a cart line, in a checkout item. `product.id` is not, and
 * confusing the two produces a 404 at best and the wrong vendor's price at
 * worst. Both fields are commented to that effect below because the mistake is
 * one character wide.
 */

export interface Category {
  id: Uuid;
  name: string;
  slug: string;
  description: string | null;
  /**
   * `null` for a top-level category.
   *
   * `GET /marketplace/categories` returns a FLAT array and guarantees the set is
   * connected — every ancestor of every returned category is included — so a
   * client can build the tree from this field without ever holding a child whose
   * parent is missing. See `buildCategoryTree()` in the app.
   */
  parentId: Uuid | null;
  createdAt: IsoDateTime;
}

export interface ProductImage {
  id: Uuid;
  productId: Uuid;
  /** Public Supabase Storage URL. Always inside the platform's own bucket. */
  url: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: IsoDateTime;
}

export interface ProductAttribute {
  id: Uuid;
  productId: Uuid;
  /** e.g. `"Colour"` */
  name: string;
  /** e.g. `"Midnight Black"` */
  value: string;
}

export type ProductStatus = "DRAFT" | "AVAILABLE" | "UNAVAILABLE";

/** The category fields embedded in a listing — narrower than `Category`. */
export interface CategorySummary {
  id: Uuid;
  name: string;
  slug: string;
}

/** The vendor fields embedded in a listing — narrower than `VendorPublic`. */
export interface VendorSummary {
  id: Uuid;
  slug: string;
  storeName: string;
  logoUrl: string | null;
}

/**
 * The pool product as it appears inside a listing.
 *
 * `retailPrice` IS the price to display — one admin-set price per product,
 * identical for every vendor carrying it. There is no per-vendor override any
 * more, so nothing has to be resolved before rendering.
 *
 * The operational fields are still on the wire because the API returns the
 * whole row. **Do not render `costPrice`, `stock`, `lowStockAt`,
 * `lowStockAlertedAt` or `status`.** `costPrice` in particular is what vendors
 * pay the platform — showing a shopper the wholesale price of what they are
 * buying is not a feature. `stock` is the platform's unsold remainder, not what
 * this vendor can sell; that is `MarketplaceListing.ownedStock`.
 */
export interface ListingProduct {
  /** ⚠️ NOT the id for a detail page or a cart line. See `MarketplaceListing.id`. */
  id: Uuid;
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  /** What the shopper pays. Set by an admin; the same for every vendor. */
  retailPrice: Money;
  /**
   * ⚠️ What VENDORS pay the platform per unit. Never render this to a shopper.
   *
   * It is on the wire because the marketplace and the vendor catalogue share
   * one product shape. Treat it as internal.
   */
  costPrice: Money;
  /** The PLATFORM's unsold remainder. Display `ownedStock` instead. */
  stock: number;
  lowStockAt: number;
  lowStockAlertedAt: IsoDateTime | null;
  /**
   * Always `"AVAILABLE"` on a publicly visible listing — the API filters the
   * other two out. Kept because the field is on the wire, but branching on it
   * in storefront code is dead code that reads as a guard.
   */
  status: ProductStatus;
  categoryId: Uuid | null;
  weightGrams: number | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
  /**
   * ⚠️ **May be empty.** On browse rows this is at most the primary image —
   * *at most*, not exactly one: a product with no images yields `[]`. On detail
   * it is the full gallery ordered by `sortOrder`.
   *
   * So `images[0].url` is never safe. `noUncheckedIndexedAccess` is on in this
   * repo and will force the guard, which is the point. The API seed carries a
   * product with no images (SKU `LOGI-MXK-BLK`) so the empty path is reachable
   * without editing the database.
   */
  images: ProductImage[];
  category: CategorySummary | null;
}

/**
 * A browse row from `GET /marketplace/products` or `GET /store/:slug/products`.
 *
 * Smaller than the detail row — see `MarketplaceListingDetail`.
 */
export interface MarketplaceListing {
  /**
   * **The listing id.** This is the value that goes in `/products/[listingId]`,
   * in a cart line, and as `vendorProductId` on a checkout item.
   *
   * ⚠️ It is NOT `product.id`. One product carried by three vendors has three
   * listing ids and one product id, so `product.id` cannot identify what the
   * shopper chose or whose price applies.
   */
  id: Uuid;
  vendorId: Uuid;
  productId: Uuid;
  /** Always `true` on a publicly visible listing; the API filters the rest out. */
  isActive: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
  /**
   * What this vendor can actually sell — units they bought and still hold.
   *
   * **Can be 0 on a visible listing** — sold-out listings are returned, not
   * hidden, so a shopper can see the product exists and that this seller is out.
   * Every add-to-cart path has to handle it, and the seed carries such a
   * listing (`ANKR-PB-20K`).
   *
   * A real column, so unlike the `effectiveStock` it replaces it is sortable
   * and filterable.
   */
  ownedStock: number;
  /** Lifetime units this vendor has bought. Vendor-facing; not for the storefront. */
  totalPurchased: number;
  product: ListingProduct;
  vendor: VendorSummary;
}

/**
 * `GET /marketplace/products/:id`. Two fields more than a browse row.
 *
 * The API returns one JSON shape for both endpoints, so the difference is easy
 * to miss and impossible to notice at runtime without a check: reading
 * `product.attributes` off a browse row yields `undefined`, which renders as an
 * empty specification table rather than as an error. Modelling them as two types
 * makes the compiler catch it instead.
 */
export interface MarketplaceListingDetail extends MarketplaceListing {
  product: ListingProduct & {
    /** Detail endpoint ONLY. Absent from browse rows. May be empty. */
    attributes: ProductAttribute[];
  };
}

/** `GET /store/:slug` — a public storefront. No payout fields, by construction. */
export interface VendorPublic {
  id: Uuid;
  slug: string;
  storeName: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  createdAt: IsoDateTime;
}

/**
 * `data` from `GET /store/:slug/products` — a wrapper, not a bare array.
 *
 * The shape exists so a storefront page renders its header and its grid from one
 * request. `meta` is still on the envelope alongside it and describes `items`.
 */
export interface StorefrontListings {
  vendor: VendorSummary;
  items: MarketplaceListing[];
}

/** The three values `sort` accepts. Anything else is a 400. */
export type ListingSort = "newest" | "price_asc" | "price_desc";

/**
 * Query parameters for `GET /marketplace/products` and
 * `GET /store/:slug/products`, in the API's own names.
 *
 * The URL uses shorter names (`q`, `category`, `min`, `max`); the translation
 * lives in exactly one place, `lib/search-params.ts`.
 */
export interface ListListingsQuery {
  page?: number;
  /** 1–100. Out of range is a **400, not a clamp**. */
  limit?: number;
  categoryId?: Uuid;
  search?: string;
  /**
   * ⚠️ Must be **strictly greater than 0** — the API declares
   * `exclusiveMinimum: 0`, so `minPrice=0` is a 400, not "no minimum". A
   * shopper typing 0 into a min-price box must produce an omitted parameter.
   */
  minPrice?: number;
  maxPrice?: number;
  sort?: ListingSort;
}
