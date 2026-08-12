import "server-only";

import type { VendorOrder } from "@rimalis/types";
import { ZERO, parseMoney, sum, type Minor } from "./money";

/**
 * The dashboard's numbers, derived from the order list.
 *
 * ## ⚠️ There is no analytics endpoint, and this is not one
 *
 * The API has no aggregate for "sales today" or "sales per day". So these figures
 * are computed here from **one page of recent orders**, and that has consequences
 * a caller must not paper over:
 *
 * - **The window is bounded by `SAMPLE_SIZE`, not by time.** A vendor doing more
 *   than 200 orders a week will have their earliest days truncated, and the chart
 *   would understate those days while looking perfectly plausible. `truncated`
 *   below says when that happened, and the UI must show it — a quietly wrong
 *   total is worse than a visibly incomplete one.
 * - **It is one request, not seven.** Fetching per-day would multiply the round
 *   trips and still not fix the bound.
 * - **It is not the vendor's ledger.** For money actually settled, use
 *   `GET /vendor/payouts/summary`. These figures are an operational read on recent
 *   trading, and the labels in the UI say so.
 *
 * The right fix is a `GET /vendor/stats` on the API. Until then this is honest
 * arithmetic over a stated window, which is a different thing from a guess.
 *
 * ## What counts as a sale
 *
 * Only orders that have been **paid**: `PAID`, `PROCESSING`, `SHIPPED`,
 * `DELIVERED`. Excluded, deliberately:
 *
 * - `PENDING` — the order exists and stock is held, but nobody has paid. Counting
 *   it inflates today's sales with money that may never arrive, and abandoned
 *   unpaid orders are swept and cancelled nightly.
 * - `CANCELLED` / `REFUNDED` — reversed. Counting them overstates a bad week as a
 *   good one.
 *
 * ## Revenue vs earnings, which are not the same number
 *
 * `revenue` sums `items[].totalPrice` — what this vendor's goods sold for.
 * `earnings` sums `items[].vendorPayout` — what is left after commission. Both are
 * per-item and therefore correctly scoped to this vendor.
 *
 * **`order.grandTotal` is never used here.** On a multi-vendor order it includes
 * another seller's takings, so a dashboard built on it would credit this vendor
 * with money that was never theirs. That is the single most likely way to get this
 * file wrong.
 */

/**
 * How many recent orders to read. One page, and the API caps `limit` — 100 is
 * within it and covers a realistic week for this market with room to spare.
 */
export const SAMPLE_SIZE = 100;

/** Statuses that mean money changed hands. See the module header. */
const PAID_STATUSES = new Set(["PAID", "PROCESSING", "SHIPPED", "DELIVERED"]);

/** Days shown in the chart, matching the design's S–S week. */
export const CHART_DAYS = 7;

export interface DayBucket {
  /** Local calendar date, `YYYY-MM-DD` in Africa/Lagos. */
  date: string;
  /** Single letter for the axis — S M T W T F S. */
  initial: string;
  /** Full name, for the tooltip and the table view. */
  weekday: string;
  revenue: Minor;
  units: number;
  orders: number;
  /** The last bucket. Rendered in the accent while the rest are de-emphasised. */
  isToday: boolean;
}

export interface DashboardStats {
  /** Paid sales value of this vendor's goods, today. */
  todayRevenue: Minor;
  /** Units of this vendor's goods in paid orders, today. */
  todayUnits: number;
  /** Paid orders containing this vendor's goods, today. */
  todayOrders: number;
  /** Last 7 calendar days, oldest first. Always exactly `CHART_DAYS` long. */
  week: DayBucket[];
  /** Sum of `week`. */
  weekRevenue: Minor;
  /** The 7 days before `week`, for the comparison. */
  previousWeekRevenue: Minor;
  /**
   * Percentage change week over week, or `null` when the previous week is zero.
   *
   * `null` rather than 0 or Infinity: going from ₦0 to ₦50,000 is not "+100%",
   * it is a first sale, and rendering a percentage there is arithmetic dressed up
   * as insight. The UI shows "no comparison yet" instead.
   */
  weekChangePercent: number | null;
  /** Lines still to pick or pack across all paid orders in the sample. */
  outstandingLines: number;
  /**
   * True when the sample filled up, so the earliest days may be incomplete.
   * The UI MUST surface this — see the module header.
   */
  truncated: boolean;
}

/**
 * `YYYY-MM-DD` for an instant, in Lagos.
 *
 * `en-CA` because it formats as `2026-08-12` natively, which sorts lexically and
 * needs no manual zero-padding. The timezone is explicit: a Worker runs in UTC,
 * so an order placed at 00:30 Lagos would otherwise land in the previous day's
 * bucket — wrong in a way nobody notices until a vendor disputes a daily total.
 */
