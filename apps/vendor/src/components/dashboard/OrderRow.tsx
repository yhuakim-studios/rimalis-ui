import Link from "next/link";
import { ChevronRight, ImageOff } from "lucide-react";
import type { VendorOrder } from "@rimalis/types";
import { Badge, cn } from "@/components/primitives";
import { formatNaira, parseMoney, sum } from "@/lib/money";
import {
  badgeTone,
  destination,
  monogram,
  orderStatus,
  pluralise,
  relativeTime,
  shortRef,
} from "@/lib/format";

/**
 * One order, as a row. Shared by the dashboard's recent list and the orders page,
 * so the two cannot describe the same order differently.
 *
 * ## What the reference row shows that this one cannot
 *
 * The design puts a **product thumbnail** and a **customer name** on every row.
 * Neither is available:
 *
 * - `OrderItem` carries `productNameSnapshot` and `productSkuSnapshot` and
 *   deliberately no embedded product — a historical order must not change its
 *   contents when an admin edits the catalogue — so there is no image URL to render.
 *   A monogram tile stands in. Resolving images would mean one lookup per line, and
 *   the snapshot would still be the authoritative name.
 * - `Order` carries `customerId` and nothing else; the vendor paths embed no user.
 *   Showing a uuid would be worse than showing nothing, so the row leads with the
 *   order reference and the destination city — which is what a vendor packing a
 *   parcel actually needs.
 *
 * The design's `60051 - NY` pill maps onto that destination exactly; it is the one
 * element of that row this API can honour precisely.
 *
 * ## The approve / reject buttons are gone on purpose
 *
 * The reference has a red ✗ and a green ✓ per row. There is no accept-or-decline
 * step in this domain: a paid order is the vendor's to fulfil, and the only writes
 * are forward fulfilment transitions. A vendor cannot reject an order, and there is
 * no endpoint that would let them — so the row's action is "open it", and the
 * fulfilment control lives on the detail page beside the specific line it advances.
 */
export function OrderRow({ order }: { order: VendorOrder }) {
  const status = orderStatus(order.status);
  const where = destination(order.address);

  // This vendor's slice, never `order.grandTotal` — on a multi-vendor order that
  // total includes another seller's takings. See the note in `VendorOrder`.
  //
  // Through `parseMoney`/`sum`, not `Number()`. A `Money` is a decimal string, and
  // `Number("1450000.00")` reintroduces the float drift the money module exists to
  // prevent — its header names this as the rule to defend.
  const lineTotal = sum(...order.items.map((item) => parseMoney(item.totalPrice)));
  const units = order.items.reduce((count, item) => count + item.quantity, 0);
  const lead = order.items[0];

  return (
    <li>
      <Link
        href={`/orders/${order.id}`}
        prefetch={false}
        className={cn(
          "flex items-center gap-3 px-4 py-3.5 transition-colors",
          "hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600",
        )}
      >
        <span
          className="grid size-11 shrink-0 place-items-center rounded-input bg-canvas text-caption font-semibold text-ink-muted"
          aria-hidden
        >
          {lead ? monogram(lead.productNameSnapshot) : <ImageOff className="size-4" strokeWidth={1.5} />}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline gap-2">
            {/* `truncate` with `min-w-0` above: a product name is unbounded, and
                without both the row grows past the viewport instead of clipping. */}
            <span className="truncate text-caption font-semibold">
              {lead?.productNameSnapshot ?? "Order"}
              {order.items.length > 1 && (
                <span className="font-normal text-ink-muted">
                  {" "}
                  +{order.items.length - 1} more
                </span>
              )}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-subtle">
            <span className="tabular-nums">{shortRef(order.id)}</span>
            <span aria-hidden>·</span>
            <span>{relativeTime(order.createdAt)}</span>
            <span aria-hidden>·</span>
            <span>{pluralise(units, "unit")}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={badgeTone(status.tone)}>{status.label}</Badge>
            {where && <Badge tone="neutral">{where}</Badge>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <span className="text-caption font-semibold tabular-nums">
            {formatNaira(lineTotal)}
          </span>
          <ChevronRight className="size-4 text-ink-subtle" strokeWidth={1.75} aria-hidden />
        </div>
      </Link>
    </li>
  );
}
