import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Badge, Card } from "@/components/primitives";
import { ErrorState } from "@/components/feedback";
import {
  CommissionRateForm,
  ConfirmAction,
  accountState,
  vendorStatus,
} from "@/components/admin";
import { admin, ctxFor, requireAdmin } from "@/lib/auth";
import { isMissing } from "@/lib/errors";
import { absoluteDateTime, badgeTone } from "@/lib/format";
import {
  approveVendor,
  reinstateVendor,
  rejectVendor,
  suspendVendor,
} from "@/lib/vendor-actions";

export const metadata: Metadata = { title: "Vendor" };

/**
 * One vendor: who they are, whether they can trade, and what they are charged.
 *
 * ## Two calls, because the detail endpoint carries no user
 *
 * `GET /vendors/:id` returns the vendor profile with **no `user` relation**,
 * unlike the list rows — so the owner's email needs `GET /users/:id` via
 * `vendor.userId`. They run in parallel under the one `requireAdmin`, never a
 * guard per call: see the header of lib/auth.ts on why concurrent refreshes
 * revoke every session.
 *
 * The user call is allowed to fail softly. It is supporting detail, and an admin
 * who came here to approve a store should not be blocked because one of two reads
 * timed out.
 *
 * ## Actions are gated on the current status, and the gate says why
 *
 * The API refuses an invalid transition, but a button that fails is worse than a
 * button that explains itself before the click — so `disabledReason` carries the
 * explanation rather than leaving the admin to discover it. The mapping:
 *
 *   PENDING    approve, reject
 *   APPROVED   suspend
 *   SUSPENDED  reinstate
 *   REJECTED   approve (a reconsidered application)
 *
 * ⚠️ Reject takes NO reason field, because the endpoint accepts no body. A field
 * there would silently discard what the admin typed — the exact bug the audit
 * table was created to fix.
 */
