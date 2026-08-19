import type {
  AddProductAttributeBody,
  AddProductImageBody,
  AdjustStockBody,
  AdminOrderDetail,
  AdminOrderRow,
  AdminPayoutDetail,
  AdminPayoutRow,
  AdminSalesQuery,
  AdminSalesSeries,
  AdminStats,
  AdminStockPurchaseDetail,
  AdminStockPurchaseRow,
  AdminVendorDetail,
  AdminVendorRow,
  AuditLogEntry,
  CreateCommissionTierBody,
  CreateImageUploadUrlBody,
  CreatePoolProductBody,
  CommissionTier,
  ImageUploadTicket,
  ListAdminOrdersQuery,
  ListAdminPayoutsQuery,
  ListAdminStockPurchasesQuery,
  ListAdminVendorsQuery,
  ListAuditLogsQuery,
  ListPoolProductsQuery,
  ListUsersQuery,
  PaginationMeta,
  PoolProductDetail,
  PoolProductRow,
  ProductAttribute,
  ProductImage,
  SetCommissionRateBody,
  SuspendUserBody,
  SuspendVendorBody,
  UpdateCommissionTierBody,
  UpdatePoolProductBody,
  UpdateProductImageBody,
  UpdateUserRoleBody,
  User,
} from "@rimalis/types";
import { request, type RequestContext } from "./http";
import type { ApiError, Result } from "./result";

/**
 * Everything an ADMIN can do: the product pool, user and vendor administration,
 * the ledger, the commission ladder, the audit trail and the dashboard.
 *
 * ## Why this module owns calls whose paths are not under `/admin`
 *
 * `/users`, `/users/:id/role`, `/vendors`, `/vendors/:id/approve` and friends
 * live here even though their paths say otherwise, because `users.ts` and
 * `vendor.ts` are **self-scoped** surfaces — `/users/me`, `/vendors/me`, "my
 * addresses", "my listings". Dropping "list every user on the platform" and
 * "suspend this seller" in beside "get my own profile" would put two very
 * different blast radii one line apart, and the guard that separates them
 * (`requireRole("ADMIN")` versus `authenticate`) is invisible at the call site.
 *
 * The rule is the GUARD, not the path prefix. One consequence of applying it
 * consistently: category writes are NOT here. `categories.ts` already owns
 * `/categories`, the admin console needs its reads anyway, and splitting one
 * resource's five calls across two modules to satisfy a naming rule would be
 * worse than the rule is worth.
 *
 * ## Every call needs an ADMIN access token
 *
 * Two guards sit in front of all of them, and they fail differently:
 *
 * - `authenticate` — no or expired token → **401**. The session is the problem;
 *   send the admin back through login.
 * - `requireRole("ADMIN")` — the token is valid and the role is wrong → **403**.
 *   The session is fine and the *account* is not. Sending that to `/login`
 *   produces an infinite loop, because signing in again succeeds and lands
 *   straight back here.
 *
 * ## The token is a per-request argument
 *
 * As everywhere in this package — see `RequestContext.accessToken` in `http.ts`.
 * It matters more here than anywhere else: a module-level token in an admin
 * client is one Worker isolate away from performing one admin's suspension under
 * another's identity in the audit log.
 */

// ---------------------------------------------------------------------------
// THE PRODUCT POOL
// ---------------------------------------------------------------------------

/**
 * `GET /admin/products` — the whole pool, including DRAFT and soft-deleted.
 *
 * ⚠️ Each row's `images` holds the primary image only and **may be empty**. See
 * `PoolProductRow`.
 */
export const listProducts = (
  ctx: RequestContext,
  query: ListPoolProductsQuery = {},
): Promise<Result<PoolProductRow[], PaginationMeta>> =>
  request({ ...ctx, path: "/admin/products", query: { ...query } });

