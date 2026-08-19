import type {
  AdvanceFulfillmentBody,
  ApplyAsVendorBody,
  CatalogueProduct,
  CommissionTier,
  ListReferralsQuery,
  ReferralRecruit,
  ReferralSummary,
  InitiateStockPurchaseBody,
  StockPurchaseInit,
  StockPurchase,
  ListStockPurchasesQuery,
  ListCatalogueQuery,
  ListVendorListingsQuery,
  ListVendorOrdersQuery,
  PaginationMeta,
  UpdatePayoutInfoBody,
  UpdateVendorListingBody,
  UpdateVendorProfileBody,
  VendorListing,
  VendorOrder,
  VendorOrderDetail,
  VendorProfile,
} from "@rimalis/types";
import { request, type RequestContext } from "./http";
import type { ApiError, Result } from "./result";

/**
 * The seller's own store: profile, listings, orders and fulfilment.
 *
 * Every call here requires an access token belonging to a user with a vendor
 * record. Two guards sit in front of them on the API and they fail differently,
 * which is the thing to design around:
 *
 * - `authenticate` — no/expired token → **401**. The session is the problem.
 * - `requireVendor` — token is fine, but the vendor is not `APPROVED` → **403**.
 *   This is a **live database check**, not a claim read off the JWT, so an admin
 *   suspending a vendor takes effect on their next request rather than at their
 *   next login. A dashboard that is open when that happens starts 403ing
 *   mid-session, and the right response is the suspended screen, not a login
 *   redirect.
 *
 * Conflating the two is the most likely mistake: sending a suspended vendor to
 * `/login` produces an infinite loop, because signing in again succeeds and
 * lands them right back on a page that 403s. Use `isNotApproved()` below.
 */

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/**
 * `GET /vendors/me` — the signed-in user's vendor record.
 *
 * ⚠️ **Reachable for a non-`APPROVED` vendor, unlike everything else here.** It
 * is mounted behind `authenticate` only, so a `PENDING` or `SUSPENDED` seller
 * can still read their own status — which is exactly what the gate screens need
 * in order to say *why* they are blocked. Read this first, branch on `status`,
 * and only then call anything under `/vendor/*`.
 *
 * A 404 means the user has no vendor record at all: a shopper account that
 * wandered in, or an application never submitted. That is a different screen
 * again — an invitation to apply, not a rejection.
 */
export const me = (ctx: RequestContext): Promise<Result<VendorProfile>> =>
  request({ ...ctx, path: "/vendors/me" });

/**
 * `POST /vendors/apply` — become a vendor from an existing account.
 *
 * Requires a signed-in user, so a seller registers as an ordinary customer on
 * the marketplace first and applies second. There is no vendor sign-up endpoint,
 * and that is why the vendor app has a login form but no register form.
 *
 * Creates the record as `PENDING`; an admin approves it. So the success path is a
 * "we'll be in touch" screen, never the dashboard — `requireVendor` will refuse
 * every `/vendor/*` call until the status changes.
 *
 * 409 when an application already exists, including a rejected or suspended one.
 * Treat it as "you already have a record" and show the status gate rather than a
 * validation error, since re-applying is not the fix for either.
 */
export const apply = (
  ctx: RequestContext,
  body: ApplyAsVendorBody,
): Promise<Result<VendorProfile>> =>
  request({ ...ctx, method: "POST", path: "/vendors/apply", body });

/** `PATCH /vendors/me` — storefront presentation. Send only what changed. */
export const updateProfile = (
  ctx: RequestContext,
  body: UpdateVendorProfileBody,
): Promise<Result<VendorProfile>> =>
  request({ ...ctx, method: "PATCH", path: "/vendors/me", body });

/**
 * `PATCH /vendors/me/payout-info` — the Paystack subaccount that gets paid.
 *
 * All three fields together; see `UpdatePayoutInfoBody` on why this is not a
 * partial update. Until this is set, every checkout containing this vendor's
 * items fails with 409 `VENDOR_PAYOUT_NOT_CONFIGURED` — so this is the single
 * highest-value field in the vendor app, and the one most worth nagging about.
 */
export const updatePayoutInfo = (
  ctx: RequestContext,
  body: UpdatePayoutInfoBody,
): Promise<Result<VendorProfile>> =>
  request({ ...ctx, method: "PATCH", path: "/vendors/me/payout-info", body });

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

/**
 * `GET /vendor/products` — this vendor's listings, newest first.
 *
 * `includeDeleted: true` is what makes a restore affordance possible; without
 * it a soft-deleted listing simply vanishes and the vendor cannot get it back
 * from the UI. Pass it on any "removed" view.
 */
