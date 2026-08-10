import type {
  CreateOrderBody,
  ListOrdersQuery,
  Order,
  OrderDetail,
  PaginationMeta,
} from "@rimalis/types";
import { request, type RequestContext } from "./http";
import type { ApiError, Result } from "./result";

/**
 * Checkout and order history. Authenticated, and email-verified for the write.
 */

/**
 * `POST /orders` — the whole basket, in one transaction.
 *
 * ## The idempotency key is not optional here, and that is on purpose
 *
 * It is a required parameter of this function rather than an optional field on
 * `RequestOptions`, so the one endpoint in the API that must have one cannot be
 * called without it. Send a client-generated UUID; a retry with the **same** key
 * returns the original order instead of creating a second one.
 *
 * The key must be generated **once per checkout attempt and reused across
 * retries**. A fresh key on retry defeats the entire mechanism and is exactly
 * how a double-tapped Place order button becomes two orders and two charges. In
 * practice that means generating it when the checkout form mounts and carrying
 * it in a hidden field — not calling `crypto.randomUUID()` inside the submit
 * handler.
 *
 * `http.ts` also refuses to retry a non-GET for the same reason. Leaning on this
 * key to absorb a retry we chose to make would be using defence in depth as an
 * excuse.
 *
 * ## What comes back, and what has to happen next
 *
 * A `PENDING` order with stock already decremented. **Nothing is reserved
 * indefinitely** — a nightly sweep cancels abandoned unpaid orders and returns
 * their stock — so the next call is `payments.initialize()`. An order created
 * and never paid is a shopper who saw a total and then saw nothing.
 *
 * ## The failures that need their own copy
 *
 *   403 EMAIL_NOT_VERIFIED        the account is fine, the address is unconfirmed
 *   404 LISTING_NOT_FOUND         a cart line points at a listing that is gone
 *   409 INSUFFICIENT_STOCK        someone bought the last one first
 *   409 LISTING_INACTIVE          the vendor switched the offer off
 *   409 PRODUCT_NOT_AVAILABLE     the product was withdrawn from the catalogue
 *   409 VENDOR_NOT_APPROVED       the vendor's status changed under the shopper
 *
 * Every one of those is per-line and fixable by editing the cart, which is why
 * the checkout page renders them against the offending item rather than as a
 * banner. `error.details` does not name the line, so the cart re-reads its
 * listings after a 409 and re-derives which one is at fault.
 */
export const create = (
  ctx: RequestContext,
  body: CreateOrderBody,
  idempotencyKey: string,
): Promise<Result<OrderDetail>> =>
  request({ ...ctx, method: "POST", path: "/orders", body, idempotencyKey });

/** `GET /orders` — the caller's own orders, newest first, paginated. */
export const list = (
  ctx: RequestContext,
  query: ListOrdersQuery = {},
): Promise<Result<Order[], PaginationMeta>> =>
  request({ ...ctx, path: "/orders", query: { ...query } });

/**
 * `GET /orders/:id` — one order with its line items.
 *
 * A 404 here means "no such order **belonging to this user**". The API does not
 * distinguish someone else's order from a nonexistent one, deliberately: a 403
 * would confirm that an id belongs to somebody, which is an enumeration oracle.
 * So a 404 on this call must never be rendered as "you don't have access".
 */
export const get = (ctx: RequestContext, id: string): Promise<Result<OrderDetail>> =>
  request({ ...ctx, path: `/orders/${encodeURIComponent(id)}` });

/**
 * `POST /orders/:id/cancel` — allowed only before fulfilment begins.
 *
 * Stock goes back to the pool item by item. **This is not a refund path**: a
 * paid order that has to be reversed is handled out of band in the Paystack
 * dashboard, and there is no refund endpoint. So the button belongs on a
 * `PENDING` order and nowhere else, and `INVALID_STATUS` (a 400) means the order
 * has moved on — re-read it rather than insisting.
 */
export const cancel = (ctx: RequestContext, id: string): Promise<Result<OrderDetail>> =>
  request({ ...ctx, method: "POST", path: `/orders/${encodeURIComponent(id)}/cancel` });

/** Whether a checkout failure is about one cart line rather than the account. */
export const isLineItemProblem = (error: ApiError): boolean =>
  error.kind === "http" &&
  (error.status === 409 || error.code === "LISTING_NOT_FOUND");

/** The 403 the checkout page turns into a "confirm your email" gate with a resend. */
export const isEmailUnverified = (error: ApiError): boolean =>
  error.kind === "http" && error.code === "EMAIL_NOT_VERIFIED";
