import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/feedback";
import { Card } from "@/components/primitives";

/**
 * A 404 on an order.
 *
 * ⚠️ The copy must NOT say "you don't have access". The API answers 404 both for an
 * order that does not exist and for one belonging to another vendor, deliberately —
 * a 403 would confirm that an id is real, which is an enumeration oracle. Wording
 * this as a permission problem would leak exactly what the status code is hiding.
 */
export default function OrderNotFound() {
  return (
    <Card padding="none">
      <EmptyState
        icon={<FileQuestion className="size-6" strokeWidth={1.5} />}
        title="We couldn't find that order"
        body="It may have been cancelled, or the link may be wrong. Your current orders are all listed together."
        action={{ label: "See all orders", href: "/orders" }}
      />
    </Card>
  );
}
