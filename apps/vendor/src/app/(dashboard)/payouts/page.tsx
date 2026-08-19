import type { Metadata } from "next";
import Link from "next/link";
import { Info, Wallet } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/feedback";
import { Badge, Card, Pagination } from "@/components/primitives";
import { ctxFor, payouts as payoutsApi, requireApprovedVendor } from "@/lib/auth";
import { absoluteDate, badgeTone, payoutStatus, pluralise } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Payouts" };

const PAGE_SIZE = 20;

/**
 * Settlements — read-only, and that is a design decision rather than a gap.
 *
 * ## Why there is no "request payout" button, and must never be one
 *
 * Paystack splits every charge at payment time: each vendor's share goes straight to
 * their own subaccount as the shopper pays. By the time a row exists here the money has
 * already moved — these are a **ledger written after the fact**, created inside
 * `markSuccess()` in the same transaction that flips the payment to `SUCCESS`.
 *
 * A "request payout" action would therefore pay a vendor a second time for a charge
 * that already settled. The API has no endpoint for it, and adding one would be a
 * double-pay waiting to happen.
 *
 * That inverts the usual marketplace mental model, so the page says it out loud.
 * A vendor who expects a weekly payout run and sees an empty list will otherwise
 * conclude they have not been paid.
 *
 * ## `from`/`to` filter on the settlement PERIOD, not on `createdAt`
 *
 * A row written today can cover last week, so a date filter and the newest-first sort
 * do not agree — which is correct, and confusing enough to be worth labelling. No date
 * filter is offered yet for that reason: a "this month" control that silently excludes
 * a row dated today needs an explanation longer than the control.
 */
export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const { session, vendor } = await requireApprovedVendor("/payouts");
  const ctx = ctxFor(session);

  const parsed = Number.parseInt(pageParam ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;

  const [listResult, summaryResult] = await Promise.all([
    payoutsApi.list(ctx, { page, limit: PAGE_SIZE }),
    payoutsApi.summary(ctx),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-heading font-semibold tracking-tight">Payouts</h1>
        <p className="text-caption text-ink-muted">
          What has reached your bank account, and when.
        </p>
      </div>

      <Card className="flex flex-col gap-1">
        <span className="text-meta text-ink-muted">Settled to date</span>
        {/* Proportional figures, not tabular — this is a display-size hero number,
            and tabular digits read loose at this scale. */}
        <span className="text-heading font-semibold tracking-tight">
          {summaryResult.ok ? formatMoney(summaryResult.data.lifetimeTotal) : "—"}
        </span>
        <p className="text-meta text-ink-subtle">
          {summaryResult.ok
            ? // The API sums COMPLETED rows only, so calling this "total earnings"
              // would overstate it whenever a transfer is in flight.
              "Completed transfers only. Anything still in transit is not counted here."
            : "We couldn't load your total just now — the settlements below are still accurate."}
        </p>
      </Card>

      <Card tone="flat" className="flex items-start gap-2.5">
        <Info className="mt-0.5 size-4 shrink-0 text-ink-muted" strokeWidth={1.75} aria-hidden />
        <p className="text-meta text-ink-muted">
          <span className="font-semibold text-ink">You don't need to request anything.</span> Your
          share of each order is sent to your bank automatically at the moment the shopper pays —
          Paystack splits the payment. The rows below are the record of those transfers.
          {vendor.paystackSubaccountCode === null && (
            <>
              {" "}
              <Link
                href="/settings"
                prefetch={false}
                className="font-semibold text-danger underline decoration-danger/30 underline-offset-4"
              >
                You haven't added bank details yet, so no money can reach you.
              </Link>
            </>
          )}
        </p>
      </Card>

      {!listResult.ok ? (
        <Card padding="lg">
          <ErrorState error={listResult.error} title="We couldn't load your settlements" />
        </Card>
      ) : listResult.data.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<Wallet className="size-6" strokeWidth={1.5} />}
            title="No settlements yet"
            body="Once an order containing your items is paid for, the transfer to your bank appears here."
          />
        </Card>
      ) : (
        <>
          <p className="text-meta text-ink-subtle">{pluralise(listResult.meta.total, "settlement")}</p>

          <Card padding="none">
            <ul className="divide-y divide-divider">
              {listResult.data.map((payout) => {
                const status = payoutStatus(payout.status);

                return (
                  <li key={payout.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-caption font-semibold tabular-nums">
                          {formatMoney(payout.amount)}
                        </span>
                        <Badge tone={badgeTone(status.tone)}>{status.label}</Badge>
                      </div>
                      <span className="text-meta text-ink-subtle">
                        Covers {absoluteDate(payout.periodStart)} – {absoluteDate(payout.periodEnd)}
                      </span>
                      {/*
                        The Paystack reference. Shown because it is the one thing
                        support will ask for, and `truncate` because it is unbounded.
                        `providerPayload` is deliberately never rendered — it is raw
                        provider debug material, not vendor-facing.
                      */}
                      <span className="truncate text-meta text-ink-subtle tabular-nums">
                        Ref {payout.reference}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Pagination
            page={listResult.meta.page}
            totalPages={listResult.meta.totalPages}
            hrefForPage={(target) => (target > 1 ? `/payouts?page=${String(target)}` : "/payouts")}
          />
        </>
      )}
    </div>
  );
}
