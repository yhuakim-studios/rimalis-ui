import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";
import type { OrderStatus } from "@rimalis/types";
import { EmptyState, ErrorState } from "@/components/feedback";
import { Pagination } from "@/components/catalogue";
import { Badge, Card } from "@/components/primitives";
import { ctxFor, orders, requireSession } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS, formatDate } from "@/lib/orders-view";

/**
 * Order history.
 *
 * ## The status filter is a link, not a dropdown
 *
 * Filters live in the URL for the same reason they do on the catalogue: a
 * filtered view should be shareable, bookmarkable and survive a back button. A
 * client-side dropdown holding the state in React loses all three, and on this
 * page in particular "show me my unpaid orders" is a view someone returns to.
 *
 * An unrecognised `status` is dropped rather than sent — the API 400s on
 * anything outside its enum, and a hand-edited URL must render a page rather
 * than an error boundary.
 */

export const metadata: Metadata = {
  title: "Your orders",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

const STATUSES: OrderStatus[] = [
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

const parseStatus = (raw: string | undefined): OrderStatus | undefined =>
  raw && (STATUSES as string[]).includes(raw) ? (raw as OrderStatus) : undefined;

const parsePage = (raw: string | undefined): number => {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 ? value : 1;
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const session = await requireSession("/account/orders");
  const { page: rawPage, status: rawStatus } = await searchParams;

  const page = parsePage(rawPage);
  const status = parseStatus(rawStatus);

  const result = await orders.list(ctxFor(session), {
    page,
    limit: PAGE_SIZE,
    ...(status ? { status } : {}),
  });

  if (!result.ok) {
    return <ErrorState error={result.error} title="We couldn't load your orders" />;
  }

  const href = (changes: { page?: number; status?: OrderStatus | undefined }) => {
    const params = new URLSearchParams();
    const nextStatus = "status" in changes ? changes.status : status;
    // Changing the filter resets to page 1. Keeping page 5 while narrowing to
    // "Cancelled" lands on an empty page that reads as "you have none", which is
    // the same pagination bug the catalogue's `withParams` exists to prevent.
    const nextPage = changes.page ?? ("status" in changes ? 1 : page);
    if (nextStatus) params.set("status", nextStatus);
    if (nextPage > 1) params.set("page", String(nextPage));
    const query = params.toString();
    return `/account/orders${query ? `?${query}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-heading text-ink">Your orders</h1>
        <p className="text-body text-ink-muted">
          {result.meta.total} {result.meta.total === 1 ? "order" : "orders"}
          {status ? ` with status ${ORDER_STATUS[status].label.toLowerCase()}` : ""}
        </p>
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        <FilterChip href={href({ status: undefined })} active={status === undefined}>
          All
        </FilterChip>
        {STATUSES.map((value) => (
          <FilterChip key={value} href={href({ status: value })} active={status === value}>
            {ORDER_STATUS[value].label}
          </FilterChip>
        ))}
      </nav>

      {result.data.length === 0 ? (
        <EmptyState
          icon={<Package className="size-7" strokeWidth={1.5} />}
          title={status ? "No orders with that status" : "You haven't ordered yet"}
          body={
            status
              ? "Try a different status, or view all of your orders."
              : "When you place an order it'll appear here, with each seller's progress."
          }
          action={
            status
              ? { label: "View all orders", href: "/account/orders" }
              : { label: "Browse the catalogue", href: "/products" }
          }
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {result.data.map((order) => {
            const view = ORDER_STATUS[order.status];
            return (
              <Card key={order.id} as="li" tone="flat" padding="md">
                <Link
                  href={`/account/orders/${order.id}`}
                  prefetch={false}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={view.tone}>{view.label}</Badge>
                      <span className="text-meta text-ink-muted">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                    {/* The id, truncated. It is what support will ask for, and
                        the full uuid is on the detail page — eight characters is
                        enough to match against a list. */}
                    <p className="font-mono text-meta text-ink-subtle">
                      #{order.id.slice(0, 8)}
                    </p>
                  </div>

                  <p className="text-section text-ink">{formatMoney(order.grandTotal)}</p>
                </Link>
              </Card>
            );
          })}
        </ul>
      )}

      {result.meta.totalPages > 1 && (
        <Pagination
          page={result.meta.page}
          totalPages={result.meta.totalPages}
          hrefForPage={(value) => href({ page: value })}
        />
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "inline-flex min-h-11 items-center rounded-pill bg-brand-600 px-4 text-caption font-medium text-white"
          : "inline-flex min-h-11 items-center rounded-pill border border-divider-strong bg-surface px-4 text-caption text-ink-muted transition-colors duration-150 hover:text-ink"
      }
    >
      {children}
    </Link>
  );
}
