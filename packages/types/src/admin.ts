/**
 * The administrative surface: the product pool, user and vendor administration,
 * the taxonomy, the commission ladder, and the ledger.
 *
 * Transcribed from `rimalis-api/openapi.json` and checked against live responses,
 * the same way as every other file here — and the same class of gap turned up
 * again, so three of them are called out on the types below: `GET /vendors/:id`
 * carries no `user` where the list rows do, `PATCH /vendors/:id/reject` accepts
 * no body despite a schema existing for one, and a pool product's `images` array
 * can be empty on a row the list says is publishable.
 *
 * ## Three things that bite once, here and nowhere else in this package
 *
 * **1. Money is asymmetric.** It comes OUT as a decimal string (`Money`) and goes
 * IN as a JSON number. Every other DTO in this package is read-only, so this is
 * the first place it matters: `CreatePoolProductBody.retailPrice` is a `number`
 * while `PoolProduct.retailPrice` is a `Money`. Do not "tidy" them into one type.
 *
 * **2. `costPrice` is admin-only and this is the file that publishes it.** It is
 * what vendors pay the platform, and since `retailPrice` is public and identical
 * for every vendor, exposing cost exposes every vendor's exact gross margin. It
 * is on `PoolProduct` because `/admin/products` returns it. **Never reuse these
 * types in a marketplace component** — `ListingProduct` and `MarketplaceListing`
 * in `catalog.ts` exist for that, and they carry the same warning.
 *
 * **3. Commission rates are FRACTIONS.** `0.08` is 8%. `commissionRateOverride`
 * being `null` does not mean "the platform default" — it means "the referral
 * ladder decides", which is a different number for every vendor. Render a
 * percentage, send a fraction, and say which on screen.
 */

import type { IsoDateTime, Money, PaginationMeta, Uuid } from "./common";
import type { User, UserRole, VendorStatus } from "./auth";
import type {
  CategorySummary,
  ProductAttribute,
  ProductImage,
  ProductStatus,
} from "./catalog";
import type { Order, OrderItem, Payment } from "./commerce";
import type { Address } from "./auth";
import type { PayoutRecord, StockPurchase, VendorProfile } from "./vendor";

// ---------------------------------------------------------------------------
// THE PRODUCT POOL — /admin/products
// ---------------------------------------------------------------------------

/**
 * A product in the central pool, as an admin sees it.
 *
 * The admin's view is the whole row, including the three fields the public
 * shapes deliberately hide: `costPrice`, `stock` and `lowStockAt`.
 *
 * `stock` here is the PLATFORM's unsold pool — units no vendor has bought yet.
 * It is not what any vendor can sell (that is `ownedStock` on their listing) and
 * a sale never decrements it. It moves only on a stock purchase or on an explicit
 * admin adjustment.
 */
export interface PoolProduct {
  id: Uuid;
  /** Unique across the catalogue. Immutable after creation — `PATCH` rejects it. */
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  /** What shoppers pay. One price per product, shared by every vendor listing it. */
  retailPrice: Money;
  /**
   * What a VENDOR pays the platform per unit to take stock out of the pool.
   *
   * The spread between this and `retailPrice` is the vendor's gross margin, and
   * commission is charged on that margin — so this field, set here, decides
   * whether carrying this product is profitable for a seller at all. The API
   * rejects `costPrice >= retailPrice`.
   */
  costPrice: Money;
  /** The platform's unsold pool. NOT a vendor's sellable quantity. */
  stock: number;
  /** Per-product alert threshold. `stock <= lowStockAt` is "low", not a global number. */
  lowStockAt: number;
  /** When the last low-stock alert fired. Alerts fire on CROSSING, not on every write. */
  lowStockAlertedAt: IsoDateTime | null;
  status: ProductStatus;
  categoryId: Uuid | null;
  weightGrams: number | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  /** Soft delete. A deleted product is excluded unless `includeDeleted` is set. */
  deletedAt: IsoDateTime | null;
}

