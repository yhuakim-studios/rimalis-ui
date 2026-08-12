import Link from "next/link";
import type { OrderStatus } from "@rimalis/types";
import { cn } from "@/components/primitives";

/**
 * The order-status filter, as tabs.
 *
 * ## Why these tabs and not the design's four
 *
 * The reference shows All Orders · Pending · Shipped · Cancelled. Three of those are
 * kept, one is renamed and two are added, because `GET /vendor/orders?status=`
 * filters on the **order's** status and that enum has seven values with real
 * differences a seller must not miss:
 *
 * - **"Pending" is not "your turn".** `PENDING` means *unpaid*. A vendor who reads
 *   it as "awaiting me" ships goods nobody has paid for, and the API refuses
 *   fulfilment on a non-`PAID` order anyway. So the actionable tab is `PAID`,
 *   labelled **To fulfil**, and it leads.
 * - `PROCESSING` and `DELIVERED` are added because they are where most orders sit
 *   after the vendor has acted; without them "Shipped" is a tab you can enter and
 *   never leave.
 * - `REFUNDED` has no tab. The endpoint takes a single status, so it cannot share
 *   one with `CANCELLED`, and it does not earn its own: refunds are handled out of
 *   band in the Paystack dashboard and there is no refund endpoint, so the tab would
 *   filter for something a vendor cannot act on. It stays reachable through All.
 *
 * Links, not buttons: the filter is in the URL, so a tab is shareable, bookmarkable
 * and survives a reload. That also means no client JavaScript — this is a Server
 * Component, and the active tab comes from the same `searchParams` the query does,
 * so the highlight cannot disagree with the list beneath it.
 *
 * The row scrolls horizontally below `sm`. Six tabs do not fit a 360px viewport, and
 * the design's own tab row is exactly this pattern; `scrollbar-none` keeps it from
 * showing a bar over the content.
 */

interface Tab {
  label: string;
  /** `undefined` is the All tab — no `status` in the query. */
  status?: OrderStatus;
}

const TABS: readonly Tab[] = [
  { label: "All" },
  { label: "To fulfil", status: "PAID" },
  { label: "Packing", status: "PROCESSING" },
  { label: "Shipped", status: "SHIPPED" },
  { label: "Delivered", status: "DELIVERED" },
  { label: "Unpaid", status: "PENDING" },
  { label: "Cancelled", status: "CANCELLED" },
];

export function StatusTabs({ active }: { active?: string }) {
  return (
    <nav
      aria-label="Filter orders by status"
      className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0 scrollbar-none"
    >
      <ul className="flex w-max items-center gap-1 border-b border-divider pb-0">
        {TABS.map((tab) => {
          const isActive = (active ?? undefined) === tab.status;

          return (
            <li key={tab.label}>
              <Link
                href={tab.status ? `/orders?status=${tab.status}` : "/orders"}
                prefetch={false}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  // The underline sits on the element rather than on a pseudo
                  // sibling so it cannot drift out of alignment with the container's
                  // own bottom border.
                  "-mb-px inline-block border-b-2 px-3 py-2.5 text-caption whitespace-nowrap transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                  isActive
                    ? "border-brand-600 font-semibold text-ink"
                    : "border-transparent text-ink-muted hover:border-divider-strong hover:text-ink",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
