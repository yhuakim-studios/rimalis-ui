import { describe, expect, it } from "vitest";
import type { CommissionTier, VendorOrder } from "@rimalis/types";
import { TIER_WINDOW_DAYS, deriveTierProjection } from "./dashboard";
import { parseMoney } from "./money";

/**
 * The tier projection is the one place this app does arithmetic on money and then
 * shows a vendor the result as a claim about their own earnings. It is therefore
 * the one place worth a test table.
 *
 * Two properties matter more than the individual numbers, and both are asserted
 * below on real-shaped data:
 *
 * 1. **Commission comes out of the margin, not the sale price.** Getting this wrong
 *    overstates the cost of every tier by the cost-of-goods ratio, which on this
 *    platform is most of the sale — a plausible-looking number that is 4× too big.
 *    `splitMarginCommission` in the API is the counterpart; if these drift, the
 *    screen lies to a seller.
 * 2. **`actualKept` is read off the snapshots, never recomputed from a rate.**
 *    Historical lines carry the rate that was in force when they were bought, so a
 *    vendor who crossed a tier mid-window has a blend no single rate reproduces.
 */

const LADDER: CommissionTier[] = [
  { level: 0, name: "Starter", minReferrals: 0, rate: 0.1 },
  { level: 1, name: "Bronze", minReferrals: 3, rate: 0.09 },
  { level: 2, name: "Silver", minReferrals: 8, rate: 0.08 },
].map((tier) => ({
  ...tier,
  id: `tier-${String(tier.level)}`,
  isActive: true,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
}));

const NOW = new Date("2026-08-17T12:00:00.000Z");

/** Days before NOW, as an ISO instant — safely inside the Lagos day either way. */
const daysAgo = (days: number): string =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

interface LineSpec {
  totalPrice: string;
  totalCost: string;
  /** Defaults to `totalPrice − totalCost`, floored at 0, as the API computes it. */
  marginAmount?: string;
  /** Defaults to `totalPrice − margin × rate` at 10%. */
  vendorPayout?: string;
}

const order = (
  status: string,
  createdAt: string,
  lines: LineSpec[],
): VendorOrder => {
  const items = lines.map((line, index) => {
    const margin =
      line.marginAmount ??
      Math.max(0, Number(line.totalPrice) - Number(line.totalCost)).toFixed(2);
    return {
      id: `item-${String(index)}`,
      totalPrice: line.totalPrice,
      totalCost: line.totalCost,
      marginAmount: margin,
      vendorPayout:
        line.vendorPayout ??
        (Number(line.totalPrice) - Number(margin) * 0.1).toFixed(2),
      quantity: 1,
      fulfillmentStatus: "PENDING",
    };
  });

  // Only the fields the projection reads are real; the rest of VendorOrder is not
  // consulted, and inventing it would make the fixture harder to read, not safer.
  return { id: "order", status, createdAt, items } as unknown as VendorOrder;
};

