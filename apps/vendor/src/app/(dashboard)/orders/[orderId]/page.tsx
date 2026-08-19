import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { ErrorState } from "@/components/feedback";
import { FulfilButton } from "@/components/orders";
import { Badge, Card } from "@/components/primitives";
import { ctxFor, requireApprovedVendor, vendor as vendorApi } from "@/lib/auth";
import {
  absoluteDateTime,
  badgeTone,
  destination,
  fulfillmentStatus,
  orderStatus,
  shortRef,
} from "@/lib/format";
import { formatMoney, formatNaira, parseMoney, sum } from "@/lib/money";

export const metadata: Metadata = { title: "Order" };

/**
 * One order, this vendor's lines only.
 *
 * ## The money shown here is deliberately not the order's total
 *
 * `order.grandTotal` exists on the response and is **never rendered**. On an order
 * shared with another seller it includes their takings, so showing it to this vendor
 * would credit them with money that was never theirs — and they would reconcile
 * against it. Every figure on this page is summed from `items[]`, which the API has
 * already filtered to this vendor.
 *
 * Three totals, because they answer three different questions:
 *
 *   goods sold    sum(totalPrice)      what the shopper paid for these lines
 *   commission    sum(commissionAmount) what the platform kept
 *   your payout   sum(vendorPayout)     what reached this vendor's bank
 *
 * All three come from **snapshots taken at order time**, not from live listing
 * prices, so an order's figures never change when a vendor reprices a listing.
 *
 * ## A 404 here is not "access denied"
 *
 * The API answers 404 for an order that exists but belongs to another vendor, and it
 * does so on purpose — a 403 would confirm that an id is real, which is an
 * enumeration oracle. So this must render as "not found" and must never say anything
 * about permissions.
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const { session } = await requireApprovedVendor(`/orders/${orderId}`);

  const result = await vendorApi.getOrder(ctxFor(session), orderId);

  if (!result.ok) {
    // 404 and 400 both mean "no such order for you" — a malformed uuid is a 400 and
    // is just as absent. Anything else is our problem and gets a retryable error.
    if (result.error.kind === "http" && (result.error.status === 404 || result.error.status === 400)) {
      notFound();
    }
    return (
      <Card padding="lg">
        <ErrorState error={result.error} title="We couldn't load this order" />
      </Card>
    );
  }

  const order = result.data;
  const status = orderStatus(order.status);
  const where = destination(order.address);

  const goods = sum(...order.items.map((item) => parseMoney(item.totalPrice)));
  const commission = sum(...order.items.map((item) => parseMoney(item.commissionAmount)));
  const payout = sum(...order.items.map((item) => parseMoney(item.vendorPayout)));

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/orders"
        prefetch={false}
        className="inline-flex w-fit items-center gap-1.5 rounded-input px-1 text-caption text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
        All orders
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-heading font-semibold tracking-tight tabular-nums">
            {shortRef(order.id)}
          </h1>
          <Badge tone={badgeTone(status.tone)}>{status.label}</Badge>
        </div>
        <p className="text-caption text-ink-muted">Placed {absoluteDateTime(order.createdAt)}</p>
      </header>

      {order.status === "PENDING" && (
        <Card tone="flat" className="border-divider-strong bg-canvas">
          <p className="text-caption text-ink-muted">
            <span className="font-semibold text-ink">This order has not been paid yet.</span> Don't
            pack or ship anything — stock is held, but the money has not arrived, and unpaid orders
            are cancelled automatically. Fulfilment opens once payment clears.
          </p>
        </Card>
      )}

      {where && (
        <div className="flex items-center gap-2 text-caption text-ink-muted">
          <MapPin className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          <span>
            Shipping to {where}
            {/* The full street address is not on the wire for a vendor path, by
                design — so this says what it can and does not pretend to be a
                packing slip. */}
            <span className="text-ink-subtle"> · full address is not shared</span>
          </span>
        </div>
      )}

      <Card padding="none">
        <h2 className="px-4 pt-4 text-caption font-semibold md:px-6 md:pt-6">
          Your lines on this order
        </h2>

        <ul className="mt-2 divide-y divide-divider">
          {order.items.map((item) => {
            const lineStatus = fulfillmentStatus(item.fulfillmentStatus);

            return (
              <li key={item.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-start md:px-6">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {/*
                    The SNAPSHOT name and SKU, never a live product lookup. A
                    historical order that changes its own contents when an admin
                    renames a product is not a record of anything.
                  */}
                  <p className="text-caption font-semibold">{item.productNameSnapshot}</p>
                  <p className="text-meta text-ink-subtle tabular-nums">
                    {item.productSkuSnapshot} · {item.quantity} ×{" "}
                    {formatMoney(item.unitPrice)}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={badgeTone(lineStatus.tone)}>{lineStatus.label}</Badge>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
                  <span className="text-caption font-semibold tabular-nums">
                    {formatMoney(item.totalPrice)}
                  </span>
                  <span className="text-meta text-ink-subtle tabular-nums">
                    you keep {formatMoney(item.vendorPayout)}
                  </span>

                  {/*
                    Fulfilment is only offered on a paid order. The API enforces it
                    too — a transition on a non-PAID order is a 400 — but hiding a
                    button that cannot work is better than explaining why it failed.
                  */}
                  {order.status !== "PENDING" &&
                    order.status !== "CANCELLED" &&
                    order.status !== "REFUNDED" && (
                      <FulfilButton
                        orderId={order.id}
                        itemId={item.id}
                        current={item.fulfillmentStatus}
                      />
                    )}
                </div>
              </li>
            );
          })}
        </ul>

        <dl className="flex flex-col gap-2 border-t border-divider px-4 py-4 md:px-6">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-caption text-ink-muted">Your goods sold for</dt>
            <dd className="text-caption tabular-nums">{formatNaira(goods)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-caption text-ink-muted">Platform commission</dt>
            <dd className="text-caption tabular-nums text-ink-muted">−{formatNaira(commission)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-divider pt-2">
            <dt className="text-caption font-semibold">Your payout</dt>
            <dd className="text-caption font-semibold tabular-nums">{formatNaira(payout)}</dd>
          </div>
        </dl>

        <p className="border-t border-divider px-4 py-3 text-meta text-ink-subtle md:px-6">
          Your share was sent to your bank at the moment the shopper paid — Paystack splits each
          charge automatically. The Payouts page lists those settlements.
        </p>
      </Card>
    </div>
  );
}
