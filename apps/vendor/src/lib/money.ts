/**
 * Money, as branded integer minor units (kobo).
 *
 * See docs/decisions/0007-cart-and-money-representation.md for the full
 * argument. The short version, because it governs how this module may be used:
 *
 * ## Every number this module produces is DISPLAY-ONLY
 *
 * `POST /orders` accepts `{ vendorProductId, quantity }` and nothing else. The
 * API snapshots unit price, commission, vendor payout, product name and SKU
 * itself, server-side, from its own database. There is no field on any request
 * in the entire API into which a client-computed amount could be placed.
 *
 * That is why integer arithmetic in a `number` is safe here, and it is also the
 * rule to defend: if you ever find yourself computing a total in order to SEND
 * it, stop — the endpoint you are calling does not want it, and the one that
 * did would be a vulnerability.
 *
 * ## Why not decimal.js / dinero.js
 *
 * Two reasons, in order of importance. First, a decimal library makes this
 * arithmetic *look* authoritative, which invites exactly the mistake above; a
 * module that says "display-only" in its header does not. Second, there is no
 * division anywhere in this app — subtotal is `sum(unitPrice × integerQty)`,
 * and multiplication of an integer by an integer plus addition of integers are
 * the two operations binary floating point performs EXACTLY, as long as the
 * result stays under 2^53. It does, by nine orders of magnitude: see
 * MAX_SAFE_MINOR.
 *
 * ## Why not bigint
 *
 * `bigint` does not survive the RSC serialization boundary — a Server Component
 * cannot pass one to a Client Component as a prop. Since the totals are
 * computed on the server and rendered in interactive cart UI, that rules it out
 * on plumbing grounds before the ergonomics are even considered.
 *
 * ## Why the brand
 *
 * A bare `number` holding kobo is indistinguishable, to the compiler and to the
 * reader, from one holding naira and from one holding a quantity. `175000`
 * could be ₦1,750.00 or ₦175,000.00, and the two are 100× apart. The brand
 * makes `formatNaira(quantity)` and `multiply(naira, qty)` type errors, which
 * is the entire safety story: all the risk is concentrated into `parseMoney`,
 * the one place a plain value becomes a `Minor`, and that function has a test
 * table.
 */

declare const brand: unique symbol;

/**
 * An integer number of kobo. 100 kobo = ₦1.
 *
 * Only `parseMoney`, `multiply`, `sum`, `subtract` and `ZERO` produce these.
 * Never write `const x = 500 as Minor` — that is the cast the brand exists to
 * prevent, and if you need a literal, `parseMoney("5.00")` is the honest form.
 */
export type Minor = number & { readonly [brand]: "kobo" };

/**
 * ₦90,000,000,000 in kobo (9 × 10^12).
 *
 * Well above anything this marketplace will see — the dearest seeded product is
 * ₦1.48m, and 50 lines (the API's own cap) of the dearest imaginable item is
 * still ~10^10 kobo. It sits ~1000× below `Number.MAX_SAFE_INTEGER`
 * (9.007 × 10^15), which is the real bound: below it, integer addition and
 * multiplication in a double are exact. Crossing this ceiling means something
 * has gone wrong upstream (a decimal parsed as kobo, say), so the arithmetic
 * helpers throw rather than silently drift into inexact territory.
 */
export const MAX_SAFE_MINOR = 9_000_000_000_000;

export const ZERO = 0 as Minor;

/**
 * Matches the API's `Decimal(12, 2)` serialisation, and nothing else.
 *
 * Deliberately strict about each rejection:
 *
 * - No sign. Prisma emits `-` for negatives, and there is no legitimate
 *   negative amount in this app — a refund is its own record, not a negative
 *   price. A leading `-` means the field is not what the caller thinks it is.
 * - No exponent. `"1e5"` is valid JSON and valid JavaScript, and
 *   `Number("1e5")` is 100000, so an exponent would sail through a naive
 *   parser and be off by whatever the exponent was.
 * - No grouping separators. `Number("175,000")` is `NaN`, which would surface
 *   as `₦NaN` on a product card rather than as an error anyone can act on.
 * - At most two decimal places. `"0.005"` cannot be represented in kobo, and
 *   the only honest options are to round it or to reject it. It rejects: a
 *   third decimal from a `Decimal(12, 2)` column is a contract violation, and
 *   rounding it would hide the day the column's scale changed.
 * - `.` requires at least one digit after it, so `"12."` is out.
 */
const DECIMAL = /^(\d+)(?:\.(\d{1,2}))?$/;

/**
 * The single trust boundary: a wire `Money` string becomes a `Minor` here.
 *
 * Throws rather than returning a fallback. A `0` fallback would render as
 * "₦0.00" — a plausible-looking price that is wrong — on a product card, and a
 * shopper who sees a free item does not file a bug, they click Add to cart.
 * Throwing surfaces in the nearest `error.tsx` with a request id, which is
 * recoverable; a silently wrong price is not.
 *
 * @param decimal a decimal string from the API, e.g. `"175000.00"`
 * @throws if `decimal` is not a non-negative decimal with ≤2 fraction digits
 */