/**
 * A row in `GET /admin/products`.
 *
 * ⚠️ **`images` may be EMPTY**, even for a product the list shows as AVAILABLE.
 * The repository takes only the primary image (`take: 1`), and a product can be
 * created and published-attempted without one — `PATCH /:id/publish` is what
 * enforces "at least one image", and it returns `NO_IMAGES` rather than the list
 * hiding the row. Render a placeholder; do not index `images[0]` blind.
 */
export interface PoolProductRow extends PoolProduct {
  /** The primary image only, and possibly none at all. */
  images: ProductImage[];
  category: CategorySummary | null;
}

/** `GET /admin/products/:id` — every image in `sortOrder`, plus attributes. */
export interface PoolProductDetail extends PoolProduct {
  /** All images, ordered by `sortOrder` ascending. May be empty. */
  images: ProductImage[];
  attributes: ProductAttribute[];
  /**
   * The create and update responses return a fuller `Category` here than the
   * list does. `CategorySummary` is the safe common subset — widen it only if a
   * screen actually needs `description` or `parentId`, and check the response
   * first.
   */
  category: CategorySummary | null;
}

export interface ListPoolProductsQuery {
  page?: number;
  limit?: number;
  status?: ProductStatus;
  categoryId?: Uuid;
  /** Substring match on name and SKU. */
  search?: string;
  /**
   * Include soft-deleted products.
   *
   * Send the STRING `"true"`/`"false"`, not a JS boolean coerced by string
   * interpolation — the API parses the token (`booleanQueryParam`), and an empty
   * value is a 400 rather than "false". The client handles this; the note is here
   * because a hand-built query string will not.
   */
  includeDeleted?: boolean;
}

/**
 * `POST /admin/products`.
 *
 * ⚠️ **Money goes in as a NUMBER here**, unlike everywhere it comes out. See the
 * module header.
 *
 * Created as `DRAFT` and invisible to vendors until published. The slug is
 * generated from the name. `costPrice` must be strictly less than `retailPrice`
 * — the API refuses otherwise, because a product where cost meets retail leaves
 * a vendor paying commission on a sale that made them nothing.
 */
export interface CreatePoolProductBody {
  sku: string;
  name: string;
  description?: string;
  /** Naira, as a JSON number. */
  retailPrice: number;
  /** Naira, as a JSON number. Must be < `retailPrice`. */
  costPrice: number;
  /** Initial pool quantity. Defaults to 0 — a product with no stock is legitimate. */
  stock?: number;
  lowStockAt?: number;
  categoryId?: Uuid;
  weightGrams?: number;
}

/**
 * `PATCH /admin/products/:id`.
 *
 * `sku` and `stock` are absent on purpose, and the API rejects both. SKU is an
 * identity other rows have snapshotted; stock moves only through
 * `POST /:id/stock/adjust`, which demands a reason and writes an audit entry.
 *
 * `categoryId: null` clears the category. Omitting it leaves it unchanged — the
 * distinction is real, and an empty `<select>` must send nothing rather than
 * `""`.
 */
export type UpdatePoolProductBody = Partial<
  // `categoryId` is omitted here and redeclared below. An intersection would NOT
  // widen it: `{ categoryId?: Uuid } & { categoryId?: Uuid | null }` resolves to
  // `Uuid | undefined`, because an intersection narrows. So `null` — the value that
  // clears the category — would be unassignable, and the mistake reads as correct.
  Omit<CreatePoolProductBody, "sku" | "stock" | "categoryId">
> & {
  /** `null` clears the category. Omitting it leaves the current one unchanged. */
  categoryId?: Uuid | null;
};

/**
 * `POST /admin/products/:id/stock/adjust` — a signed DELTA, never an absolute.
 *
 * A delta rather than "set stock to N" because two admins reading the same stale
 * page and both setting 100 lose one of the adjustments silently, whereas two
 * deltas of +50 both land. `delta` must be non-zero; a negative delta below
 * current stock returns `INSUFFICIENT_STOCK`.
 *
 * `reason` is REQUIRED and is recorded in the audit trail against the acting
 * admin. Say so on the form — this is the field that answers "why is there 40
 * less stock than the purchase orders say" six months later.
 */
