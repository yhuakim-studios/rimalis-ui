import { describe, expect, it } from "vitest";
import {
  MAX_SAFE_MINOR,
  ZERO,
  formatMoney,
  formatNaira,
  multiply,
  parseMoney,
  parseMoneyOrNull,
  subtract,
  sum,
  type Minor,
} from "./money";

/**
 * `parseMoney` is the only place a plain string becomes a `Minor`, which means
 * it is the only place the brand can be wrong — every other function in the
 * module receives an already-validated value. So all of the module's risk is
 * concentrated here, and this table is what pays for concentrating it.
 *
 * The rejections matter more than the acceptances. Each one below is a string
 * that `Number()` would happily convert to something, off by a factor of 10,
 * 100 or ∞ — a silently wrong price on a product card, which a shopper does not
 * report as a bug.
 */

describe("parseMoney", () => {
  const accepts: ReadonlyArray<readonly [input: string, kobo: number, why: string]> = [
    ["0", 0, "free is a legal price even if nothing is priced that way today"],
    ["175000", 17_500_000, "no fraction at all — Prisma omits `.00` in some paths"],
    ["175000.00", 17_500_000, "the usual Decimal(12,2) serialisation"],
    ["175000.5", 17_500_050, "ONE fraction digit means TENTHS: 50 kobo, not 5"],
    ["175000.05", 17_500_005, "and two digits mean hundredths"],
    ["0.05", 5, "five kobo"],
    ["0.5", 50, "the padding bug in miniature — must be 50, never 5"],
    ["24000.00", 2_400_000, "the cheapest seeded product"],
    ["1480000.00", 148_000_000, "the dearest seeded product"],
    ["9999999999.99", 999_999_999_999, "the widest Decimal(12,2) can hold"],
  ];

  for (const [input, kobo, why] of accepts) {
    it(`parses ${JSON.stringify(input)} as ${kobo} kobo — ${why}`, () => {
      expect(parseMoney(input)).toBe(kobo);
    });
  }

  const rejects: ReadonlyArray<readonly [input: string, why: string]> = [
    ["", "empty string: Number('') is 0, so a naive parser prices it free"],
    [" ", "whitespace: Number(' ') is also 0"],
    ["175000 ", "trailing whitespace — tolerating it invites tolerating the rest"],
    [" 175000", "leading whitespace"],
    ["0.005", "three decimals cannot be kobo; rounding would hide a scale change"],
    ["1e5", "valid JS, Number('1e5') is 100000 — wrong by the exponent"],
    ["1E5", "same, uppercase"],
    ["175,000", "Number('175,000') is NaN, which renders as ₦NaN on a card"],
    ["-1", "no negative amounts exist here; a refund is its own record"],
    ["-0.01", "including small ones"],
    ["+175000", "an explicit sign means the field is not what the caller thinks"],
    ["175000.", "a dot with no digits after it"],
    [".50", "a dot with no digits before it"],
    ["NaN", "Number('NaN') is NaN"],
    ["Infinity", "Number('Infinity') is Infinity, which formats as ₦∞"],
    ["0x10", "Number('0x10') is 16 — hex is legal to Number and not to us"],
    ["1_000", "numeric separators are a JS literal feature, not a wire format"],
    ["₦175000", "the symbol belongs to the formatter, never to the value"],
    ["175000.000", "three zeros are still three decimals"],
  ];

  for (const [input, why] of rejects) {
    it(`rejects ${JSON.stringify(input)} — ${why}`, () => {
      expect(() => parseMoney(input)).toThrow(/Not a money value/);
    });
  }

  it("rejects a value above the kobo ceiling with a message naming the likely cause", () => {
    // The realistic way to reach this is passing an amount that is ALREADY in
    // kobo — the error says so, because "out of range" alone sends the reader
    // looking at the product data rather than at their own call site.
    const alreadyKobo = String(MAX_SAFE_MINOR + 1);
    expect(() => parseMoney(alreadyKobo)).toThrow(/already in kobo/);
  });

  it("parses the two halves as integers rather than multiplying a float", () => {
    // The obvious implementation is `Math.round(Number(d) * 100)`, and it is
    // wrong for 1146 of the 10,000 two-decimal values below ₦100 alone: the
    // product is not an integer, so `Number.isSafeInteger` on it fails and the
    // parse throws on a perfectly valid price. `Math.round` would paper over
    // that and quietly make the guard useless.
    //
    // These three are the cheapest witnesses — one rounding up, one down.
    expect(Number("0.07") * 100).not.toBe(7);
    expect(Number("0.29") * 100).not.toBe(29);
    expect(Number("0.55") * 100).not.toBe(55);

    expect(parseMoney("0.07")).toBe(7);
    expect(parseMoney("0.29")).toBe(29);
    expect(parseMoney("0.55")).toBe(55);

    // And the top of the Decimal(12,2) range, where any float error would be
    // largest in absolute terms.
    expect(parseMoney("9999999999.99")).toBe(999_999_999_999);
  });
});