export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const { session } = await requireAdmin(`/vendors/${vendorId}`);
  const ctx = ctxFor(session);

  const vendorResult = await admin.getVendor(ctx, vendorId);

  if (!vendorResult.ok) {
    // `isMissing`, not `admin.isNotFound`: a malformed id is a 400 from the
    // API's param schema, and "no such vendor" is the honest answer for it too.
    // See lib/errors.ts.
    if (isMissing(vendorResult.error)) notFound();
    return <ErrorState error={vendorResult.error} title="Couldn't load this vendor" />;
  }

  const vendor = vendorResult.data;
  // Sequential after the vendor read purely because it needs `userId` from it.
  const ownerResult = await admin.getUser(ctx, vendor.userId);
  const owner = ownerResult.ok ? ownerResult.data : null;

  const status = vendorStatus(vendor.status);
  const canApprove = vendor.status === "PENDING" || vendor.status === "REJECTED";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/vendors"
          prefetch={false}
          className="w-fit text-meta text-ink-muted underline decoration-divider-strong underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          ← All vendors
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-heading font-semibold tracking-tight">
            {vendor.storeName}
          </h1>
          <Badge tone={badgeTone(status.tone)}>{status.label}</Badge>
        </div>
        <p className="text-body text-ink-muted">/{vendor.slug}</p>
      </div>

      {/*
        The one thing on this page that is an outage rather than a detail. A vendor
        with no Paystack subaccount cannot be bought from AT ALL — checkout refuses
        to build a split and 409s on every order containing their items — while
        looking perfectly approved everywhere else. So it is a banner, not a field.
      */}
      {vendor.paystackSubaccountCode === null && (
        <Card tone="flat" className="border-danger/40 bg-danger-soft">
          <div className="flex gap-3">
            <AlertTriangle
              className="size-5 shrink-0 text-danger"
              strokeWidth={1.75}
              aria-hidden
            />
            <div className="flex flex-col gap-1">
              <p className="text-caption font-semibold text-ink">
                No payout account — nobody can buy from this store
              </p>
              <p className="text-caption text-ink-muted">
                Checkout cannot split a payment without a Paystack subaccount, so
                every order containing their items fails at payment. Only the
                vendor can add it, from their own settings.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-section font-semibold">Store</h2>
          <dl className="flex flex-col gap-3">
            <Row label="Business name" value={vendor.businessName} />
            <Row label="CAC number" value={vendor.cacNumber} />
            <Row label="Description" value={vendor.description} />
            <Row label="Applied" value={absoluteDateTime(vendor.createdAt)} />
            <Row
              label="Approved"
              value={
                vendor.approvedAt === null ? null : absoluteDateTime(vendor.approvedAt)
              }
            />
            <Row label="Referral code" value={vendor.referralCode} mono />
            <Row
              label="Qualified recruits"
              value={String(vendor.qualifiedReferralCount)}
            />
          </dl>
        </Card>

        <Card>
          <h2 className="mb-4 text-section font-semibold">Owner</h2>
          {owner === null ? (
            <p className="text-caption text-ink-muted">
              {/* Soft failure — see the header. */}
              Couldn&apos;t load the owner&apos;s account just now.{" "}
              <Link
                href={`/users/${vendor.userId}`}
                prefetch={false}
                className="underline underline-offset-4"
              >
                Open it directly
              </Link>
              .
            </p>
          ) : (
            <dl className="flex flex-col gap-3">
              <Row label="Name" value={`${owner.firstName} ${owner.lastName}`.trim()} />
              <Row label="Email" value={owner.email} />
              <Row label="Phone" value={owner.phone} />
              <Row
                label="Account"
                value={accountState(owner.isActive).label}
                tone={owner.isActive ? undefined : "danger"}
              />
              <Row label="Email confirmed" value={owner.isVerified ? "Yes" : "No"} />
              <div className="pt-1">
                <Link
                  href={`/users/${owner.id}`}
                  prefetch={false}
                  className="text-caption underline decoration-divider-strong underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  Manage this account
                </Link>
              </div>
            </dl>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-section font-semibold">Payouts</h2>
          <dl className="flex flex-col gap-3">
            <Row
              label="Subaccount"
              value={vendor.paystackSubaccountCode}
              mono
              tone={vendor.paystackSubaccountCode === null ? "danger" : undefined}
            />
            {/* A bank CODE, not a name — "058" is GTBank. Labelled so nobody
                reads a three-digit string as a truncated account number. */}
            <Row label="Bank code" value={vendor.paystackSettlementBank} mono />
            <Row label="Account number" value={vendor.paystackAccountNumber} mono />
          </dl>
        </Card>

        <Card>
          <h2 className="mb-4 text-section font-semibold">Commission</h2>
          <CommissionRateForm
            vendorId={vendor.id}
            currentOverride={vendor.commissionRateOverride}
            qualifiedReferrals={vendor.qualifiedReferralCount}
          />
        </Card>
      </div>

      <Card>
        <h2 className="mb-1 text-section font-semibold">Standing</h2>
        <p className="mb-4 text-caption text-ink-muted">
          Suspension takes effect on their next request — the API re-reads vendor
          status from the database rather than trusting their token.
        </p>

        <div className="flex flex-wrap gap-3">
          <ConfirmAction
            action={approveVendor}
            label={vendor.status === "REJECTED" ? "Approve after all" : "Approve"}
            confirmLabel="Approve vendor"
            consequence="They can list products and trade immediately. If they were recruited by another vendor, this may also advance that vendor's commission tier."
            hidden={{ vendorId: vendor.id }}
            {...(canApprove
              ? {}
              : {
                  disabledReason:
                    vendor.status === "APPROVED"
                      ? "Already approved."
                      : "Reinstate instead — this vendor was approved before.",
                })}
          />

          <ConfirmAction
            action={rejectVendor}
            label="Reject"
            confirmLabel="Reject application"
            // Naming the absence of a reason field, so it reads as a deliberate
            // constraint rather than an oversight.
            consequence="Their application is declined. The endpoint records no reason — say why by email or in a note elsewhere."
            danger
            hidden={{ vendorId: vendor.id }}
            {...(vendor.status === "PENDING"
              ? {}
              : { disabledReason: "Only a pending application can be rejected." })}
          />

          <ConfirmAction
            action={suspendVendor}
            label="Suspend"
            confirmLabel="Suspend vendor"
            consequence="Their dashboard locks and their listings stop selling on their next request. Orders already paid for are unaffected."
            danger
            reasonField={{ label: "Reason", hint: "Recorded in the activity log against your account." }}
            hidden={{ vendorId: vendor.id }}
            {...(vendor.status === "APPROVED"
              ? {}
              : { disabledReason: "Only an approved vendor can be suspended." })}
          />

          <ConfirmAction
            action={reinstateVendor}
            label="Reinstate"
            confirmLabel="Reinstate vendor"
            consequence="They can trade again, with the same listings and stock they had before."
            hidden={{ vendorId: vendor.id }}
            {...(vendor.status === "SUSPENDED"
              ? {}
              : { disabledReason: "Only a suspended vendor can be reinstated." })}
          />
        </div>
      </Card>
    </div>
  );
}

/** A `<dl>` row that renders an absent value as an em dash rather than a gap. */
function Row({
  label,
  value,
  mono = false,
  tone,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
  tone?: "danger";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-meta text-ink-subtle">{label}</dt>
      <dd
        className={[
          "text-caption",
          mono ? "font-mono" : "",
          tone === "danger" ? "text-danger" : "text-ink",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value === null || value === "" ? (
          <span className="text-ink-subtle">—</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
