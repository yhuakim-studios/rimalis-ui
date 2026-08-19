import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/feedback";
import { Card } from "@/components/primitives";

/**
 * A 404 on a stock purchase.
 *
 * ⚠️ Same rule as the order 404: the copy must NOT say "you don't have access".
 * The API answers 404 both for a purchase that does not exist and for one
 * belonging to another vendor, so that an id cannot be confirmed by probing.
 *
 * It must also not imply the money went missing. A vendor reaching this has
 * followed a bad or stale link — the purchase row is written before Paystack is
 * ever called, so a real payment always has a real row to point at. Send them to
 * their products, which is where anything they actually own shows up.
 */
export default function StockPurchaseNotFound() {
  return (
    <Card padding="none">
      <EmptyState
        icon={<FileQuestion className="size-6" strokeWidth={1.5} />}
        title="We couldn't find that purchase"
        body="The link may be wrong or from another account. Everything you've bought stock for is on your products page."
        action={{ label: "See your products", href: "/products" }}
      />
    </Card>
  );
}
