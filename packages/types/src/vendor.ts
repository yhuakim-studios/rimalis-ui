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
 * `effectivePrice` and hides `vendorPrice`, while the vendor app needs both,
 * because "what I set" and "what is charged" differ whenever `vendorPrice` is
 * null and the product's `basePrice` is standing in.
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
 * ## The three prices, and which is which
 *
 * - `vendorPrice` — what this vendor set. **`null` is normal**, and means "use
 *   the pool price"; it is not missing data.
 * - `product.basePrice` — the catalogue price, set by an admin.
 * - `effectivePrice` — what a shopper is actually charged. Computed by the API
 *   as `vendorPrice ?? product.basePrice`, and guarded by a database trigger
 *   (migration `guard_effective_price_direct_writes`) so it cannot be written
 *   directly.
 *
 * A price editor must therefore show `effectivePrice` as the live number while
 * editing `vendorPrice`, and must distinguish "inheriting ₦280,000" from
 * "overridden to ₦280,000" — clearing an override is a different action from
 * setting the same figure, and only one of them tracks future catalogue changes.
 *
 * ## Stock
 *
 * `stockCap` is a per-vendor ceiling, not an inventory count. Real availability
 * is `min(stockCap ?? ∞, product.stock)`, because `product.stock` is the shared
 * pool every vendor draws from. A cap above the pool is legal and does nothing
 * — the seed ships one (`SAMS-A54`, cap 20 against stock 50) so the UI's
 * handling of it is reachable.
 */
export interface VendorListing {
  /** The LISTING id. This is what `/products/[listingId]` uses on the storefront. */
  id: Uuid;
  vendorId: Uuid;
  /** The pool product id — needed to add a listing, never to identify one. */
  productId: Uuid;
  /** This vendor's override, or `null` to inherit `product.basePrice`. */
  vendorPrice: Money | null;
  /** Per-vendor ceiling, or `null` for "no cap beyond the shared pool". */
  stockCap: number | null;
  /** Derived and trigger-guarded: `vendorPrice ?? product.basePrice`. Read-only. */
  effectivePrice: Money;
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
 * `POST /vendor/products` — put a pool product in this store.
 *
 * `productId` is the **product**, not a listing. One vendor may list a given
 * product once; a second attempt is a 409.
 */
export interface CreateVendorListingBody {
  productId: Uuid;
  /** Omit to inherit the catalogue's `basePrice`. A number, not a `Money` string. */
  vendorPrice?: number;
  stockCap?: number;
}

/**
 * `PATCH /vendor/products/:id`.
 *
 * ⚠️ `vendorPrice: null` **clears the override** and returns the listing to the
 * pool price. That is a different outcome from omitting the field, which leaves
 * it untouched — so a form that sends `null` for an untouched empty input will
 * silently wipe a price the vendor set. `undefined` and `null` are not
 * interchangeable on this endpoint.
 */
export interface UpdateVendorListingBody {
  vendorPrice?: number | null;
  stockCap?: number | null;
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