/** `GET /admin/products/:id` — all images in `sortOrder`, plus attributes. */
export const getProduct = (
  ctx: RequestContext,
  id: string,
): Promise<Result<PoolProductDetail>> =>
  request({ ...ctx, path: `/admin/products/${encodeURIComponent(id)}` });

/**
 * `POST /admin/products` — 201, status DRAFT.
 *
 * Money goes in as a NUMBER here and comes back as a decimal string. 409
 * `SKU_TAKEN` if the SKU exists — including on a soft-deleted product, since the
 * unique constraint does not care about `deletedAt`. Offer restore, not a retry.
 */
export const createProduct = (
  ctx: RequestContext,
  body: CreatePoolProductBody,
): Promise<Result<PoolProductDetail>> =>
  request({ ...ctx, method: "POST", path: "/admin/products", body });

/**
 * `PATCH /admin/products/:id`.
 *
 * `sku` and `stock` are rejected — the type omits them. Use
 * `adjustStock` for quantity, which demands a reason and writes an audit entry.
 */
export const updateProduct = (
  ctx: RequestContext,
  id: string,
  body: UpdatePoolProductBody,
): Promise<Result<PoolProductDetail>> =>
  request({
    ...ctx,
    method: "PATCH",
    path: `/admin/products/${encodeURIComponent(id)}`,
    body,
  });

/**
 * `DELETE /admin/products/:id` — a SOFT delete. 204, so `data` is `undefined`.
 *
 * Existing vendor listings and order history survive it; the product simply stops
 * being listable. Reversible with `restoreProduct`.
 */
export const deleteProduct = (
  ctx: RequestContext,
  id: string,
): Promise<Result<undefined>> =>
  request({
    ...ctx,
    method: "DELETE",
    path: `/admin/products/${encodeURIComponent(id)}`,
  });

/** `PATCH /admin/products/:id/restore` — undoes a soft delete. */
export const restoreProduct = (
  ctx: RequestContext,
  id: string,
): Promise<Result<PoolProductDetail>> =>
  request({
    ...ctx,
    method: "PATCH",
    path: `/admin/products/${encodeURIComponent(id)}/restore`,
  });

/**
 * `PATCH /admin/products/:id/publish` — DRAFT → AVAILABLE, so vendors can buy it.
 *
 * Two preconditions, both 400s: at least one image (`NO_IMAGES`) and a positive
 * price (`NO_PRICE`). **State them on screen before the click** — a publish button
 * that fails is worse than one that explains what is missing. Use
 * `isPublishBlocked`.
 */
export const publishProduct = (
  ctx: RequestContext,
  id: string,
): Promise<Result<PoolProductDetail>> =>
  request({
    ...ctx,
    method: "PATCH",
    path: `/admin/products/${encodeURIComponent(id)}/publish`,
  });

/**
 * `PATCH /admin/products/:id/unpublish` — AVAILABLE → UNAVAILABLE.
 *
 * Stops NEW listings. It does **not** delist vendors who already bought stock —
 * they paid for those units and keep selling them. Say so on the confirmation, or
 * an admin will expect the product to vanish from the storefront and it will not.
 */
export const unpublishProduct = (
  ctx: RequestContext,
  id: string,
): Promise<Result<PoolProductDetail>> =>
  request({
    ...ctx,
    method: "PATCH",
    path: `/admin/products/${encodeURIComponent(id)}/unpublish`,
  });

/**
 * `POST /admin/products/:id/stock/adjust` — a signed delta on the platform pool.
 *
 * `reason` is required and lands in the audit trail. 400 `INSUFFICIENT_STOCK` when
 * a negative delta would take the pool below zero.
 */
export const adjustStock = (
  ctx: RequestContext,
  id: string,
  body: AdjustStockBody,
): Promise<Result<PoolProductDetail>> =>
  request({
    ...ctx,
    method: "POST",
    path: `/admin/products/${encodeURIComponent(id)}/stock/adjust`,
    body,
  });

