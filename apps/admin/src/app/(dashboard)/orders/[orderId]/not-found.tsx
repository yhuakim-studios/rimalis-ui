import { ReceiptText } from "lucide-react";
import { EmptyState } from "@/components/feedback";

/** See vendors/[vendorId]/not-found.tsx — the same distinction from ErrorState. */
export default function OrderNotFound() {
  return (
    <EmptyState
      icon={<ReceiptText className="size-6" strokeWidth={1.5} />}
      title="No such order"
      body="This order doesn't exist, or its id has changed. A link from the activity log can outlive the thing it points at — that is by design."
      action={{ label: "Back to orders", href: "/orders" }}
    />
  );
}
