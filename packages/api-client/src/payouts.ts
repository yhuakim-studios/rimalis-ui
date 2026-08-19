import type {
  ListPayoutsQuery,
  PaginationMeta,
  PayoutRecord,
  PayoutSummary,
} from "@rimalis/types";
import { request, type RequestContext } from "./http";
import type { Result } from "./result";

/**
 * Settlements, read-only.
 *
 * ## Read-only is a design decision, not a missing feature
 *
 * Paystack splits every charge at payment time: each vendor's share goes
 * straight to their own subaccount as the customer pays. By the time a `Payout`
 * row exists the money has already moved. The rows are a **ledger written after
 * the fact**, created inside `markSuccess()` in the same transaction that flips
 * the payment to `SUCCESS` and the order to `PAID`.
 *
 * So there is no "request payout" endpoint here and there must never be one — it
 * would pay a vendor a second time for a charge that already settled. If a
 * vendor asks where their money is, the answer is in their Paystack subaccount,
 * and `reference` is what support looks it up by.
 *
 * ## Its own module rather than part of `vendor.ts`
 *
 * The same three endpoints are the vendor's whole earnings view, and the admin
 * has a parallel set (`/payouts`, `/payouts/:id`) over every vendor. Keeping
 * settlements together means the admin app adds two functions beside these
 * rather than importing a module named after the wrong actor.
 */

/**
 * `GET /vendor/payouts` — this vendor's settlements, newest first.
 *
 * `from`/`to` filter on the settlement **period**, not on `createdAt`. A row
 * written today can cover last week, so a date filter and a sort by creation
 * order will not agree — which is correct, and worth labelling in the UI so a
 * vendor is not left wondering why "this month" excludes a row dated today.
 */
export const list = (
  ctx: RequestContext,
  query: ListPayoutsQuery = {},
): Promise<Result<PayoutRecord[], PaginationMeta>> =>
  request({ ...ctx, path: "/vendor/payouts", query: { ...query } });

/**
 * `GET /vendor/payouts/summary` — lifetime settled total.
 *
 * ⚠️ **`COMPLETED` rows only.** Anything `PENDING` or `PROCESSING` is excluded,
 * so this is "settled to date" and not "earned to date". Labelling it "total
 * earnings" overstates it whenever a transfer is in flight, and understates the
 * business — the honest caption names settlement.
 *
 * The API documents this response as untyped; the shape comes from
 * `getSummaryForVendor` in `payouts.service.ts`. See the header of
 * `@rimalis/types`' `vendor.ts`.
 */
export const summary = (ctx: RequestContext): Promise<Result<PayoutSummary>> =>
  request({ ...ctx, path: "/vendor/payouts/summary" });

/** `GET /vendor/payouts/:id` — one settlement. 404 if it is not this vendor's. */
export const get = (ctx: RequestContext, id: string): Promise<Result<PayoutRecord>> =>
  request({ ...ctx, path: `/vendor/payouts/${encodeURIComponent(id)}` });