// ---------------------------------------------------------------------------
// PRODUCT IMAGES — a three-step flow, and step 2 is not in this package
//
//   1. createImageUploadUrl()  → a signed ticket
//   2. the BROWSER PUTs the bytes to `ticket.uploadUrl`  ← not here, on purpose
//   3. addProductImage({ url: ticket.publicUrl })
//
// Step 2 is a direct cross-origin PUT from the browser to Supabase Storage. The
// bytes must not pass through the BFF: a Worker has a hard request-body limit and
// a CPU budget, and proxying a 4MB photo through it to spend both is pure cost.
// That is why the API hands out a ticket rather than accepting a multipart upload.
// ---------------------------------------------------------------------------

/**
 * Step 1. 502 `STORAGE_UNAVAILABLE` if Supabase Storage is unreachable — a
 * transient infrastructure failure, not bad input, so offer a retry.
 */
export const createImageUploadUrl = (
  ctx: RequestContext,
  id: string,
  body: CreateImageUploadUrlBody,
): Promise<Result<ImageUploadTicket>> =>
  request({
    ...ctx,
    method: "POST",
    path: `/admin/products/${encodeURIComponent(id)}/images/upload-url`,
    body,
  });

/**
 * Step 3. 400 `IMAGE_URL_NOT_OWNED` for any URL outside the platform's own
 * bucket, so an address copied from another site is a validation error rather
 * than a hotlink.
 *
 * A failure here after a successful step 2 leaves an uploaded object with no
 * database row. Offer "retry registering" with the same `publicUrl` rather than
 * re-uploading the bytes.
 */
export const addProductImage = (
  ctx: RequestContext,
  id: string,
  body: AddProductImageBody,
): Promise<Result<ProductImage>> =>
  request({
    ...ctx,
    method: "POST",
    path: `/admin/products/${encodeURIComponent(id)}/images`,
    body,
  });

/** `PATCH /admin/products/:id/images/:imageId` — alt text, primary flag, order. */
export const updateProductImage = (
  ctx: RequestContext,
  id: string,
  imageId: string,
  body: UpdateProductImageBody,
): Promise<Result<ProductImage>> =>
  request({
    ...ctx,
    method: "PATCH",
    path: `/admin/products/${encodeURIComponent(id)}/images/${encodeURIComponent(imageId)}`,
    body,
  });

/**
 * `DELETE /admin/products/:id/images/:imageId` — 204.
 *
 * Deleting the last image does not unpublish the product; it leaves an AVAILABLE
 * product that could not be published again. Warn when it is the only one.
 */
export const deleteProductImage = (
  ctx: RequestContext,
  id: string,
  imageId: string,
): Promise<Result<undefined>> =>
  request({
    ...ctx,
    method: "DELETE",
    path: `/admin/products/${encodeURIComponent(id)}/images/${encodeURIComponent(imageId)}`,
  });

export const addProductAttribute = (
  ctx: RequestContext,
  id: string,
  body: AddProductAttributeBody,
): Promise<Result<ProductAttribute>> =>
  request({
    ...ctx,
    method: "POST",
    path: `/admin/products/${encodeURIComponent(id)}/attributes`,
    body,
  });

/** 204. */
export const deleteProductAttribute = (
  ctx: RequestContext,
  id: string,
  attributeId: string,
): Promise<Result<undefined>> =>
  request({
    ...ctx,
    method: "DELETE",
    path: `/admin/products/${encodeURIComponent(id)}/attributes/${encodeURIComponent(attributeId)}`,
  });

// ---------------------------------------------------------------------------
// USERS
// ---------------------------------------------------------------------------

/** `GET /users` — every account on the platform. */
export const listUsers = (
  ctx: RequestContext,
  query: ListUsersQuery = {},
): Promise<Result<User[], PaginationMeta>> =>
  request({ ...ctx, path: "/users", query: { ...query } });