export interface AdjustStockBody {
  delta: number;
  reason: string;
}

// ---------------------------------------------------------------------------
// PRODUCT IMAGES — the three-step upload
// ---------------------------------------------------------------------------

/**
 * Step 1: `POST /admin/products/:id/images/upload-url`.
 *
 * SVG is deliberately absent from the allowed types. An SVG is a script
 * container, and these images are served from the platform's own origin.
 */
export interface CreateImageUploadUrlBody {
  /** Used for its extension only. The object path is generated server-side. */
  fileName: string;
  contentType: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
}

/**
 * A signed ticket to upload one object, safe to hand the browser.
 *
 * It authorises writing exactly one server-chosen path and expires. Step 2 is a
 * cross-origin `PUT` of the raw bytes straight to Supabase Storage — the bytes
 * must never pass through the BFF, which is why this indirection exists at all.
 * Step 3 sends `publicUrl` back as `AddProductImageBody.url`.
 */
export interface ImageUploadTicket {
  /** PUT the bytes here. */
  uploadUrl: string;
  token: string;
  /** Server-generated, `<productId>/<uuid>.<ext>`. Never built from `fileName`. */
  path: string;
  /** Send this back in step 3. */
  publicUrl: string;
  contentType: string;
  expiresInSeconds: number;
}

/**
 * Step 3: `POST /admin/products/:id/images`.
 *
 * The URL must be inside the platform's own Storage bucket or the API returns
 * `IMAGE_URL_NOT_OWNED`. Pasting an image address from another site is therefore
 * not a shortcut — it is a 400.
 *
 * `isPrimary: true` demotes whichever image was primary before.
 */
export interface AddProductImageBody {
  url: string;
  altText?: string;
  isPrimary?: boolean;
  sortOrder?: number;
}

export type UpdateProductImageBody = Omit<AddProductImageBody, "url">;

export interface AddProductAttributeBody {
  /** e.g. `"Colour"` */
  name: string;
  /** e.g. `"Midnight Black"` */
  value: string;
}

// ---------------------------------------------------------------------------
// USERS — /users, admin scope
// ---------------------------------------------------------------------------

export interface ListUsersQuery {
  page?: number;
  limit?: number;
  role?: UserRole;
  /** Substring match on email, first name and last name. */
  search?: string;
  isActive?: boolean;
  /**
   * Confirmed their email, or not.
   *
   * `isVerified: false` is the usual explanation for "I registered but cannot
   * sign in", so this is the filter a support screen wants first.
   */
  isVerified?: boolean;
}

/**
 * `PATCH /users/:id/role`.
 *
 * ⚠️ The API refuses to let an admin change their OWN role, with a 400. That
 * guard is what stops the last remaining admin demoting themselves and locking
 * everyone out of the console permanently. Do not render the control on your own
 * user, and say why rather than letting the click fail.
 *
 * Promoting a user to `VENDOR` does NOT create a vendor record — they still have
 * to apply. Demoting a vendor does not delete theirs.
 */
export interface UpdateUserRoleBody {
  role: UserRole;
}

/**
 * `PATCH /users/:id/suspend`.
 *
 * The reason is recorded in the audit trail. Suspension sets `isActive: false`,
 * which blocks a new login and blocks refresh — but an access token already
 * issued keeps working until it expires, up to 15 minutes. Worth saying on the
 * confirmation, because "I suspended them and they were still ordering" is
 * otherwise a bug report.
 */
export interface SuspendUserBody {
  reason?: string;
}

// ---------------------------------------------------------------------------
// VENDORS — /vendors, admin scope
// ---------------------------------------------------------------------------

