import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import {
  Badge,
  Card,
  Pagination,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableShell,
} from "@/components/primitives";
import { EmptyState, ErrorState } from "@/components/feedback";
import { FilterBar } from "@/components/admin";
import { admin, ctxFor, requireAdmin } from "@/lib/auth";
import { absoluteDate, badgeTone, payoutStatus, shortRef } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { emptyCopy, hrefForPage, optional, pageParam } from "@/lib/admin-params";

export const metadata: Metadata = { title: "Payouts" };

/**
 * The settlement ledger. Read-only, and permanently so.
 *
 * ## Why there are no actions here, and why none may be added
 *
 * Paystack splits each charge across vendor subaccounts **at payment time**, so
 * the money has already moved before a Payout row exists. The row RECORDS a
 * settlement; it does not cause one. A "trigger payout" button would pay every
 * vendor a second time out of the platform's own balance.
 *
 * That is worth stating on the screen rather than only in a comment, because the
 * absence of a button on a page full of amounts reads as a missing feature to
 * anyone who has not been told otherwise — and the natural next step for someone
 * who thinks it is missing is to add it.
 *
 * ## `status` is a free-text filter, not a select
 *
 * `Payout.status` is a plain String column on the API, not a Postgres enum, and in
 * practice `markSuccess` writes every row COMPLETED. A `<select>` here would
 * advertise four states that mostly do not occur and would go stale the day a
 * fifth is written. A text field is honest about what it is matching.
 */
export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = optional(params["status"]);
  const from = optional(params["from"]);
  const to = optional(params["to"]);
  const page = pageParam(params["page"]);

  const { session } = await requireAdmin("/payouts");
  const result = await admin.listPayouts(ctxFor(session), {
    ...(status !== undefined ? { status } : {}),
    ...(from !== undefined ? { from } : {}),
    ...(to !== undefined ? { to } : {}),
    page,
  });

  const urlParams = { status, from, to };
  const filtered = Object.values(urlParams).some((v) => v !== undefined);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-heading font-semibold tracking-tight">Payouts</h1>
        <p className="text-body text-ink-muted">
          What each vendor has been settled. A record, not a control.
        </p>
      </div>

      <Card tone="flat">
        <p className="text-caption text-ink-muted">
          Paystack splits every charge across vendor subaccounts at the moment it
          is paid, so these rows describe money that has{" "}
          <strong className="font-semibold text-ink">already moved</strong>. There
          is deliberately nothing here to trigger a payment — doing so would pay
          the vendor twice.
        </p>
      </Card>

      <FilterBar
        basePath="/payouts"
        active={filtered}
        fields={[
          {
            name: "status",
            label: "Status",
            value: status,
            placeholder: "COMPLETED",
          },
          // `from`/`to` filter the settlement PERIOD, not the row's creation date —
          // which is the API's behaviour (periodStart >= / periodEnd <=) and the
          // one an accountant reconciling a month actually wants.
          { name: "from", label: "Period from", value: from, placeholder: "2026-08-01" },
          { name: "to", label: "Period to", value: to, placeholder: "2026-08-31" },
        ]}
      />

      {!result.ok ? (
        <ErrorState error={result.error} title="Couldn't load payouts" />
      ) : result.data.length === 0 ? (
        <EmptyState
          icon={<Wallet className="size-6" strokeWidth={1.5} />}
          {...emptyCopy({
            filtered,
            total: result.meta?.total ?? 0,
            page,
            noun: "payouts",
            genuinelyEmpty:
              "Settlement rows are written when a payment succeeds — one per vendor on the order.",
          })}
        />
      ) : (
        <>
          <TableShell>
            <Table>
              <THead>
                <TR>
                  <TH>Vendor</TH>
                  <TH align="end">Amount</TH>
                  <TH>Status</TH>
                  <TH priority="secondary">Period</TH>
                  <TH priority="secondary">Reference</TH>
                  <TH align="end" priority="secondary">
                    Recorded
                  </TH>
                </TR>
              </THead>
              <TBody>
                {result.data.map((payout) => {
                  const presentation = payoutStatus(payout.status);
                  return (
                    <TR key={payout.id}>
                      <TD>
                        <Link
                          href={`/vendors/${payout.vendor.id}`}
                          prefetch={false}
                          className="rounded-input font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                        >
                          {payout.vendor.storeName}
                        </Link>
                      </TD>
                      <TD align="end">{formatMoney(payout.amount)}</TD>
                      <TD>
                        <Badge tone={badgeTone(presentation.tone)}>
                          {presentation.label}
                        </Badge>
                      </TD>
                      <TD priority="secondary">
                        <span className="text-ink-muted">
                          {absoluteDate(payout.periodStart)} –{" "}
                          {absoluteDate(payout.periodEnd)}
                        </span>
                      </TD>
                      <TD priority="secondary">
                        <Link
                          href={`/payouts/${payout.id}`}
                          prefetch={false}
                          className="rounded-input font-mono text-meta hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                        >
                          {shortRef(payout.id)}
                        </Link>
                      </TD>
                      <TD align="end" priority="secondary">
                        <span className="text-ink-muted">
                          {absoluteDate(payout.createdAt)}
                        </span>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableShell>

          {result.meta && (
            <Pagination
              page={result.meta.page}
              totalPages={result.meta.totalPages}
              hrefForPage={(target) => hrefForPage("/payouts", urlParams, target)}
            />
          )}
        </>
      )}
    </div>
  );
}