describe("parseMoneyOrNull", () => {
  it("passes null and undefined straight through", () => {
    // `vendorPrice` is nullable on the wire and its null means "inherit the
    // product's base price" — a real state, not a missing value.
    expect(parseMoneyOrNull(null)).toBeNull();
    expect(parseMoneyOrNull(undefined)).toBeNull();
  });

  it("still rejects a malformed non-null value", () => {
    expect(() => parseMoneyOrNull("1e5")).toThrow(/Not a money value/);
  });
});

describe("multiply", () => {
  const unit = parseMoney("24000.00");

  it("scales by a whole number of items", () => {
    expect(multiply(unit, 3)).toBe(7_200_000);
  });

  it("is zero at quantity zero", () => {
    expect(multiply(unit, 0)).toBe(0);
  });

  it("rejects a fractional quantity", () => {
    // `<input type="number">` and a hand-edited cart cookie can both produce
    // this, and it has to be caught somewhere that cannot be skipped.
    expect(() => multiply(unit, 2.5)).toThrow(/non-negative integer/);
  });

  it("rejects NaN, which is what an unparsed form field looks like", () => {
    expect(() => multiply(unit, Number("abc"))).toThrow(/non-negative integer/);
  });

  it("rejects a negative quantity", () => {
    expect(() => multiply(unit, -1)).toThrow(/non-negative integer/);
  });

  it("throws rather than drift past the ceiling", () => {
    expect(() => multiply(parseMoney("9999999999.99"), 50)).toThrow(/ceiling/);
  });
});

describe("sum", () => {
  it("adds a realistic multi-vendor basket exactly", () => {
    // The operation the whole module exists for: the cart subtotal.
    const lines: Minor[] = [
      multiply(parseMoney("24000.00"), 2),
      multiply(parseMoney("1480000.00"), 1),
      multiply(parseMoney("8500.50"), 3),
    ];
    expect(sum(...lines)).toBe(4_800_000 + 148_000_000 + 2_550_150);
  });

  it("is ZERO when empty — an empty cart has a subtotal, not an absence", () => {
    expect(sum()).toBe(ZERO);
  });

  it("stays exact over many awkward fractions, where float naira would not", () => {
    // 100 × ₦0.07. In naira floats this accumulates visible error; in kobo it
    // is 100 × 7.
    const seven = parseMoney("0.07");
    expect(sum(...Array.from({ length: 100 }, () => seven))).toBe(700);
    expect(Array.from({ length: 100 }, () => 0.07).reduce((a, b) => a + b)).not.toBe(7);
  });
});

describe("subtract", () => {
  it("subtracts", () => {
    expect(subtract(parseMoney("100.00"), parseMoney("25.50"))).toBe(7_450);
  });

  it("clamps at zero instead of producing a negative amount", () => {
    // A negative here is a server-side data problem, and "₦0.00" is a better
    // failure than a blank page in the one place this is used (adjustment
    // display). Documented at the function.
    expect(subtract(parseMoney("10.00"), parseMoney("25.00"))).toBe(0);
  });
});

describe("formatNaira", () => {
  const cases: ReadonlyArray<readonly [kobo: number, expected: string]> = [
    [0, "₦0.00"],
    [5, "₦0.05"],
    [50, "₦0.50"],
    [100, "₦1.00"],
    [2_400_000, "₦24,000.00"],
    [148_000_000, "₦1,480,000.00"],
    [2_500_001, "₦25,000.01"],
  ];

  for (const [kobo, expected] of cases) {
    it(`formats ${kobo} kobo as ${expected}`, () => {
      expect(formatNaira(kobo as Minor)).toBe(expected);
    });
  }

  it("always shows two fraction digits, whatever the ICU default for NGN is", () => {
    // Pinned because ICU has changed NGN's default fraction digits, and
    // "₦175,000" beside "₦175,000.00" on the next page reads as a bug.
    expect(formatNaira(parseMoney("175000"))).toBe("₦175,000.00");
  });

  it("groups thousands, which is the only reason to use Intl here at all", () => {
    expect(formatNaira(parseMoney("1234567.89"))).toBe("₦1,234,567.89");
  });
});

describe("formatMoney", () => {
  it("is parse + format, for the common case of rendering a price straight through", () => {
    expect(formatMoney("175000.00")).toBe("₦175,000.00");
  });

  it("inherits parseMoney's strictness rather than silently rendering something", () => {
    expect(() => formatMoney("175,000")).toThrow(/Not a money value/);
  });
});