/** A row in `GET /vendors` — the profile plus the owning user. */
export interface AdminVendorRow extends VendorProfile {
  user: {
    id: Uuid;
    email: string;
    firstName: string;
    lastName: string;
  };
}

/**
 * `GET /vendors/:id`.
 *
 * ⚠️ **No `user` object, unlike the list rows.** The repository's `findById` does
 * not include the relation, so a detail screen reached by deep link has the
 * vendor's store but not the owner's email. Fetch it separately with
 * `GET /users/:id` using `VendorProfile.userId` — the two calls parallelise.
 */
export type AdminVendorDetail = VendorProfile;

export interface ListAdminVendorsQuery {
  page?: number;
  limit?: number;
  status?: VendorStatus;
  /** Substring match on store name, business name, and the owner's email. */
  search?: string;
}

/**
 * `PATCH /vendors/:id/suspend`.
 *
 * Unlike rejection, suspension takes a reason — and it is enforced live: the
 * API's `requireVendor` guard reads vendor status from the database on every
 * request, so a suspended vendor's open dashboard starts failing on their next
 * navigation rather than at their next login.
 */
export interface SuspendVendorBody {
  reason?: string;
}

/**
 * `PATCH /vendors/:id/commission-rate`.
 *
 * A FRACTION: `0.08` is 8%. Show the admin a percentage and convert.
 *
 * ⚠️ `null` does not mean "the platform default". It clears the override and
 * hands the decision back to the referral ladder, which resolves to a different
 * rate per vendor depending on how many recruits they have qualified. Setting a
 * value beats the ladder outright and forever, until cleared.
 *
 * Applies to FUTURE orders only. Every existing `OrderItem` snapshotted its rate
 * at checkout, precisely so historical commission stays auditable.
 */
export interface SetCommissionRateBody {
  commissionRateOverride: number | null;
}

// ---------------------------------------------------------------------------
// ORDERS — /admin/orders, read-only
// ---------------------------------------------------------------------------

/**
 * A row in `GET /admin/orders`.
 *
 * `items` is EVERY vendor's lines, unfiltered — unlike `VendorOrder`, where the
 * API strips other vendors' lines before responding. And unlike `VendorOrder`,
 * `grandTotal` here really is the whole order rather than one vendor's slice, so
 * the per-vendor caveat that applies in the vendor app does not apply on these
 * screens.
 */
export interface AdminOrderRow extends Order {
  items: OrderItem[];
  customer: {
    id: Uuid;
    email: string;
    firstName: string;
    lastName: string;
  };
}

/** `GET /admin/orders/:id` — the row plus payment and the full delivery address. */
export interface AdminOrderDetail extends AdminOrderRow {
  payment: Payment | null;
  address: Address | null;
}

/**
 * `GET /admin/orders` query.
 *
 * `from`, `to`, `vendorId` and `search` are honoured on the ADMIN route only.
 * They are declared on a schema the customer and vendor order lists share, and
 * those two ignore them deliberately — a vendor-scoped search over customer
 * emails would be a lookup tool over the whole customer base.
 */
export interface ListAdminOrdersQuery {
  page?: number;
  limit?: number;
  status?: Order["status"];
  /** `createdAt >=`, ISO 8601. */
  from?: string;
  /** `createdAt <=`, ISO 8601. */
  to?: string;
  /** Orders containing at least one line from this vendor. */
  vendorId?: Uuid;
  /** Case-insensitive substring on the Paystack reference or the customer's email. */
  search?: string;
}

// ---------------------------------------------------------------------------
// PAYOUTS — /admin/payouts, read-only BY DESIGN
//
// There is no write DTO in this section and none may be added. Paystack splits
// each charge across vendor subaccounts at payment time, so the money has already
// moved before a Payout row exists — the row RECORDS a settlement, it does not
// cause one. A "trigger payout" body would pay every vendor twice.
// ---------------------------------------------------------------------------

/** A row in `GET /admin/payouts` — the ledger entry plus which store it settled. */
export interface AdminPayoutRow extends PayoutRecord {
  vendor: {
    id: Uuid;
    slug: string;
    storeName: string;
  };
}

