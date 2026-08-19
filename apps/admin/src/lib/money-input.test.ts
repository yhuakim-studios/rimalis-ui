import { describe, expect, it } from "vitest";
import { readInteger, readMoney } from "./money-input";

/**
 * `Number(formData.get(...))` is wrong in four ways here, and the first is the one
 * that matters: `Number("")` is 0, not NaN — so an empty price field would set a
 * product's price to ZERO rather than failing validation.
 */
describe("readMoney", () => {
  it("rejects an empty field rather than reading it as zero", () => {
    // The dangerous case. A silent 0 here is a product given away.
    const result = readMoney("", "Retail price");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("Retail price is required.");
  });

  it("accepts what a person actually types", () => {
    for (const [input, expected] of [
      ["12500", 12500],
      ["12500.50", 12500.5],
      ["12,500", 12500],
      ["₦12,500.50", 12500.5],
      ["  12500  ", 12500],
      ["NGN12500", 12500],
    ] as const) {
      const result = readMoney(input, "Price");
      expect(result.ok, `${input} should parse`).toBe(true);
      if (result.ok) expect(result.value).toBe(expected);
    }
  });

  it("names the constraint when there are too many decimals", () => {
    // The column is Decimal(12,2). An admin who typed three decimals meant
    // something, and "must be an amount" would not tell them what went wrong.
    const result = readMoney("12.345", "Cost price");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("at most 2 decimal places");
  });

  it("rejects text, negatives and stray symbols", () => {
    for (const input of ["abc", "-100", "1e5", "12.5.6", "$100", "--1"]) {
      expect(readMoney(input, "Price").ok, `${input} should fail`).toBe(false);
    }
  });

  it("rejects an amount wider than Decimal(12,2)", () => {
    expect(readMoney("99999999999", "Price").ok).toBe(false);
  });
});

describe("readInteger", () => {
  it("rejects an empty field rather than reading it as zero", () => {
    expect(readInteger("", "Stock").ok).toBe(false);
  });

  it("accepts a signed value only when asked", () => {
    expect(readInteger("-5", "Delta", { allowNegative: true })).toEqual({
      ok: true,
      value: -5,
    });
    expect(readInteger("-5", "Stock").ok).toBe(false);
  });

  it("strips thousands separators", () => {
    expect(readInteger("1,000", "Stock")).toEqual({ ok: true, value: 1000 });
  });

  it("rejects a decimal rather than truncating it", () => {
    // Truncating would credit or destroy stock the admin did not intend.
    expect(readInteger("10.5", "Stock").ok).toBe(false);
  });

  it("enforces a minimum when given one", () => {
    expect(readInteger("0", "Low stock threshold", { min: 1 }).ok).toBe(false);
    expect(readInteger("1", "Low stock threshold", { min: 1 }).ok).toBe(true);
  });
});