const LAGOS_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Lagos",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dayKey = (date: Date): string => LAGOS_DAY.format(date);

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The weekday of a `YYYY-MM-DD` key.
 *
 * Parsed as UTC noon rather than midnight. Midnight-UTC on a date string is a
 * real hazard: for a positive-offset zone it is still the previous evening
 * locally, so the weekday comes out one day early. Noon has twelve hours of slack
 * in both directions and cannot be pushed over a boundary by any real offset.
 */
function weekdayOf(key: string): { initial: string; weekday: string } {
  const index = new Date(`${key}T12:00:00Z`).getUTCDay();
  const weekday = WEEKDAYS[index] ?? "";
  return { initial: weekday.slice(0, 1), weekday };
}

/** The `YYYY-MM-DD` key `offset` days before `from`. */
function shiftDay(from: Date, offset: number): string {
  const shifted = new Date(from);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return dayKey(shifted);
}

interface Totals {
  revenue: Minor;
  units: number;
  orders: number;
}

/**
 * Sums one order's lines. Only this vendor's items are present — the API filtered
 * them — so no per-item vendor check is needed or possible.
 */
function totalsOf(order: VendorOrder): { revenue: Minor; units: number } {
  return {
    revenue: sum(...order.items.map((item) => parseMoney(item.totalPrice))),
    units: order.items.reduce((count, item) => count + item.quantity, 0),
  };
}

/**
 * Builds every figure the dashboard shows from one page of orders.
 *
 * Pure and synchronous: the fetch belongs to the page, so this stays testable and
 * so a page can decide what to do about a failure rather than having a thrown
 * error decided for it here.
 *
 * @param orders one page of `GET /vendor/orders`, any status, newest first
 * @param now injectable for tests; defaults to the request's clock
 */
export function deriveStats(orders: readonly VendorOrder[], now = new Date()): DashboardStats {
  const today = dayKey(now);

  // Fourteen buckets: seven for the chart and seven behind it for the comparison.
  const buckets = new Map<string, Totals>();
  for (let offset = -(CHART_DAYS * 2 - 1); offset <= 0; offset += 1) {
    buckets.set(shiftDay(now, offset), { revenue: ZERO, units: 0, orders: 0 });
  }

  let outstandingLines = 0;

  for (const order of orders) {
    // Outstanding work is counted across every paid order in the sample, not only
    // this fortnight: a line from three weeks ago that was never shipped is
    // precisely the thing a vendor needs shouted at them, and dropping it because
    // it fell outside the chart window would hide the worst case.
    if (PAID_STATUSES.has(order.status)) {
      outstandingLines += order.items.filter(
        (item) => item.fulfillmentStatus === "PENDING" || item.fulfillmentStatus === "PROCESSING",
      ).length;
    }

    if (!PAID_STATUSES.has(order.status)) continue;

    const bucket = buckets.get(dayKey(new Date(order.createdAt)));
    if (!bucket) continue; // Older than the fortnight — outside every figure below.

    const { revenue, units } = totalsOf(order);
    bucket.revenue = sum(bucket.revenue, revenue);
    bucket.units += units;
    bucket.orders += 1;
  }

  const week: DayBucket[] = [];
  for (let offset = -(CHART_DAYS - 1); offset <= 0; offset += 1) {
    const date = shiftDay(now, offset);
    const totals = buckets.get(date) ?? { revenue: ZERO, units: 0, orders: 0 };
    week.push({
      date,
      ...weekdayOf(date),
      revenue: totals.revenue,
      units: totals.units,
      orders: totals.orders,
      isToday: date === today,
    });
  }

  const previous: Minor[] = [];
  for (let offset = -(CHART_DAYS * 2 - 1); offset <= -CHART_DAYS; offset += 1) {
    previous.push(buckets.get(shiftDay(now, offset))?.revenue ?? ZERO);
  }

  const weekRevenue = sum(...week.map((day) => day.revenue));
  const previousWeekRevenue = sum(...previous);
  const todayBucket = week[week.length - 1];

  return {
    todayRevenue: todayBucket?.revenue ?? ZERO,
    todayUnits: todayBucket?.units ?? 0,
    todayOrders: todayBucket?.orders ?? 0,
    week,
    weekRevenue,
    previousWeekRevenue,
    weekChangePercent:
      previousWeekRevenue === 0
        ? null
        : Math.round(((weekRevenue - previousWeekRevenue) / previousWeekRevenue) * 100),
    outstandingLines,
    truncated: orders.length >= SAMPLE_SIZE,
  };
}