/** `GET /admin/payouts/:id`. Same shape as a row — the detail adds nothing. */
export type AdminPayoutDetail = AdminPayoutRow;

export interface ListAdminPayoutsQuery {
  page?: number;
  limit?: number;
  /** Free-text against `Payout.status`. In practice rows are written COMPLETED. */
  status?: string;
  /** `periodStart >=`, ISO 8601. */
  from?: string;
  /** `periodEnd <=`, ISO 8601. */
  to?: string;
  /** Admin route only — the vendor route takes its scope from the session. */
  vendorId?: Uuid;
}

// ---------------------------------------------------------------------------
// STOCK PURCHASES — /admin/stock-purchases, read-only
// ---------------------------------------------------------------------------

/**
 * A row in `GET /admin/stock-purchases`.
 *
 * These rows ARE the platform's prepaid revenue: a vendor paying to take units
 * out of the pool. `GET /admin/stats` reports the total under
 * `revenue.wholesaleCollected`; this is where an individual payment lives.
 *
 * PENDING rows matter operationally, not just historically — a pending purchase
 * is HOLDING a reservation against `PoolProduct.stock`, so a product that looks
 * out of stock may have units parked behind an unfinished checkout.
 *
 * Read-only: a purchase is opened by the vendor and completed by the Paystack
 * webhook. Marking one paid by hand would credit stock nobody paid for.
 */
export interface AdminStockPurchaseRow extends StockPurchase {
  vendor: {
    id: Uuid;
    slug: string;
    storeName: string;
  };
  product: {
    id: Uuid;
    name: string;
    sku: string;
  };
}

export type AdminStockPurchaseDetail = AdminStockPurchaseRow;

export interface ListAdminStockPurchasesQuery {
  page?: number;
  limit?: number;
  status?: StockPurchase["status"];
  vendorId?: Uuid;
  productId?: Uuid;
  /** `createdAt >=`, ISO 8601. */
  from?: string;
  /** `createdAt <=`, ISO 8601. */
  to?: string;
}

// ---------------------------------------------------------------------------
// TAXONOMY — /categories, admin writes
// ---------------------------------------------------------------------------

export interface CreateCategoryBody {
  name: string;
  description?: string;
  /** Omit for a top-level category. */
  parentId?: Uuid;
}

/**
 * `PATCH /categories/:id`.
 *
 * `parentId: null` promotes the category to the top level. Omitting it leaves the
 * parent unchanged — so an empty `<select>` must send nothing, not `""`.
 *
 * Re-parenting a category under one of its own descendants returns
 * `CATEGORY_CYCLE`.
 */
export interface UpdateCategoryBody {
  name?: string;
  description?: string;
  parentId?: Uuid | null;
}

// ---------------------------------------------------------------------------
// THE COMMISSION LADDER — /admin/commission-tiers
//
// The list is NOT here: `GET /commission-tiers` is mounted behind `authenticate`
// alone and returns every rung including inactive ones, so an admin token reads
// it directly. Only the writes are admin-gated.
// ---------------------------------------------------------------------------

/**
 * `POST /admin/commission-tiers`.
 *
 * `rate` is a FRACTION. The ladder must stay monotonic — a rung with more
 * required referrals may not charge more commission than one with fewer, or the
 * API returns `NON_MONOTONIC_COMMISSION_LADDER`. Two rungs at the same
 * `minReferrals` are `AMBIGUOUS_COMMISSION_LADDER`.
 *
 * Changes are never retroactive: `OrderItem.commissionRate` was snapshotted at
 * checkout.
 */
export interface CreateCommissionTierBody {
  /** Display order. Unique — a duplicate is `COMMISSION_TIER_LEVEL_TAKEN`. */
  level: number;
  name: string;
  /** Qualified recruits needed to reach this rung. */
  minReferrals: number;
  /** Fraction, not a percentage: `0.08` is 8%. */
  rate: number;
  isActive?: boolean;
}

