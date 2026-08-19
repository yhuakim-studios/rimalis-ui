import type { FulfillmentStatus, OrderDetail, OrderStatus } from "@rimalis/types";

/**
 * How an order is described to the shopper.
 *
 * The API's status vocabulary is operational — `PENDING` means "awaiting
 * payment", which a shopper reads as "we're thinking about it". Every string a
 * customer sees is chosen here so the two never disagree across the three pages
 * that render an order.
 */

/** Tone maps onto `<Badge>`'s three variants and nothing else. */
export interface StatusView {
  label: string;
  tone: "neutral" | "brand" | "danger";
  /** One sentence saying what it means and what happens next. */
  detail: string;
}

export const ORDER_STATUS: Record<OrderStatus, StatusView> = {
  PENDING: {
    label: "Awaiting payment",
    tone: "danger",
    // `danger` rather than neutral on purpose: this is the one status that needs
    // the shopper to do something, and an unpaid order is eventually swept and
    // cancelled by the API. Quiet grey would let it sit unnoticed.
    detail:
      "We're holding the items, but the order isn't confirmed until payment goes through.",
  },
  PAID: {
    label: "Paid",
    tone: "brand",
    detail: "Payment confirmed. The sellers have been notified and will start packing.",
  },
  PROCESSING: {
    label: "Being prepared",
    tone: "brand",
    detail: "At least one seller has started packing your order.",
  },
  SHIPPED: {
    label: "On its way",
    tone: "brand",
    detail: "Everything in this order has been dispatched.",
  },
  DELIVERED: {
    label: "Delivered",
    tone: "brand",
    detail: "All items have been marked delivered by their sellers.",
  },
  CANCELLED: {
    label: "Cancelled",
    tone: "neutral",
    detail: "This order was cancelled and the items were returned to stock.",
  },
  REFUNDED: {
    label: "Refunded",
    tone: "neutral",
    detail: "This order was refunded. Ask support if you haven't seen the money back.",
  },
};

/**
 * Per-line progress, for the multi-vendor case.
 *
 * An order split across three sellers genuinely has three answers, and the
 * order's own status is a rollup of them — so a page that showed only the rollup
 * would tell a shopper "being prepared" while two of their three parcels were
 * already out for delivery.
 */
export const FULFILLMENT_STATUS: Record<FulfillmentStatus, string> = {
  PENDING: "Not started",
  PROCESSING: "Being packed",
  SHIPPED: "Dispatched",
  DELIVERED: "Delivered",
};

/**
 * `true` when the shopper can still cancel.
 *
 * Only `PENDING`. The API allows cancellation "before fulfilment begins" and
 * there is **no refund endpoint** — a paid order that has to be reversed is
 * handled by hand in the Paystack dashboard. Offering a Cancel button on a paid
 * order would promise something the system cannot do.
 */
export const isCancellable = (order: { status: OrderStatus }): boolean =>
  order.status === "PENDING";

/** `true` when there is a charge to start or retry. */
export const isPayable = (order: { status: OrderStatus }): boolean =>
  order.status === "PENDING";

/**
 * One formatter, constructed once — the same reasoning as the money formatter.
 *
 * `en-NG` with an explicit format rather than `toLocaleDateString()` with
 * defaults: the default varies by ICU version, and "3 Aug 2026" on one page next
 * to "08/03/2026" on another reads as a bug. Explicit also settles the
 * day/month order, which is genuinely ambiguous between locales for the first
 * twelve days of any month.
 */
const DATE = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const DATE_TIME = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatDate = (iso: string): string => DATE.format(new Date(iso));
export const formatDateTime = (iso: string): string => DATE_TIME.format(new Date(iso));

/**
 * Groups an order's items by seller.
 *
 * The single most important thing an order page on a multi-vendor marketplace
 * does. Items arrive as one flat array, but they ship as one parcel per seller
 * and are fulfilled independently — so a flat list of six products with six
 * status pills is unreadable, while three groups of two with one status each is
 * the actual shape of what is happening.
 *
 * The vendor's *name* is not on an order item; the API gives `vendorId` and the
 * frozen product snapshots. So groups are keyed by id and labelled by position —
 * "Seller 1 of 3" — rather than by a name we would have to fetch per vendor and
 * that might since have changed. Honest, and it keeps the page to one request.
 */
export interface VendorGroup {
  vendorId: string;
  items: OrderDetail["items"];
  /** The group's own progress: the least advanced item in it. */
  status: FulfillmentStatus;
}

const RANK: Record<FulfillmentStatus, number> = {
  PENDING: 0,
  PROCESSING: 1,
  SHIPPED: 2,
  DELIVERED: 3,
};

export function groupByVendor(order: OrderDetail): VendorGroup[] {
  const groups = new Map<string, OrderDetail["items"]>();
  for (const item of order.items) {
    const existing = groups.get(item.vendorId);
    if (existing) existing.push(item);
    else groups.set(item.vendorId, [item]);
  }

  return [...groups.entries()].map(([vendorId, items]) => ({
    vendorId,
    items,
    // The LEAST advanced line, not the most. A parcel is not "dispatched"
    // because one of its two items is — claiming the optimistic answer is how a
    // shopper ends up waiting at a door for something still on a shelf.
    status: items.reduce<FulfillmentStatus>(
      (lowest, item) =>
        RANK[item.fulfillmentStatus] < RANK[lowest] ? item.fulfillmentStatus : lowest,
      "DELIVERED",
    ),
  }));
}
