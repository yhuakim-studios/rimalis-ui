import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Info, Package, PackageCheck, ReceiptText, Wallet } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/feedback";
import { OrderRow, SalesChart, StatTile } from "@/components/dashboard";
import { Card } from "@/components/primitives";
import { ctxFor, payouts as payoutsApi, requireApprovedVendor, vendor as vendorApi } from "@/lib/auth";
import { SAMPLE_SIZE, deriveStats } from "@/lib/dashboard";
import { compactNaira, niceTicks } from "@/lib/format";
import { formatMoney, parseMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * The dashboard.
 *
 * ## Two requests, in parallel, and no more
 *
 * `GET /vendor/orders?limit=100` and `GET /vendor/payouts/summary`. Every figure on
 * the page is derived from those — see `lib/dashboard.ts`, which explains why there
 * is arithmetic here at all (the API has no analytics endpoint) and exactly what the
 * derived numbers do and do not mean.
 *
 * `Promise.all`, so the two are one round trip's worth of latency rather than two.
 * They are independent, and neither needs the other's result.
 *
 * ⚠️ **Do not add a third call that could fail independently and be retried.** Every
 * one of these carries the same access token, and a page whose loads each retry on
 * 401 is how a single-use refresh token gets replayed — which the API treats as
 * theft and answers by revoking every session the vendor has. There is no
 * refresh-on-401 in this app for that reason; see `lib/auth.ts`.
 *
 * ## Failure is partial, on purpose
 *
 * The orders call failing means no dashboard, so that renders an `ErrorState`. The
 * payout summary failing means one tile is unavailable — the rest of the page is
 * still true and still useful, so it degrades to a dash rather than taking the
 * screen down with it.
 */
export default async function DashboardPage() {
  const { session, vendor } = await requireApprovedVendor("/");
  const ctx = ctxFor(session);

  const [ordersResult, summaryResult] = await Promise.all([
    vendorApi.listOrders(ctx, { limit: SAMPLE_SIZE }),
    payoutsApi.summary(ctx),
  ]);

  if (!ordersResult.ok) {
    return (
      <Card padding="lg">
        <ErrorState error={ordersResult.error} title="We couldn't load your orders" />
      </Card>
    );
  }

  const orders = ordersResult.data;
  const stats = deriveStats(orders);
  const ticks = niceTicks(Math.max(...stats.week.map((day) => day.revenue)));

  // Orders worth surfacing first: the ones with work outstanding. A vendor opening
  // this page wants "what do I have to do", and newest-first alone buries a
  // three-day-old unpicked line under today's delivered ones.
  const needsWork = orders
    .filter(
      (order) =>
        (order.status === "PAID" || order.status === "PROCESSING") &&
        order.items.some(
          (item) =>
            item.fulfillmentStatus === "PENDING" || item.fulfillmentStatus === "PROCESSING",
        ),
    )
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-heading font-semibold tracking-tight">Today</h1>
          <p className="text-caption text-ink-muted">
            {vendor.storeName} · trading summary
          </p>
        </div>
      </div>

      {/*
        Single column on mobile, two up from `sm`, four from `lg` — the design
        system's responsive rule. The design's horizontally-scrolling card strip was
        not carried over: a scroll container hides the cards that fall off the edge,
        and on a dashboard whose whole job is a glance, a figure you have to swipe to
        find is a figure you do not see.
      */}
      <section aria-label="Today at a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Sales today"
          value={compactNaira(stats.todayRevenue)}
          caption={stats.todayOrders === 0 ? "No orders yet today" : undefined}
          icon={<ReceiptText className="size-3.5" strokeWidth={1.75} />}
        />
        <StatTile
          label="Units today"
          value={String(stats.todayUnits)}
          caption={`across ${String(stats.todayOrders)} ${stats.todayOrders === 1 ? "order" : "orders"}`}
          icon={<Package className="size-3.5" strokeWidth={1.75} />}
        />
        <StatTile
          label="Still to fulfil"
          value={String(stats.outstandingLines)}
          caption={stats.outstandingLines === 0 ? "Nothing outstanding" : "lines to pick or pack"}
          // A rise in unfulfilled work is bad news, so the delta colouring must
          // not treat up as good. No delta is passed today, but the flag documents
          // the intent for whoever adds one.
          higherIsBetter={false}
          icon={<PackageCheck className="size-3.5" strokeWidth={1.75} />}
        />
        <StatTile
          label="Settled to date"
          // A dash, not a zero. Zero is a fact about the account; a failed request
          // is a fact about us, and rendering one as the other is how a vendor
          // concludes their money has vanished.
          value={summaryResult.ok ? compactNaira(parseMoney(summaryResult.data.lifetimeTotal)) : "—"}
          caption={summaryResult.ok ? "paid to your bank" : "unavailable right now"}
          icon={<Wallet className="size-3.5" strokeWidth={1.75} />}
        />
      </section>

      <Card padding="none" className="flex flex-col">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-4 md:px-6 md:pt-6">
          <div>
            <h2 className="text-caption font-semibold">Sales, last 7 days</h2>
            <p className="text-meta text-ink-subtle">Paid orders only, in your local time</p>
          </div>
          <div className="flex items-baseline gap-2">
            {/* The hero figure for this card. Proportional figures, not tabular —
                see the note in StatTile. */}
            <span className="text-section font-semibold tracking-tight">
              {compactNaira(stats.weekRevenue)}
            </span>
            <span className="text-meta text-ink-subtle">
              {stats.weekChangePercent === null
                ? "no comparison yet"
                : `${stats.weekChangePercent >= 0 ? "+" : "−"}${String(
                    Math.abs(stats.weekChangePercent),
                  )}% vs previous 7 days`}
            </span>
          </div>
        </div>

        <div className="px-4 py-5 md:px-6">
          <SalesChart days={stats.week} format={compactNaira} ticks={ticks} />
        </div>

        {/*
          The sample bound, stated where the numbers are. `lib/dashboard.ts` derives
          these from one page of orders, so a busy vendor's earliest days can be
          incomplete — and a quietly wrong total is worse than a visibly bounded one.
        */}
        {stats.truncated && (
          <p className="flex items-start gap-2 border-t border-divider px-4 py-3 text-meta text-ink-subtle md:px-6">
            <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            Based on your {SAMPLE_SIZE} most recent orders, so the earliest days here may be
            incomplete.
          </p>
        )}
      </Card>

      <Card padding="none" className="flex flex-col">
        <div className="flex items-center justify-between gap-4 px-4 pt-4 md:px-6 md:pt-6">
          <h2 className="text-caption font-semibold">Needs your attention</h2>
          <Link
            href="/orders"
            prefetch={false}
            className="inline-flex items-center gap-1 rounded-input px-1 text-meta font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            All orders
            <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
          </Link>
        </div>

        {needsWork.length === 0 ? (
          <EmptyState
            icon={<PackageCheck className="size-6" strokeWidth={1.5} />}
            title="Everything is packed"
            body="No orders are waiting on you. New paid orders will appear here the moment they arrive."
          />
        ) : (
          <ul className="mt-2 divide-y divide-divider">
            {needsWork.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </ul>
        )}
      </Card>

      {/*
        The one thing that silently breaks a whole store. Without a Paystack
        subaccount, `payments.service.ts` refuses to build a split and every checkout
        containing this vendor's items fails with 409
        VENDOR_PAYOUT_NOT_CONFIGURED — while the storefront still shows the listings
        as buyable. The header carries a badge; this says what to do about it.
      */}
      {vendor.paystackSubaccountCode === null && (
        <Card tone="flat" className="flex flex-col gap-3 border-danger/20 bg-danger-soft">
          <div className="flex flex-col gap-1">
            <h2 className="text-caption font-semibold text-danger">
              Nobody can buy from you yet
            </h2>
            <p className="text-caption text-danger/90">
              Your listings are visible, but checkout fails for every shopper because we have
              nowhere to send your share of the money. Add your bank details to start selling.
            </p>
          </div>
          <Link
            href="/settings"
            prefetch={false}
            className="inline-flex w-fit items-center gap-1.5 rounded-input bg-danger px-4 py-2.5 text-caption font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
          >
            Add payout details
            <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
          </Link>
        </Card>
      )}

      {/* A quiet reconciliation line, so "settled to date" has its exact figure
          somewhere without spending the tile's space on it. */}
      {summaryResult.ok && (
        <p className="px-1 text-meta text-ink-subtle">
          Settled to date: {formatMoney(summaryResult.data.lifetimeTotal)}. Counts completed
          transfers only — anything still in flight is excluded.
        </p>
      )}
    </div>
  );
}
