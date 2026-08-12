import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { OrderRow } from "@/components/dashboard";
import { EmptyState, ErrorState } from "@/components/feedback";
import { StatusTabs } from "@/components/orders";
import { Card, Pagination } from "@/components/primitives";
import { ctxFor, requireApprovedVendor, vendor as vendorApi } from "@/lib/auth";
import { pluralise } from "@/lib/format";

export const metadata: Metadata = { title: "Orders" };

const PAGE_SIZE = 20;

/**
 * Orders containing this vendor's items.
 *
 * ## Everything lives in the URL
 *
 * `?status=` and `?page=` are the whole state of this screen — no client filter, no
 * local pagination. So a tab is shareable, the back button works, and a reload keeps
 * a seller's place in a list they were working through. It also means the highlighted
 * tab and the rows beneath it read from the same source and cannot disagree.
 *
 * ## The status is passed through, not validated against an allowlist
 *
 * A junk `?status=BANANA` reaches the API, which rejects it with a 400 that this page
 * renders as an error. That is deliberate: an allowlist here would be a second copy
 * of the API's enum, and the copy would be the one that rots when a status is added.
 * The tabs only ever produce valid values, so this path is reachable only by hand.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status, page: pageParam } = await searchParams;
  const { session } = await requireApprovedVendor("/orders");

  // `Number.parseInt` then a floor of 1: `?page=0` and `?page=-3` are both a 400
  // from the API, and `?page=abc` is `NaN`, which would serialise as the string
  // "NaN" in the query.
  const parsed = Number.parseInt(pageParam ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;

  const result = await vendorApi.listOrders(ctxFor(session), {
    page,
    limit: PAGE_SIZE,
    ...(status ? { status: status as never } : {}),
  });

  const hrefForPage = (target: number) => {
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (target > 1) query.set("page", String(target));
    const suffix = query.toString();
    return suffix ? `/orders?${suffix}` : "/orders";
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-heading font-semibold tracking-tight">Orders</h1>
        <p className="text-caption text-ink-muted">
          Only your lines are shown, even on an order shared with another seller.
        </p>
      </div>

      <StatusTabs active={status} />

      {!result.ok ? (
        <Card padding="lg">
          <ErrorState error={result.error} title="We couldn't load these orders" />
        </Card>
      ) : result.data.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<Inbox className="size-6" strokeWidth={1.5} />}
            title={status ? "Nothing in this tab" : "No orders yet"}
            body={
              status
                ? "Try another status — your orders may have moved on already."
                : "When a shopper buys something you list, it appears here. Make sure your listings are switched on and your payout details are set."
            }
            {...(status ? { action: { label: "See all orders", href: "/orders" } } : {})}
          />
        </Card>
      ) : (
        <>
          <p className="text-meta text-ink-subtle">
            {pluralise(result.meta.total, "order")}
            {result.meta.totalPages > 1 &&
              ` · page ${String(result.meta.page)} of ${String(result.meta.totalPages)}`}
          </p>

          <Card padding="none">
            <ul className="divide-y divide-divider">
              {result.data.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </ul>
          </Card>

          <Pagination
            page={result.meta.page}
            totalPages={result.meta.totalPages}
            hrefForPage={hrefForPage}
          />
        </>
      )}
    </div>
  );
}
