import type {
  AdvanceFulfillmentBody,
  ApplyAsVendorBody,
  CreateVendorListingBody,
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
 * `POST /vendor/products` — list a pool product in this store.
 *
 * 409 `LISTING_ALREADY_EXISTS` when this vendor already carries the product,
 * including when their existing listing is soft-deleted — in which case the fix
 * is `restoreListing()`, not a retry. Surfacing "you already list this" with a
 * link to the existing row beats a raw conflict every time.
 */
export const createListing = (
  ctx: RequestContext,
  body: CreateVendorListingBody,
): Promise<Result<VendorListing>> =>
  request({ ...ctx, method: "POST", path: "/vendor/products", body });

/**
 * `PATCH /vendor/products/:id` — price, cap, or visibility.
 *
 * ⚠️ Read `UpdateVendorListingBody` before building the form. `vendorPrice:
 * null` **clears the override**; omitting the key leaves it alone. A controlled
 * input that serialises an empty field as `null` will wipe prices its user never
 * touched.
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

/** This vendor already lists that product; offer the existing listing or a restore. */
export const isDuplicateListing = (error: ApiError): boolean =>
  error.kind === "http" && error.status === 409;

/** A fulfilment transition the API refuses — stale UI, so re-read the order. */
export const isInvalidTransition = (error: ApiError): boolean =>
  error.kind === "http" && error.status === 400;
