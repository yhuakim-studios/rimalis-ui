import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getVendorProfile } from "@/lib/auth";
import { ApplyForm } from "./ApplyForm";

export const metadata: Metadata = { title: "Open a store" };

/**
 * No vendor record — a shopper account that signed in here, or an application
 * never submitted.
 *
 * Forwards anyone who *does* have a record to their own status screen, because
 * `POST /vendors/apply` 409s on a second application and a form that cannot
 * succeed should not be rendered.
 */
export default async function ApplyPage() {
  const vendor = await getVendorProfile("/apply");

  if (vendor) {
    switch (vendor.status) {
      case "APPROVED":
        redirect("/");
      case "PENDING":
        redirect("/pending");
      case "SUSPENDED":
        redirect("/suspended");
      case "REJECTED":
        redirect("/rejected");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-heading font-semibold tracking-tight">Open a store</h1>
        <p className="text-body text-ink-muted">
          Tell us what to call your store. Someone reviews every application by hand, usually
          within two working days.
        </p>
      </div>

      <ApplyForm />
    </div>
  );
}