export const getUser = (
  ctx: RequestContext,
  id: string,
): Promise<Result<User>> =>
  request({ ...ctx, path: `/users/${encodeURIComponent(id)}` });

/**
 * `PATCH /users/:id/role`.
 *
 * ⚠️ **400 when an admin targets their own account.** That guard is what stops the
 * last admin demoting themselves and locking the whole team out. Do not render
 * the control on your own row — see `isSelfRoleChange`.
 */
export const setUserRole = (
  ctx: RequestContext,
  id: string,
  body: UpdateUserRoleBody,
): Promise<Result<User>> =>
  request({
    ...ctx,
    method: "PATCH",
    path: `/users/${encodeURIComponent(id)}/role`,
    body,
  });

/**
 * `PATCH /users/:id/suspend` — `isActive: false`.
 *
 * Blocks login and blocks refresh, but an access token already issued keeps
 * working until it expires (≤15 min). Not instant, and worth saying so.
 */
export const suspendUser = (
  ctx: RequestContext,
  id: string,
  body: SuspendUserBody = {},
): Promise<Result<User>> =>
  request({
    ...ctx,
    method: "PATCH",
    path: `/users/${encodeURIComponent(id)}/suspend`,
    body,
  });

export const reactivateUser = (
  ctx: RequestContext,
  id: string,
): Promise<Result<User>> =>
  request({
    ...ctx,
    method: "PATCH",
    path: `/users/${encodeURIComponent(id)}/reactivate`,
  });

// ---------------------------------------------------------------------------
// VENDORS
// ---------------------------------------------------------------------------

/** `GET /vendors` — rows carry the owning `user`. `search` also matches their email. */
export const listVendors = (
  ctx: RequestContext,
  query: ListAdminVendorsQuery = {},
): Promise<Result<AdminVendorRow[], PaginationMeta>> =>
  request({ ...ctx, path: "/vendors", query: { ...query } });

/**
 * `GET /vendors/:id`.
 *
 * ⚠️ **Carries no `user`**, unlike the list rows — see `AdminVendorDetail`. A
 * detail screen needs a parallel `getUser(vendor.userId)` for the owner's email.
 */
export const getVendor = (
  ctx: RequestContext,
  id: string,
): Promise<Result<AdminVendorDetail>> =>
  request({ ...ctx, path: `/vendors/${encodeURIComponent(id)}` });

/**
 * `PATCH /vendors/:id/approve` — PENDING → APPROVED, and the vendor can trade.
 *
 * Also runs referral qualification: if this vendor was recruited and has already
 * paid for stock, approving them advances their recruiter's commission tier. That
 * happens fire-and-forget on the API, so it must never be the reason an approval
 * appears to fail.
 *
 * ⚠️ The vendor's existing access token has no `vendor_id` claim yet, so they may
 * need to sign in again before `/vendor/*` opens up. Say so on the success state,
 * or "you approved me and it still says pending" comes back as a bug report.
 */
export const approveVendor = (
  ctx: RequestContext,
  id: string,
): Promise<Result<AdminVendorDetail>> =>
  request({
    ...ctx,
    method: "PATCH",
    path: `/vendors/${encodeURIComponent(id)}/approve`,
  });

/**
 * `PATCH /vendors/:id/reject`.
 *
 * ⚠️ **Accepts NO body.** A `rejectVendorSchema` exists on the API but is not
 * wired to the route, so a reason cannot be sent and none is recorded beyond the
 * action itself. Do not build a reason field for this — it would silently
 * discard what the admin typed, which is the exact bug the audit table was
 * created to fix.
 */
export const rejectVendor = (
  ctx: RequestContext,
  id: string,
): Promise<Result<AdminVendorDetail>> =>
  request({
    ...ctx,
    method: "PATCH",
    path: `/vendors/${encodeURIComponent(id)}/reject`,
  });

