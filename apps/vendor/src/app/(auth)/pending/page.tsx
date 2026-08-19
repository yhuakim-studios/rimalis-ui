import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Hourglass } from "lucide-react";
import { GateScreen } from "@/components/feedback";
import { SignOutButton } from "@/components/SignOutButton";
import { getVendorProfile } from "@/lib/auth";
import { absoluteDate } from "@/lib/format";

export const metadata: Metadata = { title: "Application under review" };

/**
 * `PENDING` — applied, not yet reviewed.
 *
 * Uses `getVendorProfile()` rather than `requireApprovedVendor()`, which would
 * redirect this page to itself forever.
 *
 * It also re-checks the status and forwards an approved vendor to the dashboard.
 * That is not defensive padding: approval happens on someone else's schedule, so
 * a vendor who leaves this tab open overnight and refreshes should land on their
 * store rather than read "under review" for a day after it stopped being true.
 */
export default async function PendingPage() {
  const vendor = await getVendorProfile("/pending");

  if (!vendor) redirect("/apply");
  if (vendor.status === "APPROVED") redirect("/");
  if (vendor.status === "SUSPENDED") redirect("/suspended");
  if (vendor.status === "REJECTED") redirect("/rejected");

  return (
    <GateScreen
      icon={<Hourglass className="size-5" strokeWidth={1.75} />}
      title="We're reviewing your application"
      body="Someone checks every new store by hand, usually within two working days. You'll get an email the moment it's approved — there's nothing else you need to do."
      details={[
        { label: "Store", value: vendor.storeName },
        { label: "Applied", value: absoluteDate(vendor.createdAt) },
      ]}
      footer={
        <div className="flex flex-col items-center gap-2">
          <p>
            Questions about your application? Email{" "}
            <a
              className="font-medium text-ink underline decoration-divider-strong underline-offset-4"
              href="mailto:sellers@rimalis.ng"
            >
              sellers@rimalis.ng
            </a>
            .
          </p>
          <SignOutButton />
        </div>
      }
    />
  );
}
