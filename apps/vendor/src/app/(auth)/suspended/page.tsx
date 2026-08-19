import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PauseCircle } from "lucide-react";
import { GateScreen } from "@/components/feedback";
import { SignOutButton } from "@/components/SignOutButton";
import { getVendorProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Store paused" };

/**
 * `SUSPENDED` — was trading, stopped by an admin.
 *
 * The most consequential of the four screens, because the vendor's first thought
 * is about money. So the copy answers that before anything else: **completed
 * orders still settle**, which is true — Paystack splits each charge at payment
 * time and the money has already reached their subaccount. Leaving that unsaid
 * invites the assumption that suspension freezes funds.
 *
 * It deliberately does not guess *why*. The API exposes no suspension reason
 * field, and inventing a plausible one ("for a compliance review") would be
 * fabrication on the screen where trust matters most. The honest move is to name
 * the one route to an answer.
 */
export default async function SuspendedPage() {
  const vendor = await getVendorProfile("/suspended");

  if (!vendor) redirect("/apply");
  if (vendor.status === "APPROVED") redirect("/");
  if (vendor.status === "PENDING") redirect("/pending");
  if (vendor.status === "REJECTED") redirect("/rejected");

  return (
    <GateScreen
      icon={<PauseCircle className="size-5" strokeWidth={1.75} />}
      title="Your store is paused"
      body="Your listings are hidden from shoppers and you can't take new orders for now. Money from orders that already completed is not affected — it settled to your bank account at the time of each sale."
      details={[{ label: "Store", value: vendor.storeName }]}
      footer={
        <div className="flex flex-col items-center gap-2">
          <p>
            To find out why and what to do next, email{" "}
            <a
              className="font-medium text-ink underline decoration-divider-strong underline-offset-4"
              href="mailto:sellers@rimalis.ng"
            >
              sellers@rimalis.ng
            </a>{" "}
            with your store name.
          </p>
          <SignOutButton />
        </div>
      }
    />
  );
}
