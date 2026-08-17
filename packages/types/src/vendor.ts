import type { VendorStatus } from "./auth";
import type { ListingProduct } from "./catalog";
import type { IsoDateTime, Money, Uuid } from "./common";
import type { Order, OrderItem } from "./commerce";

/**
 * The vendor-facing contract — a seller's own store, listings, orders and
 * settlements.
 *
 * Distinct from `catalog.ts`, which describes the same underlying rows as a
 * *shopper* sees them. The split is not cosmetic: a storefront listing exposes
 * `retailPrice` alone, while the vendor app also needs `costPrice` and
 * `ownedStock`, because what a vendor paid and how much they have left are
 * their business and nobody else's.
 *
 * ## These were transcribed from the API's CODE, not only its document
 *
 * Following the rule in `index.ts` — read the document, then check the
 * implementation — and it mattered again. Two shapes here disagree with
 * `openapi.json`:
 *
 * 1. **`VendorListing` embeds `product`.** The document's `VendorProduct`
 *    component is a bare listing row with no product at all, which would make
 *    the vendor's own product table unrenderable without an N+1 of lookups.
 *    `vendor-products.repository.ts` includes `product` — with its primary image
 *    and category — on every read path (`findById`, `findMany`, and each write's
 *    return). The type follows the repository.
 *
 * 2. **`PayoutSummary` is documented as an untyped `data`.** It is
 *    `{ lifetimeTotal, currency }` — see `getSummaryForVendor` in
 *    `payouts.service.ts`, which sums only `COMPLETED` rows.
 *
 * Both are documentation bugs in the API and worth fixing there; these types
 * describe what the endpoint actually returns today.
 */

// ---------------------------------------------------------------------------
// The vendor's own profile
// ---------------------------------------------------------------------------

/**
 * `GET /vendors/me` and `PATCH /vendors/me` — the seller's whole record.
 *
 * Wider than the public `VendorPublic`, because it carries the commercial and
 * compliance fields a vendor needs to see about themselves: their commission
 * rate, their settlement bank, and why their application is in whatever state
 * it is in.
 *
 * ⚠️ **`status` gates the entire app, and not with a 403.** A vendor may be
 * `PENDING` (applied, not yet reviewed), `SUSPENDED` (was trading, stopped by an
 * admin) or `REJECTED`, and each needs its own screen with its own explanation —
 * a generic "forbidden" tells a suspended seller nothing about whether their
 * money is safe or who to contact. `APPROVED` is the only status that may reach
 * the dashboard.
 */
