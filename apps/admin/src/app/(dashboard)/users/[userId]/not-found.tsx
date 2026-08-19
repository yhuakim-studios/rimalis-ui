import { Users } from "lucide-react";
import { EmptyState } from "@/components/feedback";

/** See vendors/[vendorId]/not-found.tsx — the same distinction from ErrorState. */
export default function UserNotFound() {
  return (
    <EmptyState
      icon={<Users className="size-6" strokeWidth={1.5} />}
      title="No such account"
      body="This user doesn't exist, or their id has changed. A link from the activity log can outlive the thing it points at — that is by design."
      action={{ label: "Back to users", href: "/users" }}
    />
  );
}
