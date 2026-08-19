import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin, Package } from "lucide-react";
import { ErrorState } from "@/components/feedback";
import { FormBanner } from "@/components/forms";
import { Badge, Card } from "@/components/primitives";
import { ctxFor, orders, requireSession } from "@/lib/auth";
import { formatMoney, parseMoney } from "@/lib/money";
import {
  FULFILLMENT_STATUS,
  ORDER_STATUS,
  formatDateTime,
  groupByVendor,
  isCancellable,
  isPayable,
} from "@/lib/orders-view";
import { OrderActions } from "./OrderActions";

/**
 * One order.
 *
 * ## Items are grouped by seller, and that is the whole design of this page
 *
 * A Rimalis order can span several vendors, and each fulfils independently: one
 * parcel can be delivered while another has not been packed. The API models this
 * as a per-item `fulfillmentStatus` with the order's own status as a rollup. A
 * flat list of items with one status at the top would be actively misleading —
 * it would say "being prepared" to someone whose first parcel arrived yesterday.
 *
 * ## Item names come from the snapshot, never from the catalogue
 *
 * `productNameSnapshot` and `productSkuSnapshot` are frozen at order time. The
 * product may since have been renamed, withdrawn or deleted, and a receipt that
 * changes its own contents when an admin edits the catalogue is not a record of
 * anything. There is no live product link on these rows for the same reason: the
 * listing behind it may no longer exist, and a 404 from your own order history
 * is worse than no link.
 *
 * ## A 404 here means "not yours", and must not say so
 *
 * The API answers 404 for an order belonging to someone else, deliberately — a
 * 403 would confirm that the id exists, which is an enumeration oracle. So this
 * page renders the ordinary not-found for both cases and never says "you don't
 * have access to this order".
 */

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { orderId } = await params;
  const { payment } = await searchParams;
  const session = await requireSession(`/account/orders/${orderId}`);

  const result = await orders.get(ctxFor(session), orderId);

  if (!result.ok) {
    // A malformed id is a 400 from the API's validation; a well-formed id that
    // matches nothing (or is somebody else's) is a 404. Both mean the same thing
    // to a shopper. A transport failure is a different thing entirely and gets
    // a retryable error state rather than "no such order".
    if (result.error.kind === "http" && (result.error.status === 404 || result.error.status === 400)) {
      notFound();
    }
    return <ErrorState error={result.error} title="We couldn't load this order" />;
  }

  const order = result.data;
  const status = ORDER_STATUS[order.status];
  const groups = groupByVendor(order);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href="/account/orders"
          prefetch={false}
          className="inline-flex min-h-11 w-fit items-center gap-2 text-caption text-ink-muted hover:text-ink"
        >
          <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
          All orders
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-heading text-ink">Order #{order.id.slice(0, 8)}</h1>
            <p className="text-caption text-ink-muted">
              Placed {formatDateTime(order.createdAt)}
            </p>
          </div>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>

        <p className="text-body text-ink-muted">{status.detail}</p>
      </div>

      {/* `?payment=failed` is set when initialising the charge failed after the
          order was created. The order is fine — say so, because arriving at an
          order page straight from a checkout button looks like the order failed. */}
      {payment === "failed" && isPayable(order) && (
        <FormBanner tone="error">
          Your order was created, but we couldn&rsquo;t start the payment. Nothing has been
          charged — try again below.
        </FormBanner>
      )}

      <OrderActions
        orderId={order.id}
        payable={isPayable(order)}
        cancellable={isCancellable(order)}
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-section text-ink">
          {groups.length > 1 ? `${groups.length} sellers` : "Items"}
        </h2>

        <ul className="flex flex-col gap-4">
          {groups.map((group, index) => (
            <Card key={group.vendorId} as="li" tone="flat" padding="md">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider pb-3">
                  <div className="flex items-center gap-2">
                    <Package className="size-4 text-ink-muted" strokeWidth={1.75} aria-hidden />
                    <span className="text-caption font-semibold text-ink">
                      {/* Sellers are numbered rather than named: an order item
                          carries `vendorId` and the frozen product snapshots,
                          not a store name, and fetching one vendor per group
                          would turn this page into N+1 requests for a label. */}
                      {groups.length > 1 ? `Seller ${index + 1} of ${groups.length}` : "Your items"}
                    </span>
                  </div>
                  <Badge>{FULFILLMENT_STATUS[group.status]}</Badge>
                </div>

                <ul className="flex flex-col gap-3">
                  {group.items.map((item) => (
                    <li key={item.id} className="flex flex-wrap justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-body text-ink">{item.productNameSnapshot}</span>
                        <span className="font-mono text-meta text-ink-subtle">
                          {item.productSkuSnapshot} · {item.quantity} ×{" "}
                          {formatMoney(item.unitPrice)}
                        </span>
                      </div>
                      <span className="text-body text-ink">{formatMoney(item.totalPrice)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-section text-ink">Payment</h2>
        <Card tone="flat" padding="md">
          <dl className="flex flex-col gap-3">
            <Row label="Subtotal" value={formatMoney(order.subtotal)} />
            <Row label="Delivery" value={formatMoney(order.shippingTotal)} />
            {/* Only shown when there is one. A permanent "Discount ₦0.00" row is
                noise on every order for the sake of the rare one.

                Parsed rather than compared as a string: `Money` strips trailing
                zeros, so zero can arrive as `"0"` or `"0.00"` and
                `discountTotal !== "0"` would render a zero discount row for one
                of them. The types module says never to compare two of these for
                equality, and this is exactly why. */}
            {parseMoney(order.discountTotal) > 0 && (
              <Row label="Discount" value={`−${formatMoney(order.discountTotal)}`} />
            )}
            <div className="flex items-baseline justify-between gap-4 border-t border-divider pt-3">
              <dt className="text-body font-medium text-ink">Total</dt>
              <dd className="text-section text-ink">{formatMoney(order.grandTotal)}</dd>
            </div>
            {order.paymentRef && (
              <Row label="Reference" value={order.paymentRef} mono />
            )}
          </dl>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-section text-ink">Delivery</h2>
        <Card tone="flat" padding="md" className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <MapPin className="mt-1 size-4 shrink-0 text-ink-muted" strokeWidth={1.75} aria-hidden />
            {order.address ? (
              <p className="text-body text-ink">
                {order.address.street}, {order.address.city}, {order.address.state}
                {order.address.postalCode ? ` ${order.address.postalCode}` : ""} ·{" "}
                {order.address.country}
              </p>
            ) : (
              // The API does NOT snapshot the address — it is a live relation
              // that goes null when the shopper deletes it. Saying so is better
              // than an empty panel that looks like a rendering fault.
              <p className="text-body text-ink-muted">
                The address for this order has since been deleted from your account.
              </p>
            )}
          </div>

          {order.notes && (
            <p className="whitespace-pre-line border-t border-divider pt-3 text-caption text-ink-muted">
              {order.notes}
            </p>
          )}
        </Card>
      </section>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-caption text-ink-muted">{label}</dt>
      <dd className={mono ? "font-mono text-meta text-ink-subtle" : "text-caption text-ink"}>
        {value}
      </dd>
    </div>
  );
}