/**
 * `PATCH /vendors/:id/suspend` — takes a reason, unlike reject.
 *
 * Enforced live: the API re-reads vendor status from the database on every
 * request, so an open vendor dashboard starts failing on its next navigation.
 */
export const suspendVendor = (
  ctx: RequestContext,
  id: string,
  body: SuspendVendorBody = {},
): Promise<Result<AdminVendorDetail>> =>
  request({
    ...ctx,
    method: "PATCH",
    path: `/vendors/${encodeURIComponent(id)}/suspend`,
    body,
  });

export const reinstateVendor = (
  ctx: RequestContext,
  id: string,
): Promise<Result<AdminVendorDetail>> =>
  request({
    ...ctx,
    method: "PATCH",
    path: `/vendors/${encodeURIComponent(id)}/reinstate`,
  });

/**
 * `PATCH /vendors/:id/commission-rate` — set or clear the per-vendor override.
 *
 * A FRACTION (`0.08` is 8%). `null` clears it and returns the vendor to the
 * referral ladder, which is NOT the platform default. Future orders only.
 *
 * Audited as `vendor.commission_overridden`, with before and after in the
 * metadata — this is the one action that silently moves money on every future
 * order, and the documented remedy for suspected referral fraud.
 */
export const setCommissionRate = (
  ctx: RequestContext,
  id: string,
  body: SetCommissionRateBody,
): Promise<Result<AdminVendorDetail>> =>
  request({
    ...ctx,
    method: "PATCH",
    path: `/vendors/${encodeURIComponent(id)}/commission-rate`,
    body,
  });

// ---------------------------------------------------------------------------
// ORDERS — read-only from here
//
// There is no admin fulfilment, cancel or refund endpoint. Fulfilment belongs to
// the vendor who owns the line; refunds are handled in the Paystack dashboard,
// because reversing a split charge touches money that has already been settled
// into several subaccounts.
// ---------------------------------------------------------------------------

/** `GET /admin/orders` — every vendor's lines, and the real order total. */
export const listOrders = (
  ctx: RequestContext,
  query: ListAdminOrdersQuery = {},
): Promise<Result<AdminOrderRow[], PaginationMeta>> =>
  request({ ...ctx, path: "/admin/orders", query: { ...query } });

export const getOrder = (
  ctx: RequestContext,
  id: string,
): Promise<Result<AdminOrderDetail>> =>
  request({ ...ctx, path: `/admin/orders/${encodeURIComponent(id)}` });

// ---------------------------------------------------------------------------
// PAYOUTS — read-only BY DESIGN
//
// There is no write function here and none may be added. Paystack's split moved
// the money at charge time; a Payout row RECORDS that, it does not cause it. A
// "trigger payout" call would pay every vendor a second time.
// ---------------------------------------------------------------------------

export const listPayouts = (
  ctx: RequestContext,
  query: ListAdminPayoutsQuery = {},
): Promise<Result<AdminPayoutRow[], PaginationMeta>> =>
  request({ ...ctx, path: "/admin/payouts", query: { ...query } });

export const getPayout = (
  ctx: RequestContext,
  id: string,
): Promise<Result<AdminPayoutDetail>> =>
  request({ ...ctx, path: `/admin/payouts/${encodeURIComponent(id)}` });

// ---------------------------------------------------------------------------
// STOCK PURCHASES — read-only
// ---------------------------------------------------------------------------

/**
 * `GET /admin/stock-purchases` — the platform's prepaid revenue, purchase by
 * purchase.
 *
 * PENDING rows are holding reservations against pool stock, which is the usual
 * explanation for a product that looks out of stock but shows units on hand.
 */
export const listStockPurchases = (
  ctx: RequestContext,
  query: ListAdminStockPurchasesQuery = {},
): Promise<Result<AdminStockPurchaseRow[], PaginationMeta>> =>
  request({ ...ctx, path: "/admin/stock-purchases", query: { ...query } });