export const listListings = (
  ctx: RequestContext,
  query: ListVendorListingsQuery = {},
): Promise<Result<VendorListing[], PaginationMeta>> =>
  request({ ...ctx, path: "/vendor/products", query: { ...query } });

/** `GET /vendor/products/:id` — one listing. 404 if it is not this vendor's. */
export const getListing = (ctx: RequestContext, id: string): Promise<Result<VendorListing>> =>
  request({ ...ctx, path: `/vendor/products/${encodeURIComponent(id)}` });

/**
 * `GET /vendor/products/catalogue` — the admin pool, to find something to list.
 *
 * This is how a vendor obtains the `productId` `initiateStockPurchase` requires.
 * Vendors do not create products; an administrator curates the catalogue and a
 * vendor buys from it. There is no other vendor-readable view of the pool —
 * `GET /admin/products` is `requireRole("ADMIN")` and returns DRAFT rows and
 * internal stock state besides.
 *
 * Returns AVAILABLE products only, because `initiateStockPurchase` rejects
 * anything else with 403 `PRODUCT_NOT_AVAILABLE`.
 *
 * Rows carry both `costPrice` (what the vendor will pay per unit) and
 * `retailPrice` (what a shopper pays), so a buy form can show the margin before
 * the vendor commits. `stock` is the pool ceiling on how many they can buy.
 *
 * ⚠️ Read `CatalogueProduct.listing.ownedStock` before wiring the button:
 * `0` means the vendor carries this product and has SOLD OUT, which is not the
 * same as never having carried it.
 */
export const browseCatalogue = (
  ctx: RequestContext,
  query: ListCatalogueQuery = {},
): Promise<Result<CatalogueProduct[], PaginationMeta>> =>
  request({ ...ctx, path: "/vendor/products/catalogue", query: { ...query } });

/**
 * `POST /vendor/stock-purchases` — buy inventory. This is how a listing is made.
 *
 * Replaces `createListing`, which no longer exists. A vendor pays
 * `quantity × costPrice` to the platform and the listing is created by the
 * Paystack webhook once the money lands — so **this call does not create a
 * listing, it starts a payment.**
 *
 * ## What the caller must do with the result
 *
 * Redirect to `authorizationUrl`. Then poll `getStockPurchase` on the return
 * page until the status leaves `PENDING`.
 *
 * ⚠️ **Never retry this call to "check" a purchase.** Each call reserves a fresh
 * batch out of the pool and opens a second Paystack transaction; there is no
 * idempotency key on this endpoint. A vendor who ends up paying twice has bought
 * twice, and the stock is really theirs.
 *
 * Failures worth handling apart from the generic case:
 *
 * - **409 `INSUFFICIENT_POOL_STOCK`** — the platform does not have that many
 *   units left, or another vendor took them while this one was deciding. Show
 *   the current pool figure and let them buy fewer.
 * - **409 `PRODUCT_COST_NOT_SET`** — an admin has not priced this product for
 *   vendors. Nothing the vendor can do; it is not their error to fix.
 * - **403 `PRODUCT_NOT_AVAILABLE`** — the product went DRAFT or UNAVAILABLE
 *   since the catalogue page rendered. Check the `code`: a bare 403 here also
 *   means "your vendor account is not approved", a different sentence entirely.
 */
export const initiateStockPurchase = (
  ctx: RequestContext,
  body: InitiateStockPurchaseBody,
): Promise<Result<StockPurchaseInit>> =>
  request({ ...ctx, method: "POST", path: "/vendor/stock-purchases", body });

/** `GET /vendor/stock-purchases` — this vendor's purchases, newest first. */
export const listStockPurchases = (
  ctx: RequestContext,
  query: ListStockPurchasesQuery = {},
): Promise<Result<StockPurchase[], PaginationMeta>> =>
  request({ ...ctx, path: "/vendor/stock-purchases", query: { ...query } });

/**
 * `GET /vendor/stock-purchases/:id` — poll this after returning from Paystack.
 *
 * `PENDING` is not a failure and not a timeout: it means the webhook has not
 * landed yet. Keep waiting. Offering a "try again" button here is how a vendor
 * ends up buying the same stock twice.
 */
export const getStockPurchase = (
  ctx: RequestContext,
  id: string,
): Promise<Result<StockPurchase>> =>
  request({ ...ctx, path: `/vendor/stock-purchases/${encodeURIComponent(id)}` });

/**
 * `PATCH /vendor/products/:id` — visibility only.
 *
 * Price and stock are no longer editable: the admin sets one retail price, and
 * a vendor's ceiling is what they bought. To sell more, buy more.
 */
