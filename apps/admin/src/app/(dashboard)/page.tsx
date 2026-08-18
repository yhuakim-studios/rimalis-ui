import type { Metadata } from "next";
import {
  ClipboardList,
  Package,
  ReceiptText,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { Badge, ButtonLink, Card } from "@/components/primitives";
import { ErrorState } from "@/components/feedback";
import { StatTile } from "@/components/dashboard/StatTile";
import { admin, ctxFor, requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { pluralise, relativeTime } from "@/lib/format";
import { auditSentence } from "@/lib/audit";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * The landing page: what needs attention, then how the platform is doing.
 *
 * ## One guard, then one fan-out
 *
 * `requireAdmin()` is called ONCE and its context is threaded into a single
 * `Promise.all`. This is the page where getting that wrong is most expensive: it
 * makes three calls, and a guard per call would mean three independent chances to
 * discover the same aged-out token and three concurrent hops to
 * `/api/session/refresh` — which the API treats as a replayed refresh token and
 * answers by revoking every session the admin has. See the header of lib/auth.ts.
 *
 * ## Why the queue is above the numbers
 *
 * The KPI row is the part that looks like a dashboard, and it is the part nobody
 * can act on. A pending vendor is a person waiting; an unpublishable product is a
 * catalogue gap. Those go first, and they are only rendered when there is
 * something in them — an empty "needs attention" panel trains people to skip the
 * top of the page.
 *
 * ## Degrading rather than failing
 *
 * `/admin/stats` is the heaviest read in the API and the only call here that can
 * plausibly time out. When it fails the page still renders: the queue and the
 * activity feed come from different endpoints, and an admin who came to approve a
 * vendor should not be blocked by an aggregate query. The tiles are replaced by an
 * inline `ErrorState`, not the page.
 */
export default async function DashboardPage() {
  const { session } = await requireAdmin("/");
  const ctx = ctxFor(session);

  const [statsResult, pendingResult, activityResult] = await Promise.all([
    admin.stats(ctx),
    // `limit: 5` and we read `meta.total` for the count, so the queue panel costs
    // one request rather than a count plus a page.
    admin.listVendors(ctx, { status: "PENDING", limit: 5 }),
    admin.listAuditLogs(ctx, { limit: 6 }),
  ]);

  const pending = pendingResult.ok ? pendingResult.data : [];
  const pendingTotal = pendingResult.ok ? (pendingResult.meta?.total ?? 0) : 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-heading font-semibold tracking-tight">Dashboard</h1>
          <p className="text-body text-ink-muted">
            {statsResult.ok
              ? `Figures as of ${relativeTime(statsResult.data.generatedAt)}. Cached for a minute.`
              : "Platform overview."}
          </p>
        </div>

        {pendingTotal > 0 && (
          <ButtonLink href="/vendors?status=PENDING" prefetch={false}>
            Review {pluralise(pendingTotal, "application")}
          </ButtonLink>
        )}
      </div>

      {/* ── Needs attention ───────────────────────────────────────────── */}
      {pendingTotal > 0 && (
        <Card padding="none">
          <div className="flex items-center gap-2 border-b border-divider px-5 py-4">
            <Store className="size-4 text-ink-muted" strokeWidth={1.75} aria-hidden />
            <h2 className="text-caption font-semibold">Waiting for approval</h2>
            <Badge tone="strong">{pendingTotal}</Badge>
          </div>

          {/*
            A row-list, not a Table — see the header of primitives/Table.tsx. Each
            row here is a narrative ("this store, applied then, by this person"),
            and there is nothing to compare down a column.
          */}
          <ul className="divide-y divide-divider">
            {pending.map((vendor) => (
              <li key={vendor.id}>
                <Link
                  href={`/vendors/${vendor.id}`}
                  prefetch={false}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-caption font-medium">
                      {vendor.storeName}
                    </span>
                    <span className="truncate text-meta text-ink-subtle">
                      {vendor.user.email}
                    </span>
                  </span>
                  <span className="ml-auto shrink-0 text-meta text-ink-subtle">
                    {relativeTime(vendor.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── The numbers ───────────────────────────────────────────────── */}
      {!statsResult.ok ? (
        <Card padding="none">
          <ErrorState error={statsResult.error} title="Couldn't load the figures" />
        </Card>
      ) : (
        (() => {
          const stats = statsResult.data;
          return (
            <div className="flex flex-col gap-6">
              <section className="flex flex-col gap-3">
                <h2 className="text-caption font-semibold text-ink-muted">
                  Money in
                </h2>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatTile
                    label="Wholesale collected"
                    value={formatMoney(stats.revenue.wholesaleCollected)}
                    caption={`${pluralise(stats.revenue.wholesalePurchaseCount, "purchase")} settled`}
                    icon={<ShoppingBag className="size-4" strokeWidth={1.75} />}
                  />
                  <StatTile
                    label="Commission earned"
                    value={formatMoney(stats.revenue.commissionEarned)}
                    // Naming the base is the whole point: an admin who reads this
                    // as a cut of `gross` will think the platform is taking ~2%.
                    caption="charged on vendor margin"
                    icon={<TrendingUp className="size-4" strokeWidth={1.75} />}
                  />
                  <StatTile
                    label="Gross sales"
                    value={formatMoney(stats.revenue.gross)}
                    caption="paid orders, lifetime"
                    icon={<ReceiptText className="size-4" strokeWidth={1.75} />}
                  />
                  <StatTile
                    label="Average order"
                    value={formatMoney(stats.revenue.averageOrderValue)}
                    caption={`${pluralise(stats.orders.last30Days, "paid order")} in 30 days`}
                  />
                </div>
              </section>

              <section className="flex flex-col gap-3">
                <h2 className="text-caption font-semibold text-ink-muted">
                  The platform
                </h2>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatTile
                    label="Vendors"
                    value={String(stats.vendors.byStatus["APPROVED"] ?? 0)}
                    caption={`${String(stats.vendors.total)} total, ${String(stats.vendors.byStatus["SUSPENDED"] ?? 0)} suspended`}
                    icon={<Store className="size-4" strokeWidth={1.75} />}
                  />
                  <StatTile
                    label="Low stock"
                    value={String(stats.products.lowStock)}
                    caption={`of ${pluralise(stats.products.total, "pool product")}`}
                    // A rise here is bad — the pool is running out of things
                    // vendors can buy.
                    higherIsBetter={false}
                    icon={<Package className="size-4" strokeWidth={1.75} />}
                  />
                  <StatTile
                    label="Owed to vendors"
                    value={formatMoney(stats.revenue.vendorPayoutsOwed)}
                    caption={`${pluralise(stats.payouts.completedCount, "settlement")} recorded`}
                    icon={<Wallet className="size-4" strokeWidth={1.75} />}
                  />
                  <StatTile
                    label="Users"
                    value={String(stats.users.total)}
                    caption={`${String(stats.users.newLast30Days)} new in 30 days`}
                    icon={<Users className="size-4" strokeWidth={1.75} />}
                  />
                </div>
              </section>
            </div>
          );
        })()
      )}

      {/* ── Recent activity ──────────────────────────────────────────── */}
      <Card padding="none">
        <div className="flex items-center gap-2 border-b border-divider px-5 py-4">
          <ClipboardList className="size-4 text-ink-muted" strokeWidth={1.75} aria-hidden />
          <h2 className="text-caption font-semibold">Recent activity</h2>
          <Link
            href="/activity"
            prefetch={false}
            className="ml-auto text-meta text-ink-muted underline decoration-divider-strong underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            View all
          </Link>
        </div>

        {!activityResult.ok ? (
          <ErrorState error={activityResult.error} title="Couldn't load the trail" />
        ) : activityResult.data.length === 0 ? (
          <p className="px-5 py-8 text-center text-caption text-ink-muted">
            Nothing recorded yet. Approvals, suspensions and stock adjustments
            appear here.
          </p>
        ) : (
          <ul className="divide-y divide-divider">
            {activityResult.data.map((entry) => (
              <li key={entry.id} className="flex items-baseline gap-3 px-5 py-3">
                <span className="min-w-0 flex-1 text-caption">
                  {auditSentence(entry)}
                </span>
                <span className="shrink-0 text-meta text-ink-subtle">
                  {relativeTime(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