export const getStockPurchase = (
  ctx: RequestContext,
  id: string,
): Promise<Result<AdminStockPurchaseDetail>> =>
  request({ ...ctx, path: `/admin/stock-purchases/${encodeURIComponent(id)}` });

// ---------------------------------------------------------------------------
// THE COMMISSION LADDER
//
// The READ is re-exported from vendor.ts rather than redeclared, so the path
// literal `/commission-tiers` exists in exactly one place. `GET /commission-tiers`
// is mounted behind `authenticate` alone and returns inactive rungs too, so an
// admin token reads the whole ladder from it — there is no admin-specific list.
// ---------------------------------------------------------------------------

export { commissionTiers as listCommissionTiers } from "./vendor";

/**
 * `POST /admin/commission-tiers`.
 *
 * 400 `NON_MONOTONIC_COMMISSION_LADDER` / `AMBIGUOUS_COMMISSION_LADDER` — the
 * ladder must reward more referrals with a lower rate, and no two rungs may sit
 * at the same `minReferrals`. 409 `COMMISSION_TIER_LEVEL_TAKEN` on a duplicate
 * `level`.
 */
export const createCommissionTier = (
  ctx: RequestContext,
  body: CreateCommissionTierBody,
): Promise<Result<CommissionTier>> =>
  request({ ...ctx, method: "POST", path: "/admin/commission-tiers", body });

/** `PATCH /admin/commission-tiers/:id`. An empty body is a 400. */
export const updateCommissionTier = (
  ctx: RequestContext,
  id: string,
  body: UpdateCommissionTierBody,
): Promise<Result<CommissionTier>> =>
  request({
    ...ctx,
    method: "PATCH",
    path: `/admin/commission-tiers/${encodeURIComponent(id)}`,
    body,
  });

/**
 * `DELETE /admin/commission-tiers/:id` — 204.
 *
 * 409 `COMMISSION_LADDER_WOULD_BE_EMPTY` on the last active rung. Prefer
 * `updateCommissionTier(..., { isActive: false })`: it keeps the row readable for
 * anyone auditing a historical rate.
 */
export const deleteCommissionTier = (
  ctx: RequestContext,
  id: string,
): Promise<Result<undefined>> =>
  request({
    ...ctx,
    method: "DELETE",
    path: `/admin/commission-tiers/${encodeURIComponent(id)}`,
  });

// ---------------------------------------------------------------------------
// THE AUDIT TRAIL AND THE DASHBOARD
// ---------------------------------------------------------------------------

/**
 * `GET /admin/audit-logs` — who did what, to what, when and why. Newest first.
 *
 * `action` is an open vocabulary, so an unknown value returns an empty page rather
 * than a 400 — and a row carrying an action this client's union does not name is
 * normal, not corrupt. Render it.
 */
export const listAuditLogs = (
  ctx: RequestContext,
  query: ListAuditLogsQuery = {},
): Promise<Result<AuditLogEntry[], PaginationMeta>> =>
  request({ ...ctx, path: "/admin/audit-logs", query: { ...query } });

/**
 * `GET /admin/stats` — every dashboard headline in one call.
 *
 * **Cached for 60 seconds server-side, and the heaviest read in the API.** Do not
 * poll it and do not call it from more than one place per page render; the whole
 * point of one endpoint returning twenty figures is that a dashboard needs one
 * request. `refresh: true` bypasses the cache — use it for an explicit "refresh"
 * button and nothing else.
 */
export const stats = (
  ctx: RequestContext,
  opts: { refresh?: boolean } = {},
): Promise<Result<AdminStats>> =>
  request({
    ...ctx,
    path: "/admin/stats",
    query: opts.refresh ? { refresh: "true" } : {},
  });

/**
 * `GET /admin/stats/sales` — the chart series.
 *
 * ⚠️ Bucket instants are civil-day boundaries in the platform's timezone
 * (`Africa/Lagos`), so a daily bucket reads `23:00Z` on the previous calendar
 * date. Format in that zone or every label is a day early. Empty buckets are
 * present with zeros, deliberately.
 */
