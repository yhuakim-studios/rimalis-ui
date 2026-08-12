import type { Metadata } from "next";
import { Card } from "@/components/primitives";
import { SignOutButton } from "@/components/SignOutButton";
import { requireApprovedVendor } from "@/lib/auth";
import { absoluteDate } from "@/lib/format";
import { PayoutForm, ProfileForm } from "./SettingsForms";

export const metadata: Metadata = { title: "Settings" };

/**
 * Store settings — presentation, bank details, and the facts a vendor cannot change.
 *
 * ## Payout details come first, above the profile
 *
 * Reverse of the obvious order, and deliberate. The store name is cosmetic; a missing
 * Paystack subaccount silently breaks every checkout containing this vendor's items
 * while their listings still look live. Putting the consequential form at the top is
 * the layout expressing which one matters.
 *
 * ## Logo and banner are read-only here
 *
 * `PATCH /vendors/me` accepts `logoUrl` and `bannerUrl`, but the API rejects any URL
 * outside our own Supabase bucket (`IMAGE_URL_NOT_OWNED`), and uploading needs a signed
 * ticket from `POST /admin/products/:id/images/upload-url` — an **admin** route with no
 * vendor equivalent. So a vendor cannot obtain a URL this endpoint would accept.
 *
 * A URL text input would therefore be a field whose every value is rejected. The
 * honest version is to say the images exist and are set by an admin, until the API
 * grows a vendor upload ticket.
 */
export default async function SettingsPage() {
  const { vendor } = await requireApprovedVendor("/settings");

  return (
    <div className="flex max-w-[640px] flex-col gap-6">
      <div>
        <h1 className="text-heading font-semibold tracking-tight">Settings</h1>
        <p className="text-caption text-ink-muted">Your store, and where your money goes.</p>
      </div>

      <Card padding="lg" className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-section font-semibold tracking-tight">Getting paid</h2>
          <p className="text-caption text-ink-muted">
            Your share of every order is sent straight to this account when a shopper pays.
          </p>
        </div>
        <PayoutForm vendor={vendor} />
      </Card>

      <Card padding="lg" className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-section font-semibold tracking-tight">Your store</h2>
          <p className="text-caption text-ink-muted">How your storefront reads to shoppers.</p>
        </div>
        <ProfileForm vendor={vendor} />
      </Card>

      <Card padding="lg" className="flex flex-col gap-4">
        <h2 className="text-section font-semibold tracking-tight">Set by Rimalis</h2>
        <dl className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-caption text-ink-muted">Storefront address</dt>
            <dd className="text-caption font-medium tabular-nums">/store/{vendor.slug}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-caption text-ink-muted">Commission</dt>
            <dd className="text-caption font-medium tabular-nums">
              {/*
                `null` means the platform default applies, which is 10% — but that
                default lives in the API's own `PLATFORM_COMMISSION_RATE` and is not
                exposed on this response. So this says "standard rate" rather than
                asserting a number the client cannot actually read; a hardcoded 10%
                here would silently become a lie the day it changed.
              */}
              {vendor.commissionRate === null
                ? "Standard rate"
                : `${String(Math.round(vendor.commissionRate * 100))}%`}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-caption text-ink-muted">Store images</dt>
            <dd className="text-caption font-medium">
              {vendor.logoUrl ?? vendor.bannerUrl ? "Set by an admin" : "Not set"}
            </dd>
          </div>
          {vendor.approvedAt && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-caption text-ink-muted">Selling since</dt>
              <dd className="text-caption font-medium">{absoluteDate(vendor.approvedAt)}</dd>
            </div>
          )}
        </dl>
        <p className="text-meta text-ink-subtle">
          These are managed by Rimalis. Email sellers@rimalis.ng if something here is wrong.
        </p>
      </Card>

      <div className="flex justify-center pb-4">
        <SignOutButton />
      </div>
    </div>
  );
}