export function parseMoney(decimal: string): Minor {
  const match = DECIMAL.exec(decimal);
  if (!match) {
    throw new Error(
      `Not a money value: ${JSON.stringify(decimal)}. ` +
        "Expected a non-negative decimal string with at most 2 fraction digits, " +
        'e.g. "175000" or "175000.00".',
    );
  }

  // Both groups are digits-only by construction, so parseInt cannot yield NaN.
  // `naira` is index 1 and non-optional in the pattern; `fraction` is optional.
  const naira = Number(match[1]);
  const fraction = match[2] ?? "";
  // "5" means 50 kobo, not 5 — pad to exactly two places before reading it.
  const kobo = Number(fraction.padEnd(2, "0"));

  const total = naira * 100 + kobo;
  if (!Number.isSafeInteger(total) || total > MAX_SAFE_MINOR) {
    throw new Error(
      `Money value out of range: ${JSON.stringify(decimal)} exceeds the ` +
        `${MAX_SAFE_MINOR} kobo ceiling. This almost certainly means a value ` +
        "already in kobo was parsed as naira.",
    );
  }

  return total as Minor;
}

/**
 * `parseMoney` for a nullable field, e.g. `vendorPrice`.
 *
 * Separate function rather than a nullable parameter so a caller cannot pass a
 * possibly-null value by accident and get a possibly-null result they forgot to
 * narrow — under `noUncheckedIndexedAccess` and `strictNullChecks` the two
 * signatures read differently at the call site, which is the point.
 */
export function parseMoneyOrNull(decimal: string | null | undefined): Minor | null {
  return decimal === null || decimal === undefined ? null : parseMoney(decimal);
}

/**
 * Line total: a unit price times a whole number of items.
 *
 * `quantity` must be a non-negative safe integer. It is not branded because it
 * comes from the cart cookie and from `<input type="number">`, both of which
 * can produce `2.5` or `NaN`, and the check has to happen somewhere — here is
 * the place it cannot be skipped.
 */
export function multiply(unit: Minor, quantity: number): Minor {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new Error(`Quantity must be a non-negative integer, got ${quantity}`);
  }
  return guard(unit * quantity);
}

/** Sum of any number of amounts. `sum()` with no arguments is ZERO. */
export function sum(...amounts: readonly Minor[]): Minor {
  return guard(amounts.reduce<number>((acc, m) => acc + m, 0));
}

/**
 * `a - b`, clamped at zero.
 *
 * Clamped rather than throwing because the one caller is discount and
 * shipping-adjustment display, where a negative intermediate is a data problem
 * on the server and showing "₦0.00" is a better failure than a blank page. If a
 * future caller needs to distinguish the two cases, it should compare first
 * rather than relax this.
 */
export function subtract(a: Minor, b: Minor): Minor {
  return guard(Math.max(0, a - b));
}

function guard(value: number): Minor {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Money arithmetic produced a non-integer: ${value}`);
  }
  if (value > MAX_SAFE_MINOR) {
    throw new Error(`Money arithmetic exceeded the ${MAX_SAFE_MINOR} kobo ceiling: ${value}`);
  }
  return value as Minor;
}

/**
 * One formatter, constructed once.
 *
 * `Intl.NumberFormat` construction is the expensive part — it resolves locale
 * data — and doing it per product card is measurable on a 24-item grid. workerd
 * ships full ICU, so `en-NG` and the `₦` symbol resolve there as they do in
 * Node; this does not need a fallback.
 *
 * Explicit min and max fraction digits because the defaults for NGN differ
 * between ICU versions, and "₦175,000" on one page next to "₦175,000.00" on
 * another is the kind of inconsistency that reads as a bug.
 */
const NAIRA = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * `2500000` → `"₦25,000.00"`.
 *
 * This is the one division in the module, and the header says there is none —
 * so: it is here, at the very last step, after all arithmetic is finished, and
 * its result is never fed back into anything. `2500001 / 100` is not exactly
 * representable, but the error is ~10^-12 naira and `Intl` then rounds to two
 * decimals, so the rendered string is exact for every value below
 * MAX_SAFE_MINOR. What must not happen is dividing EARLY and doing arithmetic
 * on the quotient; that is the float drift the whole module avoids.
 */
export function formatNaira(amount: Minor): string {
  return NAIRA.format(amount / 100);
}

/**
 * `"175000.00"` → `"₦175,000.00"`, without the caller holding a `Minor`.
 *
 * The overwhelmingly common case — a price straight from the API rendered
 * straight into JSX, with no arithmetic in between. Having it here means a
 * product card does not need to import two functions and name an intermediate,
 * which is how `{listing.effectivePrice}` ends up rendered raw.
 */
export function formatMoney(decimal: string): string {
  return formatNaira(parseMoney(decimal));
}
