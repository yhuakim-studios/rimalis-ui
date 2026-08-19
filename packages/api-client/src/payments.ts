import type { Payment, PaymentInit } from "@rimalis/types";
import { request, type RequestContext } from "./http";
import type { ApiError, Result } from "./result";

/**
 * Paystack, through the API. The marketplace never talks to Paystack directly.
 *
 * ## The money is split at initialisation, not settled later
 *
 * The charge is created with a Paystack **subaccount split** built from each
 * order item's snapshotted `vendorPayout`. Every vendor is paid by Paystack at
 * the moment the customer pays and the platform keeps the remainder; there is no
 * later transfer to trigger. That is why `initialize` fails when any vendor in
 * the order has no payout destination — the split literally cannot be
 * constructed — and why that failure is not the shopper's fault and must not be
 * worded as though it were.
 */

/**
 * `POST /payments/initialize` — start a charge, get somewhere to send the shopper.
 *
 * ## Do not mark anything paid off the back of this, or off the callback
 *
 * Neither proves payment. The response only means Paystack accepted the charge
 * request; the shopper returning to `callbackUrl` only means a browser came
 * back. **The webhook settles it**, server-side, and it may land a moment after
 * the redirect. So the callback page polls `getStatus` and shows a pending state
 * in the meantime rather than congratulating anyone early.
 *
 * ## Not retried, by anything
 *
 * `http.ts` retries GETs only, and this endpoint has no idempotency guard at
 * all — a second initialisation is a second Paystack transaction. If it fails,
 * the shopper's order still exists as `PENDING` and the honest recovery is a
 * "Retry payment" button on the order, which is a deliberate second attempt
 * rather than an automatic one.
 *
 * @param callbackUrl absolute, from the app's own `APP_ORIGIN`. See the DTO for
 *   why this must not be derived from the request's `Host`, and why the session
 *   cookie has to be `SameSite=Lax` for the return trip to arrive signed in.
 */
export const initialize = (
  ctx: RequestContext,
  orderId: string,
  callbackUrl?: string,
): Promise<Result<PaymentInit>> =>
  request({
    ...ctx,
    method: "POST",
    path: "/payments/initialize",
    body: { orderId, ...(callbackUrl !== undefined ? { callbackUrl } : {}) },
  });

/**
 * `GET /payments/:orderId` — poll this after the shopper returns.
 *
 * `PENDING` is the expected first answer and does not mean anything went wrong;
 * it means the webhook has not arrived yet. A **404** is likewise not an error
 * state for a fresh return — it means no payment row exists for that order,
 * which happens if the shopper abandoned the Paystack page before it was
 * created. Treat both as "keep waiting, then offer to retry", not as failure.
 */
export const getStatus = (ctx: RequestContext, orderId: string): Promise<Result<Payment>> =>
  request({ ...ctx, path: `/payments/${encodeURIComponent(orderId)}` });

/**
 * A vendor in this order has no payout destination configured.
 *
 * Worth its own copy: nothing the shopper can do resolves it, so the UI must
 * point at support rather than offering a Try again that will fail identically
 * forever.
 */
export const isVendorPayoutMissing = (error: ApiError): boolean =>
  error.kind === "http" && error.code === "VENDOR_PAYOUT_NOT_CONFIGURED";

/** The order was already paid, or has moved past the payable states. */
export const isNotPayable = (error: ApiError): boolean =>
  error.kind === "http" &&
  (error.code === "ALREADY_PAID" || error.code === "INVALID_ORDER_STATUS");