export interface VendorProfile {
  id: Uuid;
  userId: Uuid;
  /** The storefront path segment — `/store/:slug` on the marketplace. */
  slug: string;
  storeName: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  status: VendorStatus;
  businessName: string | null;
  /** Nigerian company registration number. Optional; not verified by the API. */
  cacNumber: string | null;
  /**
   * The Paystack subaccount that receives this vendor's share.
   *
   * ⚠️ `null` **blocks checkout for every order containing this vendor's
   * items** — `payments.service.ts` refuses to build a split without it and
   * returns 409 `VENDOR_PAYOUT_NOT_CONFIGURED`. It is not an optional profile
   * nicety; a vendor with listings and no subaccount is invisible-ly unsellable,
   * so the UI must surface its absence loudly rather than as an empty field.
   */
  paystackSubaccountCode: string | null;
  /** Paystack bank code, e.g. `"058"` for GTBank. Not a bank name. */
  paystackSettlementBank: string | null;
  paystackAccountNumber: string | null;
  /**
   * A per-vendor override of the platform rate, as a fraction — `0.08` is 8%.
   *
   * `null` means the platform default applies (`PLATFORM_COMMISSION_RATE`, 10%).
   * A genuine `number` rather than `Money`: it is a rate, not an amount, and the
   * column is a `Float`. Only an admin can change it.
   */
  commissionRate: number | null;
  approvedAt: IsoDateTime | null;
  approvedById: Uuid | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/**
 * `POST /vendors/apply`.
 *
 * `storeName` is the only required field — an application is a request to be
 * reviewed, not a finished storefront, and demanding a CAC number up front turns
 * away the informal traders who are most of this market. Everything else can be
 * filled in from Settings once approved.
 */
export interface ApplyAsVendorBody {
  /** At least 2 characters. Becomes the storefront heading and seeds `slug`. */
  storeName: string;
  description?: string;
  businessName?: string;
  /** Nigerian company registration number. Not verified by the API. */
  cacNumber?: string;
  logoUrl?: string;
  bannerUrl?: string;
}

/** `PATCH /vendors/me`. Every field optional; send only what changed. */
export interface UpdateVendorProfileBody {
  storeName?: string;
  description?: string;
  businessName?: string;
  cacNumber?: string;
  /** Must be a URL inside our own Supabase bucket, or the API rejects it. */
  logoUrl?: string;
  bannerUrl?: string;
}

/**
 * `PATCH /vendors/me/payout-info` — all three together, or none.
 *
 * Not a partial update, and deliberately so: a subaccount code that belongs to
 * one bank account paired with a leftover account number from another is a
 * misrouted settlement, which is the most expensive kind of wrong this app can
 * be. The API takes the triple as a unit.
 */
export interface UpdatePayoutInfoBody {
  paystackSubaccountCode: string;
  paystackSettlementBank: string;
  paystackAccountNumber: string;
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

/**
 * One of this vendor's listings, from `GET /vendor/products`.
 *
 * ## There is one price, and the vendor does not set it
 *
 * `product.retailPrice` is what a shopper pays, and it is the same for every
 * vendor carrying the product. `product.costPrice` is what this vendor paid per
 * unit to stock it. The difference is their gross margin, and the platform's
 * commission comes out of that margin rather than off the top of the sale.
 *
 * A listing therefore has no price fields of its own and no price editor. What
 * a vendor controls is whether the listing is on, and how much stock they buy.
 *
 * ## Stock is owned, not shared
 *
 * `ownedStock` is real inventory this vendor paid for — not a ceiling over a
 * shared pool. It is the only number that limits what they can sell, and
 * `product.stock` (the platform's unsold remainder) has no bearing on it.
 *
 * **`ownedStock: 0` means sold out, not delisted.** The vendor still carries the
 * product; buying another batch tops this same listing back up. Rendering that
 * as "not listed" sends them to the catalogue to add a product they already
 * have. The seed ships one (`ANKR-PB-20K`) so the state is reachable.
 */
export interface VendorListing {
  /** The LISTING id. This is what `/products/[listingId]` uses on the storefront. */
  id: Uuid;
  vendorId: Uuid;
  /** The pool product id — needed to add a listing, never to identify one. */
  productId: Uuid;
  /** Units bought and not yet sold. `0` is sold out, not delisted. */
  ownedStock: number;
  /** Lifetime units bought, never decremented — for "sold 40 of the 50 you bought". */
  totalPurchased: number;
  /** The vendor's own on/off switch. `false` hides the listing from the marketplace. */
  isActive: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  /**
   * Soft delete. Non-null means removed but restorable via
   * `PATCH /vendor/products/:id/restore`, which is why a removed listing is
   * still worth rendering — behind `includeDeleted`.
   */
  deletedAt: IsoDateTime | null;
  /**
   * The pool product. Present on every vendor read path; see the module header
   * on why the OpenAPI document disagrees.
   *
   * ⚠️ `product.images` is **at most the primary image**, and may be `[]`.
   */
  product: ListingProduct;
}

/** `GET /vendor/products` */
export interface ListVendorListingsQuery {
  page?: number;
  limit?: number;
  /** Filter on the vendor's own switch. Omit for both. */
  isActive?: boolean;
  /** Include soft-deleted listings. Needed for any "restore" affordance. */
  includeDeleted?: boolean;
}

/**
 * `POST /vendor/stock-purchases` — buy inventory, which is how a listing is made.
 *
 * There is no `POST /vendor/products` any more. A vendor cannot conjure a
 * listing; they buy a quantity at the product's cost price and the listing is
 * created by the Paystack webhook when the payment settles. Buying a product
 * they already carry tops up the same listing rather than 409-ing.
 *
 * No price field, deliberately — the amount is `quantity × product.costPrice`,
 * computed server-side. A client-supplied amount would be a client-supplied
 * invoice.
 */
export interface InitiateStockPurchaseBody {
  productId: Uuid;
  /** Units to buy. 1–1000. */
  quantity: number;
  /**
   * Where Paystack returns the vendor. Defaults to the vendor app's purchase
   * page; supply one only if you need somewhere else.
   */
  callbackUrl?: string;
}

/** What `POST /vendor/stock-purchases` returns. Redirect to `authorizationUrl`. */
export interface StockPurchaseInit {
  stockPurchaseId: Uuid;
  reference: string;
  totalCost: Money;
  quantity: number;
  /** Send the vendor here to pay. */
  authorizationUrl: string;
  accessCode: string;
}

export type StockPurchaseStatus = "PENDING" | "SUCCESS" | "FAILED" | "ABANDONED";

/**
 * A vendor's inventory purchase — `GET /vendor/stock-purchases`.
 *
 * `PENDING` means the units are reserved out of the pool and Paystack has not
 * confirmed. It is **not** a failure: the return page should keep waiting
 * rather than offer a retry, because retrying reserves a second batch. An
 * abandoned purchase is swept after ~30 minutes and becomes `ABANDONED`, which
 * releases the reservation.
 */
export interface StockPurchase {
  id: Uuid;
  vendorId: Uuid;
  productId: Uuid;
  quantity: number;
  /** Snapshot of the cost price when the purchase opened. */
  unitCost: Money;
  totalCost: Money;
  currency: string;
  status: StockPurchaseStatus;
  reference: string;
  paidAt: IsoDateTime | null;
  /** The listing this created or topped up. `null` until the purchase succeeds. */
  vendorProductId: Uuid | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** `GET /vendor/stock-purchases` */
export interface ListStockPurchasesQuery {
  page?: number;
  limit?: number;
  status?: StockPurchaseStatus;
}

// ---------------------------------------------------------------------------
// Browsing the catalogue, to find something to list
// ---------------------------------------------------------------------------

/**
 * A pool product as the vendor choosing what to carry sees it —
 * `GET /vendor/products/catalogue`.
 *
 * The same `ListingProduct` shape the storefront uses, plus the caller's **own**
 * listing of it. Never another vendor's: a product carried by five vendors has
 * five `VendorProduct` rows, and four of them are competitors' prices.
 *
 * ## `listing` is context, and `ownedStock` is the state that matters
 *
 * Buying stock always does the same thing now — open a listing or top one up —
 * so `listing` no longer changes what the button does. What it changes is the
 * copy:
 *
 * | `listing`                       | Meaning        | Say |
 * |---------------------------------|----------------|-----|
 * | `null`                          | never carried  | "Buy stock" |
 * | `{ ownedStock: n > 0 }`         | in this store  | "In your store — n left. Buy more" |
 * | `{ ownedStock: 0 }`             | **sold out**   | "Sold out — buy more to keep selling" |
 * | `{ deletedAt: <date> }`         | removed        | "Removed — buying restores it" |
 *
 * The sold-out row is the one that bites. It is NOT "not carried": the vendor
 * has the listing and has sold through it. Presenting it as a fresh product
 * hides the fact that they had stock and it ran out.
 */
export interface CatalogueProduct extends ListingProduct {
  /** The CALLING vendor's listing, or `null` if they have never listed it. */
  listing: {
    /** The listing id — usable directly with `/products/[listingId]`. */
    id: Uuid;
    isActive: boolean;
    /** Units left. `0` is sold out, not "not carried". */
    ownedStock: number;
    /** Lifetime units bought through this listing. */
    totalPurchased: number;
    /** Non-null means removed; buying stock again revives this row. */
    deletedAt: IsoDateTime | null;
  } | null;
}

/** `GET /vendor/products/catalogue` */
export interface ListCatalogueQuery {
  page?: number;
  limit?: number;
  /** Matches `name` or `sku`, case-insensitive. */
  search?: string;
  categoryId?: Uuid;
  /**
   * Omit products this vendor already lists.
   *
   * Defaults to `false` on the API, and leaving it there is usually right: a
   * vendor who searches for something they already carry and finds nothing
   * concludes the catalogue does not have it. Removed listings are returned
   * either way, since re-adding one restores it.
   */
  excludeListed?: boolean;
}

/**
 * `PATCH /vendor/products/:id` — visibility, and nothing else.
 *
 * Price is the admin's and stock is whatever the vendor bought, so `isActive` is
 * the only field left. The old `vendorPrice: null` / `stockCap: null` "clears
 * the override" semantics — and the null-vs-undefined trap that came with them
 * — are gone with the columns.
 */
export interface UpdateVendorListingBody {
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

/**
 * The shipping destination as a vendor is allowed to see it.
 *
 * City, state and country only — `orders.repository.ts` selects exactly these
 * three on the vendor paths, on purpose. A vendor fulfilling one line of a
 * multi-vendor order has no need for the shopper's street address, and the API
 * does not send it. Do not design a packing-slip UI around a full address; it is
 * not on the wire.
 */
export interface VendorOrderAddress {
  city: string;
  state: string;
  country: string;
}

/**
 * An order as it appears to one vendor, from `GET /vendor/orders`.
 *
 * ## `items` is filtered to this vendor, and totals are NOT
 *
 * `items` contains only this vendor's lines — the repository filters on
 * `vendorId`, so another seller's lines are absent rather than redacted. But
 * `subtotal`, `grandTotal` and the rest are the **whole order's** figures,
 * inherited from `Order`.
 *
 * So on a two-vendor order, `grandTotal` includes money that belongs to somebody
 * else. **Never show `grandTotal` to a vendor as their revenue.** Sum
 * `items[].vendorPayout` for what they earn, or `items[].totalPrice` for what
 * their goods sold for.
 *
 * ## There is no customer name
 *
 * `customerId` is a uuid and nothing more; the API embeds no user object on this
 * path. A vendor order row can identify the destination (city/state) and the
 * order, not the person. Any UI that wants a name is asking for an endpoint that
 * does not exist.
 */
export interface VendorOrder extends Order {
  /** Only this vendor's lines. Never empty — the query requires at least one. */
  items: OrderItem[];
  /** Coarse destination, or `null` if the shopper deleted the address. */
  address: VendorOrderAddress | null;
}

/**
 * `GET /vendor/orders/:id`. Same scoping as the list.
 *
 * A 404 means "no such order **containing your items**", which is
 * indistinguishable from a nonexistent one by design — a 403 would confirm that
 * an id belongs to some other vendor.
 */
export type VendorOrderDetail = VendorOrder;

/** `GET /vendor/orders`. `status` filters the ORDER's status, not the item's. */
export interface ListVendorOrdersQuery {
  page?: number;
  limit?: number;
  /** e.g. `"PAID"` — the actionable state for a vendor. */
  status?: Order["status"];
}

/**
 * `PATCH /vendor/orders/:orderId/items/:itemId` — advance one line.
 *
 * `PENDING` is absent from the union deliberately: fulfilment moves forward
 * only. There is no un-ship, and a vendor who shipped the wrong thing needs a
 * human, not a state transition.
 *
 * The response is the whole order, because advancing one line can change the
 * order's rolled-up `status` — the last line reaching `SHIPPED` makes the order
 * `SHIPPED`. Re-render from the response rather than patching the row in place.
 */
export interface AdvanceFulfillmentBody {
  fulfillmentStatus: "PROCESSING" | "SHIPPED" | "DELIVERED";
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

/**
 * Settlement status.
 *
 * A union here, but a bare `String` column in the database with these four
 * values in a comment — there is no Prisma enum behind it. So treat an
 * unrecognised value as possible rather than impossible: narrow with a lookup
 * that has a fallback, not with an exhaustive `switch` that assumes.
 */
export type PayoutStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

/**
 * One settlement record, from `GET /vendor/payouts`.
 *
 * ⚠️ **A payout is a ledger entry, not a transfer this app performs.** Paystack
 * splits each charge at payment time and money reaches the vendor's subaccount
 * directly; these rows are written after the fact by `markSuccess()` so there is
 * something to reconcile against. Nothing in the API triggers a payout, and the
 * vendor-facing endpoints are read-only by design — a "request payout" button
 * would be a double-pay waiting to happen.
 */
export interface PayoutRecord {
  id: Uuid;
  vendorId: Uuid;
  amount: Money;
  /** Always `"NGN"` today; the column has a default rather than a constraint. */
  currency: string;
  status: PayoutStatus | string;
  /** The Paystack transfer reference. Unique, and what support will ask for. */
  reference: string;
  /** Raw provider response. Debug material — do not render it to a vendor. */
  providerPayload: unknown | null;
  periodStart: IsoDateTime;
  periodEnd: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** `GET /vendor/payouts`. `from`/`to` are ISO dates filtering on the period. */
export interface ListPayoutsQuery {
  page?: number;
  limit?: number;
  status?: PayoutStatus;
  from?: string;
  to?: string;
}

/**
 * `GET /vendor/payouts/summary`.
 *
 * ⚠️ `lifetimeTotal` counts **`COMPLETED` rows only**. Anything still `PENDING`
 * or `PROCESSING` is excluded, so this is "settled to date" and not "earned to
 * date" — labelling it "total earnings" overstates it on any account with an
 * in-flight transfer. For earned-but-unsettled, sum `vendorPayout` across order
 * items; there is no endpoint that does it for you.
 */
export interface PayoutSummary {
  lifetimeTotal: Money;
  currency: string;
}