export const updateListing = (
  ctx: RequestContext,
  id: string,
  body: UpdateVendorListingBody,
): Promise<Result<VendorListing>> =>
  request({
    ...ctx,
    method: "PATCH",
    path: `/vendor/products/${encodeURIComponent(id)}`,
    body,
  });

/**
 * `DELETE /vendor/products/:id` — soft delete, reversible.
 *
 * Sets `deletedAt` and drops the listing off the marketplace. Historical order
 * items are untouched: they carry their own name and price snapshots precisely
 * so that removing a listing never rewrites what somebody already bought.
 *
 * Returns the updated listing rather than 204, so the caller can render the
 * removed state without a re-read.
 */
export const removeListing = (ctx: RequestContext, id: string): Promise<Result<VendorListing>> =>
  request({ ...ctx, method: "DELETE", path: `/vendor/products/${encodeURIComponent(id)}` });

/**
 * `PATCH /vendor/products/:id/restore` — undo a removal.
 *
 * Clears `deletedAt`. It does **not** set `isActive` — a listing removed while
 * switched off comes back switched off, which is the honest outcome but reads as
 * "restore didn't work" if the UI only looks at whether the row reappeared.
 */
export const restoreListing = (ctx: RequestContext, id: string): Promise<Result<VendorListing>> =>
  request({
    ...ctx,
    method: "PATCH",
    path: `/vendor/products/${encodeURIComponent(id)}/restore`,
  });

// ---------------------------------------------------------------------------
// Orders and fulfilment
// ---------------------------------------------------------------------------

/**
 * `GET /vendor/orders` — orders containing at least one of this vendor's items.
 *
 * `items` comes back filtered to this vendor; the money totals do not. See
 * `VendorOrder` — `grandTotal` on a shared order includes another seller's
 * takings, so vendor revenue is `sum(items[].vendorPayout)` and never the
 * order's own total.
 *
 * `status` filters the **order's** rolled-up status. There is no filter on an
 * item's `fulfillmentStatus`, so "lines I still have to pick" cannot be asked
 * for directly — query `PAID` and `PROCESSING` and inspect the items.
 */
export const listOrders = (
  ctx: RequestContext,
  query: ListVendorOrdersQuery = {},
): Promise<Result<VendorOrder[], PaginationMeta>> =>
  request({ ...ctx, path: "/vendor/orders", query: { ...query } });

/** `GET /vendor/orders/:id` — one order, this vendor's lines only. */
export const getOrder = (ctx: RequestContext, id: string): Promise<Result<VendorOrderDetail>> =>
  request({ ...ctx, path: `/vendor/orders/${encodeURIComponent(id)}` });

/**
 * `PATCH /vendor/orders/:orderId/items/:itemId` — move one line forward.
 *
 * Forward only: `PENDING → PROCESSING → SHIPPED → DELIVERED`. A backwards or
 * skipping transition is a 400 `INVALID_TRANSITION`, and so is touching a line
 * on an order that is not yet `PAID` — a vendor must not ship against an unpaid
 * order, and the API enforces it rather than trusting the UI to hide the button.
 *
 * **Returns the whole order.** Advancing the last outstanding line rolls the
 * order's own `status` up, so re-render from this response instead of mutating
 * the row locally, or the header and the rows disagree.
 */
export const advanceFulfillment = (
  ctx: RequestContext,
  orderId: string,
  itemId: string,
  body: AdvanceFulfillmentBody,
): Promise<Result<VendorOrderDetail>> =>
  request({
    ...ctx,
    method: "PATCH",
    path: `/vendor/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}`,
    body,
  });

// ---------------------------------------------------------------------------
// Narrowing helpers
// ---------------------------------------------------------------------------

/**
 * The 403 that means "your vendor account is not APPROVED".
 *
 * Distinct from a 401 in the one way that matters: **do not redirect this to
 * `/login`.** The credentials are valid, so signing in again succeeds and lands
 * straight back here — an infinite loop that looks like a broken login page.
 * Render the status gate instead, using `vendor.me()` (which stays reachable) to
 * say which status it is.
 */
export const isNotApproved = (error: ApiError): boolean =>
  error.kind === "http" && error.status === 403;

/** No vendor record at all — a shopper account, or an application never sent. */
export const isNotAVendor = (error: ApiError): boolean =>
  error.kind === "http" && error.status === 404;

