import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText } from "lucide-react";
import type { OrderStatus } from "@rimalis/types";
import {
  Badge,
  Pagination,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableShell,
} from "@/components/primitives";
import { EmptyState, ErrorState } from "@/components/feedback";
import { FilterBar, StatusTabs, adminOrderStatus } from "@/components/admin";
import { admin, ctxFor, requireAdmin } from "@/lib/auth";
import { absoluteDate, badgeTone, pluralise, shortRef } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { emptyCopy, hrefForPage, oneOf, optional, pageParam } from "@/lib/admin-params";

export const metadata: Metadata = { title: "Orders" };

const STATUSES = [
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;

/**
 * Every order, across every customer and vendor.
 *
 * ## Read-only, and that is not a gap
 *
 * There is no admin fulfilment, cancel or refund endpoint, so there are no actions
 * on this screen. Fulfilment belongs to the vendor who owns the line — it is a
 * per-line status, not an order-level one — and refunds are handled in the Paystack
 * dashboard, because reversing a split charge touches money already settled into
 * several vendor subaccounts. Adding an admin refund path is its own design task
 * and would touch the money split; it is deliberately absent rather than forgotten.
 *
 * ## `PENDING` means UNPAID, and the label says so
 *
 * `orderStatus()` renders it as "Awaiting payment" rather than "Pending", for the
 * same reason the vendor app does: "pending" reads as "someone's turn to act",
 * and an unpaid order is nobody's turn. It is also why `grandTotal` on a PENDING
 * row is money the platform never received — the dashboard's revenue figures
 * exclude it, and this list does not, which is the honest split between "what was
 * ordered" and "what was paid".
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = oneOf<OrderStatus>(params["status"], STATUSES);
  const search = optional(params["search"]);
  const from = optional(params["from"]);
  const to = optional(params["to"]);
  const page = pageParam(params["page"]);

  const { session } = await requireAdmin("/orders");
  const result = await admin.listOrders(ctxFor(session), {
    ...(status !== undefined ? { status } : {}),
    ...(search !== undefined ? { search } : {}),
    ...(from !== undefined ? { from } : {}),
    ...(to !== undefined ? { to } : {}),
    page,
  });

  const urlParams = { status, search, from, to };
  const filtered = Object.values(urlParams).some((v) => v !== undefined);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-heading font-semibold tracking-tight">Orders</h1>
        <p className="text-body text-ink-muted">
          Every order across every store. Read-only — vendors fulfil their own
          lines, and refunds happen in Paystack.
        </p>
      </div>

      <StatusTabs
        basePath="/orders"
        param="status"
        current={status}
        params={urlParams}
        tabs={[
          { label: "All" },
          { value: "PENDING", label: "Awaiting payment" },
          { value: "PAID", label: "Paid" },
          { value: "PROCESSING", label: "Processing" },
          { value: "SHIPPED", label: "Shipped" },
          { value: "DELIVERED", label: "Delivered" },
          { value: "CANCELLED", label: "Cancelled" },
          { value: "REFUNDED", label: "Refunded" },
        ]}
      />

      <FilterBar
        basePath="/orders"
        active={filtered}
        fields={[
          {
            name: "search",
            label: "Search",
            value: search,
            grow: true,
            placeholder: "Paystack reference or customer email",
          },
          // `type="search"` text inputs rather than date pickers: there is no date
          // picker primitive in this repo, the API takes ISO dates, and a native
          // `type="date"` would need its own value-format handling for a filter
          // that is used occasionally. Plain ISO is honest and shareable.
          { name: "from", label: "From", value: from, placeholder: "2026-08-01" },
          { name: "to", label: "To", value: to, placeholder: "2026-08-31" },
        ]}
      />

      {!result.ok ? (
        <ErrorState error={result.error} title="Couldn't load orders" />
      ) : result.data.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="size-6" strokeWidth={1.5} />}
          {...emptyCopy({
            filtered,
            total: result.meta?.total ?? 0,
            page,
            noun: "orders",
            genuinelyEmpty: "Orders appear here as soon as a shopper checks out.",
          })}
        />
      ) : (
        <>
          <TableShell>
            <Table>
              <THead>
                <TR>
                  <TH>Order</TH>
                  <TH priority="secondary">Customer</TH>
                  <TH align="end" priority="secondary">
                    Items
                  </TH>
                  <TH align="end">Total</TH>
                  <TH>Status</TH>
                  <TH align="end" priority="secondary">
                    Placed
                  </TH>
                </TR>
              </THead>
              <TBody>
                {result.data.map((order) => {
                  const presentation = adminOrderStatus(order.status);
                  // Distinct vendors on the order — the thing that makes an admin
                  // order view different from a vendor's, and worth seeing before
                  // opening it.
                  const vendorCount = new Set(order.items.map((i) => i.vendorId)).size;
                  return (
                    <TR key={order.id}>
                      <TD>
                        <Link
                          href={`/orders/${order.id}`}
                          prefetch={false}
                          className="flex flex-col rounded-input font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                        >
                          {shortRef(order.id)}
                          {vendorCount > 1 && (
                            <span className="text-meta font-normal text-ink-subtle">
                              {pluralise(vendorCount, "vendor")}
                            </span>
                          )}
                        </Link>
                      </TD>
                      <TD priority="secondary">
                        <span className="text-ink-muted">{order.customer.email}</span>
                      </TD>
                      <TD align="end" priority="secondary">
                        {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                      </TD>
                      <TD align="end">{formatMoney(order.grandTotal)}</TD>
                      <TD>
                        <Badge tone={badgeTone(presentation.tone)}>
                          {presentation.label}
                        </Badge>
                      </TD>
                      <TD align="end" priority="secondary">
                        <span className="text-ink-muted">
                          {absoluteDate(order.createdAt)}
                        </span>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableShell>

          {result.meta && (
            <Pagination
              page={result.meta.page}
              totalPages={result.meta.totalPages}
              hrefForPage={(target) => hrefForPage("/orders", urlParams, target)}
            />
          )}
        </>
      )}
    </div>
  );
}
