"use client";

import { useId, useState } from "react";
import { Badge, Card, cn } from "@/components/primitives";
import { compactNaira, nairaFromKobo } from "@/lib/format";

/**
 * The commission ladder, priced against this vendor's own recent trading, with a
 * what-if control over referral count.
 *
 * ## Why the ladder table and the slider are ONE component
 *
 * The slider's whole job is to move the highlight down the table and change which
 * "you would have kept" figure is being compared against. Splitting them would
 * mean either duplicating the ladder (a static server table plus a projected client
 * one, which can disagree) or lifting state into a wrapper that exists only to pass
 * it back down. The table is the slider's output.
 *
 * ## Why a native range input and no chart
 *
 * There is no charting library in this monorepo and this does not justify one — the
 * shape here is a short ordered list of rungs, which is a table. `SalesChart` is the
 * precedent for hand-rolling from divs when a visual is genuinely warranted; a
 * five-row ladder is not.
 *
 * `<input type="range">` is keyboard-operable, announces its value, and is
 * touch-friendly at no cost. A custom drag handle would have to re-earn all three.
 *
 * ## What the numbers mean, and the one honest caveat
 *
 * Every figure is computed from `deriveTierProjection` on the server and passed in
 * as plain data — **the formatters are imported here rather than passed as props,
 * because a function cannot cross the RSC boundary** (the mistake
 * `SalesChart.tsx` documents having already made once). They are the
 * plain-`number` variants in `lib/format`, since kobo arrives over that boundary
 * as JSON numbers rather than as branded `Minor` values.
 *
 * The projection applies one rate to an aggregate margin, while the API charges
 * commission per order line. The difference is a few kobo over a month, and the
 * caption says the figures are estimates rather than implying they reconcile to a
 * payout.
 */

export interface TierCalculatorRow {
  level: number;
  name: string;
  rate: number;
  minReferrals: number;
  /** Kobo — integer minor units. See lib/money.ts. */
  kept: number;
  /** Kobo, signed: negative on a rung whose rate is worse than today's. */
  delta: number;
  referralsNeeded: number;
  reached: boolean;
  isCurrent: boolean;
}

export interface TierCalculatorProps {
  rows: readonly TierCalculatorRow[];
  /** Qualified referrals today — where the slider starts and the baseline sits. */
  qualifiedCount: number;
  windowDays: number;
  /** Kobo. The baseline every `delta` is measured against. */
  keptAtCurrentRate: number;
  currentRate: number;
  /** True when an admin override is in force, so the ladder is not what they pay. */
  rateIsOverridden: boolean;
}

const percent = (rate: number): string =>
  `${String(Number((rate * 100).toFixed(2)))}%`;

