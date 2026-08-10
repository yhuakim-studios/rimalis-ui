import { PackageX } from "lucide-react";
import { EmptyState } from "@/components/feedback";

/**
 * No such order.
 *
 * Careful with the copy: the API answers **404 for somebody else's order** as
 * well as for one that does not exist, on purpose — a 403 would confirm that an
 * id belongs to someone, which is an enumeration oracle. So this must not say
 * "you don't have permission", because for the common case (a mistyped or stale
 * link) that would be a lie, and for the other case it would leak the very thing
 * the 404 exists to hide.
 */

export default function OrderNotFound() {
  return (
    <EmptyState
      icon={<PackageX className="size-7" strokeWidth={1.5} />}
      title="We couldn't find that order"
      body="The link may be out of date. Your orders are all listed on the orders page."
      action={{ label: "View your orders", href: "/account/orders" }}
    />
  );
}