/**
 * `PATCH /admin/commission-tiers/:id`. An empty body is a 400.
 *
 * Prefer `isActive: false` over `DELETE`. Deleting the last active rung returns
 * `COMMISSION_LADDER_WOULD_BE_EMPTY`, and deactivating keeps the row for anyone
 * auditing a historical rate.
 */
export type UpdateCommissionTierBody = Partial<CreateCommissionTierBody>;

// ---------------------------------------------------------------------------
// THE AUDIT TRAIL — /admin/audit-logs
// ---------------------------------------------------------------------------

/**
 * The audited actions this API writes today.
 *
 * Deliberately widened with `| string` wherever it is used. The column is a
 * `String`, not a Postgres enum, specifically so adding an audited action costs
 * no migration — which means a value this union does not know about is a normal
 * occurrence and must not be a compile error or a blank cell.
 */
export type AuditActionValue =
  | "user.suspended"
  | "user.reactivated"
  | "user.role_changed"
  | "vendor.approved"
  | "vendor.rejected"
  | "vendor.suspended"
  | "vendor.reinstated"
  | "vendor.commission_overridden"
  | "product.stock_adjusted"
  | "stock.purchased";

/** A closed set — a sixth value would mean a new model. */
export type AuditTargetTypeValue =
  | "USER"
  | "VENDOR"
  | "PRODUCT"
  | "ORDER"
  | "STOCK_PURCHASE";

/**
 * One entry in the append-only administrative trail.
 *
 * ⚠️ **`targetType`/`targetId` are polymorphic with no foreign key**, on purpose:
 * the log has to outlive what it describes. So the target is not joined, and it
 * may no longer exist. Hydrate a row the user clicks through `/users/:id`,
 * `/vendors/:id`, `/admin/products/:id` or `/admin/orders/:id`, and tolerate a
 * 404 there.
 *
 * `actor` is the admin who acted — except for `stock.purchased`, whose actor is
 * the vendor's own user, because they initiated the purchase.
 */
export interface AuditLogEntry {
  id: Uuid;
  actorId: Uuid;
  /** `<entity>.<past-tense verb>`. Open vocabulary — render unknown values. */
  action: AuditActionValue | string;
  targetType: AuditTargetTypeValue | string;
  targetId: Uuid;
  /** The reason the acting admin gave, where the endpoint takes one. */
  reason: string | null;
  /** Before/after values, or anything action-specific. Shape varies by action. */
  metadata: unknown;
  createdAt: IsoDateTime;
  actor: {
    id: Uuid;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
}

/**
 * `GET /admin/audit-logs` query. Always newest first — there is no sort option,
 * and an audit trail read in another order is not one.
 *
 * `action` is an exact match on an open vocabulary, so an unrecognised value
 * returns an empty page rather than a 400. There is deliberately no text search
 * over `reason` or `metadata`: both are unindexed on a table that only grows.
 */
export interface ListAuditLogsQuery {
  page?: number;
  limit?: number;
  actorId?: Uuid;
  targetType?: AuditTargetTypeValue | string;
  targetId?: Uuid;
  action?: AuditActionValue | string;
  /** `createdAt >=`, ISO 8601. */
  from?: string;
  /** `createdAt <=`, ISO 8601. */
  to?: string;
}

// ---------------------------------------------------------------------------
// THE DASHBOARD — /admin/stats
// ---------------------------------------------------------------------------

/** A count map, zero-filled across every value of the enum it is keyed by. */
export type CountsByStatus = Record<string, number>;

/**
 * The platform KPI snapshot.
 *
 * ⚠️ **"Revenue" here means PAID orders only** — statuses PAID, PROCESSING,
 * SHIPPED and DELIVERED. PENDING orders were never charged; CANCELLED and
 * REFUNDED are money the platform does not hold. `orders.byStatus` still counts
 * all seven, so `orders.total` is deliberately larger than the order count behind
 * `revenue.gross`.
 *
 * **Cached for 60 seconds** on the API. `generatedAt` says how old it is. Do not
 * poll it — it is the heaviest read in the API, around fourteen aggregates.
 *
 * Every count map is zero-filled across its whole enum, so `?? 0` is never needed
 * and a chart legend does not reorder itself as data arrives.
 */
export interface AdminStats {
  generatedAt: IsoDateTime;
  currency: string;

