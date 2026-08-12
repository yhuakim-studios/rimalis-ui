import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { XCircle } from "lucide-react";
import { GateScreen } from "@/components/feedback";
import { SignOutButton } from "@/components/SignOutButton";
import { getVendorProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Application not approved" };

/**
 * `REJECTED` — reviewed and declined.
 *
 * No "apply again" button, and that is a deliberate omission rather than a gap.
 * `POST /vendors/apply` returns 409 when a record already exists — including a
 * rejected one — so the button could not work. Offering it would produce a
 * conflict error the vendor cannot act on, which is worse than not offering it:
 * it reads as the platform being broken rather than as a decision having been
 * made.
 *
 * Reinstatement is `PATCH /vendors/:id/reinstate`, an admin action. So the only
 * honest next step is a human, and that is what the screen offers.
 */
export default async function RejectedPage() {
  const vendor = await getVendorProfile("/rejected");

  if (!vendor) redirect("/apply");
  if (vendor.status === "APPROVED") redirect("/");
  if (vendor.status === "PENDING") redirect("/pending");
  if (vendor.status === "SUSPENDED") redirect("/suspended");

  return (
    <GateScreen
      icon={<XCircle className="size-5" strokeWidth={1.75} />}
      title="We couldn't approve this application"
      body="Your application was reviewed and not approved, so this store can't sell on Rimalis. Your shopper account is unaffected — you can still browse and buy as normal."
      details={[{ label: "Store", value: vendor.storeName }]}
      footer={
        <div className="flex flex-col items-center gap-2">
          <p>
            If you think this is a mistake, or something has changed since you applied, email{" "}
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
