import { Wallet } from "lucide-react";
import { EmptyState } from "@/components/feedback";

/** See vendors/[vendorId]/not-found.tsx — the same distinction from ErrorState. */
export default function PayoutNotFound() {
  return (
    <EmptyState
      icon={<Wallet className="size-6" strokeWidth={1.5} />}
      title="No such payout"
      body="This settlement row doesn't exist, or its id has changed."
      action={{ label: "Back to payouts", href: "/payouts" }}
    />
  );
}