describe("deriveTierProjection", () => {
  it("charges commission on the margin, not on the sale price", () => {
    // ₦10,000 sold, ₦8,000 cost → ₦2,000 margin. At 10% that is ₦200 commission,
    // NOT ₦1,000. Kept = 2,000 − 200 = ₦1,800.
    const orders = [order("PAID", daysAgo(1), [{ totalPrice: "10000.00", totalCost: "8000.00" }])];

    const projection = deriveTierProjection(orders, LADDER, 0.1, 0, NOW);

    expect(projection.sales).toBe(parseMoney("10000.00"));
    expect(projection.cost).toBe(parseMoney("8000.00"));
    expect(projection.margin).toBe(parseMoney("2000.00"));
    expect(projection.keptAtCurrentRate).toBe(parseMoney("1800.00"));
    // The wrong formula — a rate on revenue — would give 10,000 − 1,000 = 9,000
    // gross, i.e. ₦1,000 kept. Named here so a regression is unmistakable.
    expect(projection.keptAtCurrentRate).not.toBe(parseMoney("1000.00"));
  });

  it("prices each rung and measures every delta against the current rate", () => {
    const orders = [order("PAID", daysAgo(2), [{ totalPrice: "10000.00", totalCost: "8000.00" }])];

    const projection = deriveTierProjection(orders, LADDER, 0.1, 0, NOW);
    const [starter, bronze, silver] = projection.rows;

    expect(starter?.kept).toBe(parseMoney("1800.00")); // 2,000 − 10%
    expect(bronze?.kept).toBe(parseMoney("1820.00")); // 2,000 − 9%
    expect(silver?.kept).toBe(parseMoney("1840.00")); // 2,000 − 8%

    expect(starter?.delta).toBe(0);
    expect(bronze?.delta).toBe(parseMoney("20.00"));
    expect(silver?.delta).toBe(parseMoney("40.00"));

    expect(starter?.isCurrent).toBe(true);
    expect(bronze?.referralsNeeded).toBe(3);
    expect(silver?.reached).toBe(false);
  });

  it("reports a NEGATIVE delta for a rung whose rate is worse than today's", () => {
    // A vendor on Silver looking back down the ladder. Clamping this at zero would
    // render "no difference" on a rung that would in fact cost them money.
    const orders = [order("PAID", daysAgo(1), [{ totalPrice: "10000.00", totalCost: "8000.00" }])];

    const projection = deriveTierProjection(orders, LADDER, 0.08, 8, NOW);
    const starter = projection.rows[0];

    expect(projection.keptAtCurrentRate).toBe(parseMoney("1840.00"));
    expect(starter?.delta).toBe(-parseMoney("40.00"));
    expect(projection.rows[2]?.isCurrent).toBe(true);
  });

  it("reads actualKept off the snapshots, so a mixed-rate window still reconciles", () => {
    // Two identical sales, one charged at 10% and one at 8% — a vendor who crossed
    // a tier mid-window. No single rate reproduces the pair, which is the point.
    const orders = [
      order("PAID", daysAgo(1), [
        { totalPrice: "10000.00", totalCost: "8000.00", vendorPayout: "9800.00" },
      ]),
      order("PAID", daysAgo(2), [
        { totalPrice: "10000.00", totalCost: "8000.00", vendorPayout: "9840.00" },
      ]),
    ];

    const projection = deriveTierProjection(orders, LADDER, 0.08, 8, NOW);

    // Σ vendorPayout (19,640) − Σ totalCost (16,000).
    expect(projection.actualKept).toBe(parseMoney("3640.00"));
    // The current rung's projection is 4,000 − 8% = 3,680, and it deliberately
    // does NOT match: the older sale was charged at the old rate.
    expect(projection.keptAtCurrentRate).toBe(parseMoney("3680.00"));
    expect(projection.actualKept).not.toBe(projection.keptAtCurrentRate);
  });

  it("counts paid orders only, and only inside the window", () => {
    const line = [{ totalPrice: "10000.00", totalCost: "8000.00" }];
    const orders = [
      order("PAID", daysAgo(1), line),
      order("PENDING", daysAgo(1), line), // never paid
      order("CANCELLED", daysAgo(1), line), // reversed
      order("PAID", daysAgo(TIER_WINDOW_DAYS + 5), line), // before the window
    ];

    const projection = deriveTierProjection(orders, LADDER, 0.1, 0, NOW);

    expect(projection.orders).toBe(1);
    expect(projection.sales).toBe(parseMoney("10000.00"));
    expect(projection.hasSales).toBe(true);
  });

  it("floors margin per line, and still reports the real loss on a below-cost sale", () => {
    // Sold for less than it cost. The API floors marginAmount at 0 and charges no
    // commission — but the vendor is still ₦500 down, and `kept` must show that
    // rather than a comfortable zero.
    const orders = [
      order("PAID", daysAgo(1), [
        {
          totalPrice: "7500.00",
          totalCost: "8000.00",
          marginAmount: "0.00",
          vendorPayout: "7500.00",
        },
      ]),
    ];

    const projection = deriveTierProjection(orders, LADDER, 0.1, 0, NOW);

    expect(projection.margin).toBe(0);
    expect(projection.keptAtCurrentRate).toBe(-parseMoney("500.00"));
    expect(projection.actualKept).toBe(-parseMoney("500.00"));
    // No commission was charged, so every rung keeps the same amount — the ladder
    // is worth nothing on a loss-making sale, and the screen must not imply it is.
    expect(new Set(projection.rows.map((row) => row.kept)).size).toBe(1);
  });

  it("has no sales to project when the window is empty", () => {
    const projection = deriveTierProjection([], LADDER, 0.1, 0, NOW);

    expect(projection.hasSales).toBe(false);
    expect(projection.orders).toBe(0);
    expect(projection.actualKept).toBe(0);
    // Rows still exist so the ladder can be shown; every figure is zero, which is
    // why the page renders an empty state instead of the calculator.
    expect(projection.rows).toHaveLength(3);
    expect(projection.rows.every((row) => row.kept === 0)).toBe(true);
  });

  it("skips inactive rungs, which the resolver also ignores", () => {
    const withRetired: CommissionTier[] = [
      ...LADDER,
      {
        ...LADDER[0]!,
        id: "retired",
        level: 9,
        name: "Retired",
        minReferrals: 1,
        rate: 0.05,
        isActive: false,
      },
    ];
    const orders = [order("PAID", daysAgo(1), [{ totalPrice: "10000.00", totalCost: "8000.00" }])];

    const projection = deriveTierProjection(orders, withRetired, 0.1, 4, NOW);

    expect(projection.rows.map((row) => row.name)).toEqual([
      "Starter",
      "Bronze",
      "Silver",
    ]);
    // 4 referrals reaches Bronze (3) but not Silver (8) — and must not be lured
    // onto the retired 5% rung, which no longer exists as far as pricing goes.
    expect(projection.rows.find((row) => row.isCurrent)?.name).toBe("Bronze");
  });
});