export const salesSeries = (
  ctx: RequestContext,
  query: AdminSalesQuery = {},
): Promise<Result<AdminSalesSeries>> =>
  request({ ...ctx, path: "/admin/stats/sales", query: { ...query } });

// ---------------------------------------------------------------------------
// NARROWING HELPERS
//
// Branch on these rather than on a status code. Several statuses here carry more
// than one meaning — a 403 is "not an admin" on every route, a 400 on
// `/users/:id/role` is specifically "that is you" — and a screen that guesses
// from the number alone tells the admin the wrong thing.
// ---------------------------------------------------------------------------

const isHttp = (error: ApiError, status: number, code?: string): boolean =>
  error.kind === "http" &&
  error.status === status &&
  (code === undefined || error.code === code);

/** The SKU exists — possibly on a SOFT-DELETED product. Offer restore. */
export const isSkuTaken = (error: ApiError): boolean =>
  isHttp(error, 409, "SKU_TAKEN");

/** Publish refused: no image, or no positive price. Render as a field-level reason. */
export const isPublishBlocked = (error: ApiError): boolean =>
  isHttp(error, 400, "NO_IMAGES") || isHttp(error, 400, "NO_PRICE");

/** A negative stock adjustment would take the pool below zero. */
export const isInsufficientStock = (error: ApiError): boolean =>
  isHttp(error, 400, "INSUFFICIENT_STOCK");

/** The image URL is outside the platform's own bucket. Not a retryable failure. */
export const isImageUrlNotOwned = (error: ApiError): boolean =>
  isHttp(error, 400, "IMAGE_URL_NOT_OWNED");

/** Supabase Storage is unreachable. Infrastructure, not input — offer a retry. */
export const isStorageUnavailable = (error: ApiError): boolean =>
  isHttp(error, 502, "STORAGE_UNAVAILABLE");

/**
 * The admin tried to change their OWN role.
 *
 * Carries no `code`, so this is a bare 400 on that one route — which is why it is
 * checked as such rather than by code, and why the UI should not render the
 * control on the signed-in admin's own row in the first place.
 */
export const isSelfRoleChange = (error: ApiError): boolean =>
  isHttp(error, 400);

/** The category still has products or children. Reassign them first. */
export const isCategoryInUse = (error: ApiError): boolean =>
  isHttp(error, 409, "CATEGORY_HAS_PRODUCTS") ||
  isHttp(error, 409, "CATEGORY_HAS_CHILDREN");

/** Re-parenting a category under its own descendant. */
export const isCategoryCycle = (error: ApiError): boolean =>
  isHttp(error, 400, "CATEGORY_CYCLE");

/** The ladder would stop rewarding referrals, or two rungs would tie. */
export const isLadderInvalid = (error: ApiError): boolean =>
  isHttp(error, 400, "NON_MONOTONIC_COMMISSION_LADDER") ||
  isHttp(error, 400, "AMBIGUOUS_COMMISSION_LADDER");

export const isTierLevelTaken = (error: ApiError): boolean =>
  isHttp(error, 409, "COMMISSION_TIER_LEVEL_TAKEN");

/** Deleting the last active rung. Deactivate instead. */
export const isLastActiveTier = (error: ApiError): boolean =>
  isHttp(error, 409, "COMMISSION_LADDER_WOULD_BE_EMPTY");

/**
 * The signed-in user is not an ADMIN.
 *
 * **Never send this to `/login`.** The credentials are fine; the account is not.
 * Signing in again succeeds and lands straight back here, forever.
 */
export const isNotAdmin = (error: ApiError): boolean => isHttp(error, 403);

/** No such row — or, on a soft-deleted product, one that needs `includeDeleted`. */
export const isNotFound = (error: ApiError): boolean => isHttp(error, 404);
