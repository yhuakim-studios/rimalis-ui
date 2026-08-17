import type { Metadata } from "next";
import type { ReferralRecruit } from "@rimalis/types";
import { Info, Users } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/feedback";
import { ReferralCodeCard, TierCalculator } from "@/components/referrals";
import { Badge, Card, Pagination } from "@/components/primitives";
import { ctxFor, requireApprovedVendor, vendor as vendorApi } from "@/lib/auth";
import { SAMPLE_SIZE, deriveTierProjection } from "@/lib/dashboard";
import {
  absoluteDate,
  badgeTone,
  pluralise,
  type StatusTone,
} from "@/lib/format";
import { formatNaira } from "@/lib/money";

export const metadata: Metadata = { title: "Referrals" };

const RECRUIT_LIMIT = 20;

const percent = (rate: number): string =>
  `${String(Number((rate * 100).toFixed(2)))}%`;

/**
 * How an unqualified recruit is described.
 *
 * All four statuses spelled out, because the first version of this fell back to
 * "Waiting on approval" for anything that was not APPROVED or REJECTED — and so
 * told the referrer that a **suspended** seller was awaiting review. A suspended
 * recruit is a store that traded and was stopped, which is neither of those things,
 * and the referrer is the one person who will notice.
 *
 * Suspension is deliberately not framed as the referrer's loss: credit already
 * earned is never withdrawn, and a recruit who had qualified would render as
 * "Counting" rather than reaching this function at all.
 */
const pipeline = (
  status: ReferralRecruit["status"],
): { label: string; tone: StatusTone; detail: string } => {
  switch (status) {
    case "PENDING":
      return {
        label: "Not yet",
        tone: "neutral",
        detail: "Waiting on approval from us",
      };
    case "APPROVED":
      return {
        label: "Not yet",
        tone: "neutral",
        detail: "Approved, but hasn't bought stock yet",
      };
    case "SUSPENDED":
      return {
        label: "Suspended",
        tone: "danger",
        detail:
          "Their store is suspended, so it can't qualify while that lasts",
      };
    case "REJECTED":
      return {
        label: "Not approved",
        tone: "danger",
        detail: "Their application wasn't accepted",
      };
  }
};

/**
 * Referrals, and what they are worth.
 *
 * ## Four requests in parallel, and why the orders one is here at all
 *
 * `/vendor/referrals/me`, `/commission-tiers`, `/vendor/referrals` and — the
 * surprising one — `/vendor/orders?limit=100`. There is no endpoint that prices a
 * commission tier against a vendor's own trading, so the calculator is computed
 * here from the same order page the dashboard uses. See `deriveTierProjection` in
 * `lib/dashboard.ts` for the maths and its stated limits.
 *
 * ## The two numbers a vendor confuses, kept apart on purpose
 *
 * **What counts** is a recruit who is approved *and* has bought stock. A signup
 * alone is worth nothing, and a screen that showed only the qualified figure would
 * read as though a referral had been lost — so the pipeline count is shown beside
 * it, with the rule stated in words.
 *
 * **What they are charged** is `currentRate`, which an admin override can detach
 * from the ladder entirely. `commissionRateOverride` on the profile cannot answer
 * this — it is null for most vendors, and null means "the ladder decides", not "the
 * platform default". This page never reads it.
 *
 * ## Failure is per-section
 *
 * The referral summary failing takes the page down, because the code and the
 * standing are the page. The recruits list and the projection failing do not: a
 * vendor who cannot load their order history can still copy their code and read the
 * ladder, and the alternative is an error screen for a feature that mostly worked.
 */