export function TierCalculator({
  rows,
  qualifiedCount,
  windowDays,
  keptAtCurrentRate,
  currentRate,
  rateIsOverridden,
}: TierCalculatorProps) {
  const sliderId = useId();

  // The ceiling is the top rung's threshold, not an arbitrary round number: past
  // it nothing changes, and a slider with dead travel invites the vendor to
  // conclude the ladder goes further than it does.
  const maxReferrals = Math.max(
    qualifiedCount,
    ...rows.map((row) => row.minReferrals),
  );
  const [projected, setProjected] = useState(qualifiedCount);

  const reachedAt = rows.filter((row) => projected >= row.minReferrals);
  const projectedRung = reachedAt[reachedAt.length - 1] ?? null;
  const isProjection = projected !== qualifiedCount;

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-section font-semibold tracking-tight">
          What the next tier is worth
        </h2>
        <p className="text-meta text-ink-muted">
          Based on your last {windowDays} days of paid sales. Commission comes
          out of your margin — what a product sells for, minus what you paid for
          it — so these are what you would have kept, not what you would have
          sold.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={sliderId} className="text-meta text-ink-muted">
          If you had{" "}
          <span className="font-semibold text-ink tabular-nums">
            {projected}
          </span>{" "}
          qualified {projected === 1 ? "referral" : "referrals"}
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={maxReferrals}
          step={1}
          value={projected}
          onChange={(event) => setProjected(Number(event.target.value))}
          className="w-full accent-brand-600"
        />
        <div className="flex justify-between text-meta text-ink-subtle tabular-nums">
          <span>0</span>
          <span>{maxReferrals}</span>
        </div>

        {projectedRung && (
          <p className="text-caption text-ink">
            {isProjection ? (
              <>
                You&apos;d be on{" "}
                <span className="font-semibold">{projectedRung.name}</span> at{" "}
                {percent(projectedRung.rate)} —{" "}
                {projectedRung.delta === 0 ? (
                  "the same as today."
                ) : (
                  // The direction is carried by the WORD, not by a colour. This
                  // theme's accent is black and `--color-success` is an alias of
                  // it, so a green/black distinction does not exist to lean on —
                  // see the warning on that token in packages/config.
                  <span
                    className={cn(
                      "font-semibold",
                      projectedRung.delta > 0
                        ? "text-brand-700"
                        : "text-danger",
                    )}
                  >
                    {nairaFromKobo(Math.abs(projectedRung.delta))}{" "}
                    {projectedRung.delta > 0 ? "more" : "less"} kept over these{" "}
                    {windowDays} days.
                  </span>
                )}
              </>
            ) : (
              <>
                That&apos;s where you are now — {projectedRung.name} at{" "}
                {percent(projectedRung.rate)}. Drag to see what recruiting more
                would have been worth.
              </>
            )}
          </p>
        )}
      </div>

      {/* The ladder. A table because it is tabular: five rungs, four measures,
          compared down columns. `scope` on the headers so a screen reader can
          associate a cell with both its row and its column. */}
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[30rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-divider text-meta text-ink-muted">
              <th scope="col" className="py-2 pr-3 font-medium">
                Tier
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Referrals
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Commission
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                You&apos;d have kept
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isProjected = row.level === projectedRung?.level;

              return (
                <tr
                  key={row.level}
                  className={cn(
                    "border-b border-divider/60 last:border-0",
                    // Unreached rungs are dimmed rather than hidden: the ladder is
                    // the incentive, and hiding its top is hiding the reason to
                    // recruit. Dimming keeps today's row the one that reads first.
                    !row.reached && !isProjected && "text-ink-subtle",
                  )}
                >
                  <td className="py-2.5 pr-3">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "text-caption",
                          (row.isCurrent || isProjected) &&
                            "font-semibold text-ink",
                        )}
                      >
                        {row.name}
                      </span>
                      {row.isCurrent && <Badge tone="brand">Now</Badge>}
                      {isProjected && !row.isCurrent && (
                        <Badge tone="neutral">Projected</Badge>
                      )}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-caption tabular-nums">
                    {row.minReferrals}
                    {!row.reached && row.referralsNeeded > 0 && (
                      <span className="text-meta text-ink-subtle">
                        {" "}
                        ({row.referralsNeeded} more)
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-caption tabular-nums">
                    {percent(row.rate)}
                  </td>
                  <td className="py-2.5 text-right text-caption tabular-nums">
                    <span
                      className={cn(
                        (row.isCurrent || isProjected) && "font-semibold",
                      )}
                    >
                      {compactNaira(row.kept)}
                    </span>
                    {row.delta !== 0 && (
                      // Sign written out, so the comparison survives without
                      // colour — the only distinction available here is weight.
                      <span
                        className={cn(
                          "block text-meta",
                          row.delta > 0
                            ? "font-medium text-brand-700"
                            : "text-ink-subtle",
                        )}
                      >
                        {row.delta > 0 ? "+" : "−"}
                        {compactNaira(Math.abs(row.delta))}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-meta text-ink-subtle">
        Estimates, from your own recent orders. Sales you have already made keep
        the commission rate that was in force when they were bought — moving up
        a tier changes future orders only.
        {rateIsOverridden && (
          <>
            {" "}
            Your account is on an agreed rate of {percent(currentRate)}, which
            applies instead of the tier rate. The comparison above is against
            that rate, and it is the number{" "}
            <span className="font-semibold text-ink">
              {nairaFromKobo(keptAtCurrentRate)}
            </span>{" "}
            is based on.
          </>
        )}
      </p>
    </Card>
  );
}
