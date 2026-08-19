import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminOrderDetail } from "@rimalis/types";
import { Badge, Card } from "@/components/primitives";
import { ErrorState } from "@/components/feedback";
import { admin, ctxFor, requireAdmin } from "@/lib/auth";
import { isMissing } from "@/lib/errors";
import {
  absoluteDateTime,
  badgeTone,
  fulfillmentStatus,
  shortRef,
} from "@/lib/format";
import { adminOrderStatus } from "@/components/admin";
import { formatMoney, formatNaira, parseMoney, sum } from "@/lib/money";

export const metadata: Metadata = { title: "Order" };

/**
 * One order in full: who bought it, what they paid, and how it splits.
 *
 * ## Why the lines are grouped by vendor
 *
 * This is the only view on the platform that sees a whole multi-vendor order. A
 * vendor's own order screen has other vendors' lines stripped out by the API before
 * they leave the server, and a shopper sees one basket. So the question this screen
 * exists to answer — "who is owed what out of this payment" — cannot be asked
 * anywhere else, and a flat list of lines does not answer it.
 *
 * Grouping also makes the Paystack split legible: one subtotal per vendor is one
 * entry in the split that was sent at charge time.
 *
 * ## The money identity worth trusting, and the one that is not
 *
 * `commissionAmount + vendorPayout === totalPrice` holds unconditionally per line —
 * it is the identity the Paystack split depends on. `marginAmount − commissionAmount`
 * versus `vendorPayout − totalCost` does NOT reconcile when the margin floor
 * engages (a product repriced below its cost), so it is deliberately not shown as
 * a derived figure. Every number here is read from the snapshot rather than
 * recomputed.
 *
 * ## Snapshots, not live prices
 *
 * `productNameSnapshot`, `unitPrice`, `commissionRate` and the rest were frozen at
 * checkout, precisely so commission stays auditable after an admin reprices the
 * product. Showing today's catalogue name next to a historical price would make
 * this screen lie about what was actually sold.
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const { session } = await requireAdmin(`/orders/${orderId}`);

  const result = await admin.getOrder(ctxFor(session), orderId);

  if (!result.ok) {
    if (isMissing(result.error)) notFound();
    return <ErrorState error={result.error} title="Couldn't load this order" />;
  }

  const order = result.data;
  const status = adminOrderStatus(order.status);
  const byVendor = groupByVendor(order);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/orders"
          prefetch={false}
          className="w-fit text-meta text-ink-muted underline decoration-divider-strong underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          ← All orders
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-heading font-semibold tracking-tight">
            {shortRef(order.id)}
          </h1>
          <Badge tone={badgeTone(status.tone)}>{status.label}</Badge>
        </div>
        <p className="text-body text-ink-muted">
          {absoluteDateTime(order.createdAt)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="mb-4 text-section font-semibold">Customer</h2>
          <dl className="flex flex-col gap-3">
            <Row
              label="Name"
              value={`${order.customer.firstName} ${order.customer.lastName}`.trim()}
            />
            <Row label="Email" value={order.customer.email} />
            <div className="pt-1">
              <Link
                href={`/users/${order.customer.id}`}
                prefetch={false}
                className="text-caption underline decoration-divider-strong underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Manage this account
              </Link>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-4 text-section font-semibold">Delivery</h2>
          {order.address === null ? (
            <p className="text-caption text-ink-muted">
              No address on this order.
            </p>
          ) : (
            <address className="flex flex-col gap-0.5 text-caption not-italic">
              <span>{order.address.street}</span>
              <span>
                {order.address.city}, {order.address.state}
              </span>
              <span className="text-ink-muted">{order.address.country}</span>
            </address>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-section font-semibold">Payment</h2>
          {order.payment === null ? (
            <p className="text-caption text-ink-muted">
              {/* Not an error: a PENDING order legitimately has no payment row
                  until Paystack is initialised. */}
              No payment recorded — this order was never taken to Paystack.
            </p>
          ) : (
            <dl className="flex flex-col gap-3">
              <Row label="Provider" value={order.payment.provider} />
              <Row label="Reference" value={order.payment.reference} mono />
              <Row label="Amount" value={formatMoney(order.payment.amount)} />
              <Row label="Status" value={order.payment.status} />
              <Row
                label="Paid"
                value={
                  order.payment.paidAt === null
                    ? null
                    : absoluteDateTime(order.payment.paidAt)
                }
              />
            </dl>
          )}
        </Card>
      </div>

      <Card padding="none">
        <div className="border-b border-divider px-5 py-4">
          <h2 className="text-section font-semibold">
            Lines, by vendor
          </h2>
          <p className="mt-1 text-meta text-ink-subtle">
            Prices, costs and the commission rate are snapshots taken at checkout —
            not today&apos;s catalogue values. Per line,
            commission + payout equals the line total exactly.
          </p>
        </div>

        <div className="divide-y divide-divider">
          {byVendor.map((group) => (
            <div key={group.vendorId} className="px-5 py-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  href={`/vendors/${group.vendorId}`}
                  prefetch={false}
                  className="text-caption font-semibold underline decoration-divider-strong underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  {shortRef(group.vendorId)}
                </Link>
                <span className="text-meta text-ink-subtle">
                  {/* `formatNaira`, not `formatMoney`: these are summed `Minor`
                      kobo integers, not decimal strings off the wire. The branded
                      type is what makes passing the wrong one a compile error
                      rather than a figure that is out by a factor of 100. */}
                  Owed {formatNaira(group.payout)} · platform{" "}
                  {formatNaira(group.commission)}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="text-meta uppercase tracking-wide text-ink-muted">
                      <th scope="col" className="py-1 pr-4 font-medium">Product</th>
                      <th scope="col" className="py-1 pr-4 text-right font-medium">Qty</th>
                      <th scope="col" className="py-1 pr-4 text-right font-medium">Line</th>
                      <th scope="col" className="hidden py-1 pr-4 text-right font-medium md:table-cell">Cost</th>
                      <th scope="col" className="hidden py-1 pr-4 text-right font-medium md:table-cell">Rate</th>
                      <th scope="col" className="py-1 pr-4 text-right font-medium">Platform</th>
                      <th scope="col" className="py-1 text-right font-medium">Vendor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {group.items.map((item) => {
                      const fulfilment = fulfillmentStatus(item.fulfillmentStatus);
                      return (
                        <tr key={item.id} className="text-caption">
                          <td className="py-2 pr-4">
                            <span className="flex flex-col">
                              {item.productNameSnapshot}
                              <span className="font-mono text-meta text-ink-subtle">
                                {item.productSkuSnapshot} ·{" "}
                                {fulfilment.label}
                              </span>
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">{item.quantity}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(item.totalPrice)}</td>
                          <td className="hidden py-2 pr-4 text-right tabular-nums md:table-cell">{formatMoney(item.totalCost)}</td>
                          <td className="hidden py-2 pr-4 text-right tabular-nums md:table-cell">
                            {/* The rate this line was actually charged, not the
                                vendor's rate today. */}
                            {/* One expression, not a value followed by a literal
                                `%` — JSX turns the newline between them into a
                                space and renders "10 %". */}
                            {`${String(Number((item.commissionRate * 100).toFixed(2)))}%`}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(item.commissionAmount)}</td>
                          <td className="py-2 text-right tabular-nums">{formatMoney(item.vendorPayout)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <dl className="flex flex-col gap-2 border-t border-divider bg-canvas px-5 py-4">
          <Total label="Subtotal" value={order.subtotal} />
          <Total label="Shipping" value={order.shippingTotal} />
          <Total label="Discount" value={order.discountTotal} />
          <Total label="Total" value={order.grandTotal} strong />
        </dl>
      </Card>
    </div>
  );
}

/**
 * Lines grouped by vendor, with each vendor's share summed.
 *
 * Sums through `parseMoney`/`sum` — the branded kobo integer helpers — rather than
 * `parseFloat`. A `Money` is a decimal string with trailing zeros stripped, so
 * `"175000"` and `"175000.00"` are the same amount and `!==`, and float addition of
 * money reintroduces the drift the API's Decimal columns exist to prevent.
 */
function groupByVendor(order: AdminOrderDetail) {
  const groups = new Map<string, AdminOrderDetail["items"]>();
  for (const item of order.items) {
    const existing = groups.get(item.vendorId);
    if (existing) existing.push(item);
    else groups.set(item.vendorId, [item]);
  }
  return [...groups.entries()].map(([vendorId, items]) => ({
    vendorId,
    items,
    payout: sum(...items.map((i) => parseMoney(i.vendorPayout))),
    commission: sum(...items.map((i) => parseMoney(i.commissionAmount))),
  }));
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-meta text-ink-subtle">{label}</dt>
      <dd className={`text-caption text-ink${mono ? " font-mono" : ""}`}>
        {value === null || value === "" ? (
          <span className="text-ink-subtle">—</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function Total({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={`text-caption${strong ? " font-semibold" : " text-ink-muted"}`}>
        {label}
      </dt>
      <dd
        className={`text-caption tabular-nums${strong ? " font-semibold" : " text-ink"}`}
      >
        {formatMoney(value)}
      </dd>
    </div>
  );
}