export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const { session } = await requireApprovedVendor("/referrals");
  const ctx = ctxFor(session);

  const parsed = Number.parseInt(pageParam ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;

  const [summaryResult, tiersResult, recruitsResult, ordersResult] =
    await Promise.all([
      vendorApi.referralSummary(ctx),
      vendorApi.commissionTiers(ctx),
      vendorApi.listReferrals(ctx, { page, limit: RECRUIT_LIMIT }),
      vendorApi.listOrders(ctx, { limit: SAMPLE_SIZE }),
    ]);

  if (!summaryResult.ok) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-heading font-semibold tracking-tight">Referrals</h1>
        <Card padding="lg">
          <ErrorState
            error={summaryResult.error}
            title="We couldn't load your referrals"
          />
        </Card>
      </div>
    );
  }

  const summary = summaryResult.data;

  // The projection needs both the ladder and the orders. Missing either means no
  // calculator — not a zeroed one, which would tell a vendor their trading was
  // worth nothing.
  const projection =
    tiersResult.ok && ordersResult.ok
      ? deriveTierProjection(
          ordersResult.data,
          tiersResult.data,
          summary.currentRate,
          summary.qualifiedReferralCount,
        )
      : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-heading font-semibold tracking-tight">Referrals</h1>
        <p className="text-caption text-ink-muted">
          Bring other sellers onto Rimalis and pay less commission on what you
          sell.
        </p>
      </div>

      <ReferralCodeCard code={summary.referralCode} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card padding="sm" tone="flat" className="flex flex-col gap-1">
          <span className="text-meta text-ink-muted">Qualified referrals</span>
          <span className="text-section font-semibold tracking-tight tabular-nums">
            {summary.qualifiedReferralCount}
          </span>
          <span className="text-meta text-ink-subtle">
            Approved and trading
          </span>
        </Card>

        <Card padding="sm" tone="flat" className="flex flex-col gap-1">
          <span className="text-meta text-ink-muted">Still to qualify</span>
          <span className="text-section font-semibold tracking-tight tabular-nums">
            {summary.pendingReferralCount}
          </span>
          <span className="text-meta text-ink-subtle">
            Applied, not yet approved or stocked
          </span>
        </Card>

        <Card padding="sm" tone="flat" className="flex flex-col gap-1">
          <span className="text-meta text-ink-muted">Your commission</span>
          <span className="text-section font-semibold tracking-tight tabular-nums">
            {percent(summary.currentRate)}
          </span>
          <span className="text-meta text-ink-subtle">
            {summary.rateIsOverridden
              ? "An agreed rate for your account"
              : summary.currentTier
                ? `${summary.currentTier.name} tier`
                : "Of your margin on each sale"}
          </span>
        </Card>
      </div>

      {/* The rule, stated once, in the place a vendor looks when a referral
          "hasn't counted". Both halves matter: what qualifies, and that credit is
          never taken back — the second is policy on the API side, and a vendor who
          assumes their tier should have dropped will not trust the number. */}
      <Card tone="flat" className="flex items-start gap-2.5">
        <Info
          className="mt-0.5 size-4 shrink-0 text-ink-muted"
          strokeWidth={1.75}
          aria-hidden
        />
        <p className="text-meta text-ink-muted">
          <span className="font-semibold text-ink">
            A referral counts once your seller is approved and has bought their
            first stock.
          </span>{" "}
          Signing up alone doesn&apos;t count — that&apos;s what keeps the
          scheme fair for everyone on it. Once a referral counts, it stays
          counted, even if that seller later stops trading.
          {summary.nextTier !== null && summary.referralsNeeded !== null && (
            <>
              {" "}
              You need{" "}
              <span className="font-semibold text-ink">
                {pluralise(summary.referralsNeeded, "more qualified referral")}
              </span>{" "}
              to reach {summary.nextTier.name} at{" "}
              {percent(summary.nextTier.rate)}.
            </>
          )}
          {summary.nextTier === null && " You're on the top tier."}
        </p>
      </Card>

      {projection === null ? (
        // Not an <ErrorState>: that component states a request failed, and here
        // the page's own subject loaded fine — only the optional calculator is
        // missing. Saying "we couldn't load your referrals" over a working
        // referral screen is the more alarming lie.
        <Card tone="flat" className="flex flex-col gap-1">
          <span className="text-caption font-semibold">
            The tier calculator isn&apos;t available right now
          </span>
          <p className="text-meta text-ink-muted">
            Your code, your referral count and your commission rate above are
            all accurate — we just couldn&apos;t load the figures needed to
            price the other tiers. Reloading usually fixes it.
          </p>
        </Card>
      ) : !projection.hasSales ? (
        <Card padding="none">
          <EmptyState
            icon={<Users className="size-6" strokeWidth={1.5} />}
            title="No sales in the last 30 days"
            body="Once you've made some sales we can show you exactly what each tier would be worth on your own trading, rather than a made-up example."
          />
        </Card>
      ) : (
        <>
          <TierCalculator
            rows={projection.rows}
            qualifiedCount={summary.qualifiedReferralCount}
            windowDays={projection.windowDays}
            keptAtCurrentRate={projection.keptAtCurrentRate}
            currentRate={summary.currentRate}
            rateIsOverridden={summary.rateIsOverridden}
          />

          <Card tone="flat" className="flex flex-col gap-1">
            <span className="text-meta text-ink-muted">
              What you actually kept, last {projection.windowDays} days
            </span>
            <span className="text-section font-semibold tracking-tight tabular-nums">
              {formatNaira(projection.actualKept)}
            </span>
            <p className="text-meta text-ink-subtle">
              {/* Deliberately NOT the current tier's projected figure. Historical
                  lines carry the rate that was in force when they were bought, so a
                  vendor who crossed a tier mid-window has a blend no single rate
                  reproduces. Presenting the two as one number would be the lie. */}
              Your share of {pluralise(projection.orders, "paid order")}, after
              commission, minus what you paid for the stock. Sales you made
              before a tier change keep their original rate, so this can differ
              from the estimate above.
              {projection.truncated && (
                <>
                  {" "}
                  <span className="font-semibold text-ink">
                    Based on your {SAMPLE_SIZE} most recent orders,
                  </span>{" "}
                  so if you traded more than that in this period the real figure
                  is higher.
                </>
              )}
            </p>
          </Card>
        </>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-section font-semibold tracking-tight">
          Sellers you brought on
        </h2>

        {!recruitsResult.ok ? (
          <Card padding="lg">
            <ErrorState
              error={recruitsResult.error}
              title="We couldn't load your referrals"
            />
          </Card>
        ) : recruitsResult.data.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<Users className="size-6" strokeWidth={1.5} />}
              title="Nobody yet"
              body="Share your code above. When a seller enters it on their application, they'll appear here — and they'll count towards your tier once they're approved and have bought stock."
            />
          </Card>
        ) : (
          <>
            <p className="text-meta text-ink-subtle">
              {pluralise(recruitsResult.meta.total, "seller")}
            </p>
            <Card padding="none">
              <ul className="divide-y divide-divider">
                {recruitsResult.data.map((recruit) => (
                  <li
                    key={recruit.id}
                    className="flex items-center gap-3 px-4 py-3.5"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-caption font-semibold">
                          {recruit.storeName}
                        </span>
                        {recruit.referralQualifiedAt !== null ? (
                          <Badge tone="brand">Counting</Badge>
                        ) : (
                          <Badge
                            tone={badgeTone(pipeline(recruit.status).tone)}
                          >
                            {pipeline(recruit.status).label}
                          </Badge>
                        )}
                      </div>
                      <span className="text-meta text-ink-subtle">
                        {recruit.referralQualifiedAt !== null
                          ? `Counting towards your tier since ${absoluteDate(recruit.referralQualifiedAt)}`
                          : `${pipeline(recruit.status).detail} — applied ${absoluteDate(recruit.createdAt)}`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Pagination
              page={recruitsResult.meta.page}
              totalPages={recruitsResult.meta.totalPages}
              hrefForPage={(target) =>
                target > 1 ? `/referrals?page=${String(target)}` : "/referrals"
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