/**
 * A vendor application already exists for this user.
 *
 * `POST /vendors/apply` 409s whether the existing record is PENDING, APPROVED,
 * REJECTED or SUSPENDED — so this is "you already have a record", not "you were
 * rejected". Send them to the status gate, which knows which; re-applying is not
 * the fix for any of the four.
 */
export const isVendorProfileExists = (error: ApiError): boolean =>
  error.kind === "http" && error.status === 409;

/**
 * The referral code on the application does not belong to any vendor.
 *
 * A 400 that must be shown on the `referralCode` FIELD, not as a form-level
 * banner: everything else the applicant typed is fine, and a banner reading
 * "invalid referral code" next to a full form invites them to re-check the store
 * name. Tell them the code is unknown and to confirm it with whoever gave it to
 * them — codes are read off phone screens, and the Crockford alphabet upstream
 * exists so a mistyped one fails visibly instead of crediting a stranger.
 *
 * Note this fails the whole application rather than dropping the code. See
 * `ApplyAsVendorBody.referralCode` for why that is deliberate.
 */
export const isInvalidReferralCode = (error: ApiError): boolean =>
  error.kind === "http" && error.code === "INVALID_REFERRAL_CODE";

/**
 * The applicant used their own referral code.
 *
 * Only reachable on a REAPPLICATION — a first-time applicant has no code yet.
 * Also a field-level error, and worth its own message: "that's your own code" is
 * actionable, whereas the generic invalid-code copy would send them off to check
 * with a referrer who does not exist.
 */
export const isSelfReferral = (error: ApiError): boolean =>
  error.kind === "http" && error.code === "SELF_REFERRAL_NOT_ALLOWED";

/**
 * The platform does not have enough units left for this purchase.
 *
 * Either the vendor asked for more than the pool holds, or another vendor took
 * them while this one was on the form. Re-read the catalogue row and show the
 * current ceiling rather than repeating the request.
 */
export const isInsufficientPoolStock = (error: ApiError): boolean =>
  error.kind === "http" &&
  error.status === 409 &&
  error.code === "INSUFFICIENT_POOL_STOCK";

/**
 * No cost price has been set for this product yet.
 *
 * An administrator has not finished pricing it — most likely a row the
 * wholesale migration backfilled. Nothing the vendor can do about it, so say so
 * rather than inviting a retry.
 */
export const isProductCostNotSet = (error: ApiError): boolean =>
  error.kind === "http" &&
  error.status === 409 &&
  error.code === "PRODUCT_COST_NOT_SET";

/**
 * The product is no longer listable — it went DRAFT or UNAVAILABLE.
 *
 * Checks the `code`, not just the status: `isNotApproved` is also a 403 on these
 * routes, and telling an approved vendor their account is not approved because a
 * product was withdrawn sends them to support for the wrong reason.
 */
export const isProductNotAvailable = (error: ApiError): boolean =>
  error.kind === "http" && error.status === 403 && error.code === "PRODUCT_NOT_AVAILABLE";

/** A fulfilment transition the API refuses — stale UI, so re-read the order. */
export const isInvalidTransition = (error: ApiError): boolean =>
  error.kind === "http" && error.status === 400;

// ---------------------------------------------------------------------------
// Referrals and the commission ladder
// ---------------------------------------------------------------------------

/**
 * `GET /vendor/referrals/me` — code, qualified count, and tier standing.
 *
 * The one call that can answer "what commission am I actually paying?".
 * `VendorProfile.commissionRateOverride` cannot: it is null for most vendors,
 * and null means "the ladder decides", not "the platform default". Read
 * `currentRate` here instead.
 */
export const referralSummary = (
  ctx: RequestContext,
): Promise<Result<ReferralSummary>> =>
  request({ ...ctx, path: "/vendor/referrals/me" });

/**
 * `GET /vendor/referrals` — the vendors this vendor recruited.
 *
 * Qualified first, then newest. `qualified: false` narrows to the pipeline —
 * recruits who applied but have not yet been approved or bought stock — which is
 * the list a vendor wants when a referral "hasn't shown up".
 */
export const listReferrals = (
  ctx: RequestContext,
  query: ListReferralsQuery = {},
): Promise<Result<ReferralRecruit[], PaginationMeta>> =>
  request({ ...ctx, path: "/vendor/referrals", query: { ...query } });

/**
 * `GET /commission-tiers` — the whole ladder, in display order.
 *
 * Mounted behind `authenticate` only, so this is readable by a PENDING vendor and
 * by a shopper who has not applied. Guaranteed monotonic by the API.
 */
export const commissionTiers = (
  ctx: RequestContext,
): Promise<Result<CommissionTier[]>> =>
  request({ ...ctx, path: "/commission-tiers" });
