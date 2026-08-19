import { Store } from "lucide-react";
import { EmptyState } from "@/components/feedback";

/**
 * Reached by `notFound()` when the API answers 404 for this vendor id.
 *
 * Distinct from an `ErrorState` on purpose, and the distinction is the whole
 * reason both exist: this says "there is no such vendor", which is a fact about
 * the data. A transport failure must never borrow this copy — an admin told a
 * store does not exist stops looking for it.
 *
 * The likeliest cause is a stale link, including one from the activity log, where
 * audit rows deliberately outlive what they describe.
 */
export default function VendorNotFound() {
  return (
    <EmptyState
      icon={<Store className="size-6" strokeWidth={1.5} />}
      title="No such vendor"
      body="This store doesn't exist, or its id has changed. Links from the activity log can outlive the thing they point at — that is by design."
      action={{ label: "Back to vendors", href: "/vendors" }}
    />
  );
}
