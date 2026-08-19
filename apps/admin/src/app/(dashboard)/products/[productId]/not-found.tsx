import { Package } from "lucide-react";
import { EmptyState } from "@/components/feedback";

/**
 * See vendors/[vendorId]/not-found.tsx for the distinction from ErrorState.
 *
 * One extra cause here: a soft-deleted product is excluded from the list unless
 * `includeDeleted` is on, but it is still reachable by id — so a 404 on a product
 * genuinely means gone, not merely hidden.
 */
export default function ProductNotFound() {
  return (
    <EmptyState
      icon={<Package className="size-6" strokeWidth={1.5} />}
      title="No such product"
      body="This product doesn't exist. A deleted product is still reachable by its id, so this is not the deleted case — try searching the pool."
      action={{ label: "Back to products", href: "/products" }}
    />
  );
}