  orders: {
    /** Every order, any status. */
    total: number;
    byStatus: CountsByStatus;
    /** PAID statuses only. */
    last30Days: number;
    /** PAID statuses only, since midnight in the platform's timezone. */
    today: number;
  };

  revenue: {
    /** Lifetime `grandTotal` across paid orders — what shoppers paid. */
    gross: Money;
    grossLast30Days: Money;
    grossToday: Money;
    /** Lifetime subtotal, excluding shipping. */
    merchandise: Money;
    shipping: Money;
    /** The platform's cut of retail sales. Charged on the vendor's MARGIN. */
    commissionEarned: Money;
    /** Sum of line margins (retail − cost, floored at zero). */
    vendorMargin: Money;
    /** `commissionEarned + vendorPayoutsOwed === soldAtRetail`, exactly. */
    vendorPayoutsOwed: Money;
    /**
     * What vendors actually PAID the platform for pool stock.
     *
     * Real income, and a DIFFERENT figure from `commissionEarned` — do not add
     * the two together and call the result revenue. Under the prepaid model this
     * is usually much the larger of the two.
     */
    wholesaleCollected: Money;
    wholesalePurchaseCount: number;
    soldAtRetail: Money;
    /** `gross` over the count of PAID orders. Zero when there are none. */
    averageOrderValue: Money;
  };

  vendors: {
    total: number;
    /** The approval queue — the one number an admin acts on daily. */
    pendingApproval: number;
    byStatus: CountsByStatus;
  };

  products: {
    /** Excludes soft-deleted. */
    total: number;
    byStatus: CountsByStatus;
    /** At or below their OWN `lowStockAt`. Per-product, not a global threshold. */
    lowStock: number;
    softDeleted: number;
  };

  payouts: {
    pendingCount: number;
    pendingValue: Money;
    completedCount: number;
    completedValue: Money;
  };

  users: {
    total: number;
    byRole: CountsByStatus;
    newLast30Days: number;
  };

  /** The ten newest audit entries — the same rows `GET /admin/audit-logs` returns. */
  recentActivity: AuditLogEntry[];
}

/** One bucket of the sales chart. */
export interface AdminSalesPoint {
  /**
   * Start of the bucket, as an instant.
   *
   * Buckets are civil days/weeks/months in the platform's timezone
   * (`Africa/Lagos`), so a daily bucket's instant is `23:00Z` on the PREVIOUS
   * calendar date. **Format it in that timezone**, or the chart's labels will all
   * be one day behind while its totals agree with the snapshot.
   */
  bucket: IsoDateTime;
  orders: number;
  revenue: Money;
}

/**
 * `GET /admin/stats/sales`.
 *
 * `points` covers the WHOLE window including buckets with no orders, which come
 * back as zeros rather than being omitted — a chart fed only non-empty buckets
 * draws a straight line across a day that sold nothing, which reads as a gentle
 * trend instead of a gap. Weeks are ISO: Monday first.
 */
export interface AdminSalesSeries {
  from: IsoDateTime;
  to: IsoDateTime;
  granularity: "day" | "week" | "month";
  points: AdminSalesPoint[];
}

export interface AdminSalesQuery {
  /** ISO 8601. Defaults to 30 days ago. Range capped at 365 days. */
  from?: string;
  /** ISO 8601. Defaults to now. */
  to?: string;
  granularity?: "day" | "week" | "month";
}

// Re-exported for convenience: an admin list screen needs the meta and the user
// shape constantly, and importing them from three places is noise.
export type { PaginationMeta, User };
