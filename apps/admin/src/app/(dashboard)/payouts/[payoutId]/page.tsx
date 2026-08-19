import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/primitives";
import { ErrorState } from "@/components/feedback";
import { admin, ctxFor, requireAdmin } from "@/lib/auth";
import { isMissing } from "@/lib/errors";
import { absoluteDate, absoluteDateTime, badgeTone, payoutStatus } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Payout" };

/**
 * One settlement row.
 *
 * ## No actions, and the header says why
 *
 * Same rule as the list: Paystack's split already moved this money. There is no
 * retry, no reverse, no mark-as-paid, and adding one would double-pay.
 *
 * ## `providerPayload` is behind a `<details>`
 *
 * It is the raw provider response — useful exactly once, when reconciling a
 * disputed transfer against Paystack's dashboard, and noise every other time.
 * Collapsed rather than omitted: an admin on a support call needs it, and the
 * alternative is asking someone to query the database.
 *
 * Rendered as JSON in a `<pre>` rather than parsed into fields. The shape is
 * Paystack's and not ours to promise anything about, so pretty-printing it is the
 * honest presentation — a field list would imply a contract that does not exist.
 */
export default async function PayoutDetailPage({
  params,
}: {
  params: Promise<{ payoutId: string }>;
}) {
  const { payoutId } = await params;
  const { session } = await requireAdmin(`/payouts/${payoutId}`);

  const result = await admin.getPayout(ctxFor(session), payoutId);

  if (!result.ok) {
    if (isMissing(result.error)) notFound();
    return <ErrorState error={result.error} title="Couldn't load this payout" />;
  }

  const payout = result.data;
  const status = payoutStatus(payout.status);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/payouts"
          prefetch={false}
          className="w-fit text-meta text-ink-muted underline decoration-divider-strong underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          ← All payouts
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-heading font-semibold tracking-tight">
            {formatMoney(payout.amount)}
          </h1>
          <Badge tone={badgeTone(status.tone)}>{status.label}</Badge>
        </div>
        <p className="text-body text-ink-muted">
          Settled to{" "}
          <Link
            href={`/vendors/${payout.vendor.id}`}
            prefetch={false}
            className="underline decoration-divider-strong underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            {payout.vendor.storeName}
          </Link>
          . This is a record of a transfer Paystack already made — there is nothing
          to action here.
        </p>
      </div>

      <Card>
        <h2 className="mb-4 text-section font-semibold">Ledger entry</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Row label="Amount" value={formatMoney(payout.amount)} />
          <Row label="Currency" value={payout.currency} />
          <Row label="Status" value={payout.status} />
          <Row label="Reference" value={payout.reference} mono />
          <Row
            label="Period"
            value={`${absoluteDate(payout.periodStart)} – ${absoluteDate(payout.periodEnd)}`}
          />
          <Row label="Recorded" value={absoluteDateTime(payout.createdAt)} />
          <Row label="Store" value={payout.vendor.storeName} />
          <Row label="Storefront" value={`/${payout.vendor.slug}`} mono />
        </dl>
      </Card>

      {payout.providerPayload !== null && payout.providerPayload !== undefined && (
        <Card>
          <details>
            <summary className="cursor-pointer text-caption font-semibold">
              Provider payload
              <span className="ml-2 font-normal text-ink-subtle">
                — Paystack&apos;s own response, for reconciling a dispute
              </span>
            </summary>
            <pre className="mt-3 overflow-x-auto rounded-input bg-canvas p-4 font-mono text-meta text-ink-muted">
              {JSON.stringify(payout.providerPayload, null, 2)}
            </pre>
          </details>
        </Card>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-meta text-ink-subtle">{label}</dt>
      <dd className={`text-caption text-ink${mono ? " font-mono" : ""}`}>
        {value === null || value === "" ? (
          <span className="text-ink-subtle">—</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
