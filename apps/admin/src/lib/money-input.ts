/**
 * Reading a money amount typed by a human, for an API that wants a JSON number.
 *
 * ## The asymmetry this exists for
 *
 * Money comes OUT of the API as a decimal string (`Money`) and goes IN as a JSON
 * number. Everywhere else in these apps money is read-only, so the product form is
 * the first and only place the inbound direction matters — and the obvious
 * `Number(formData.get("retailPrice"))` is wrong in four ways that all produce a
 * confusing 400 or, worse, a silently wrong price:
 *
 *   ""        → `Number("")` is 0, not NaN. An empty price field would set a
 *               product's price to zero rather than failing validation. This is the
 *               dangerous one.
 *   "1,500"   → NaN. Nigerian users type thousands separators; the field should
 *               accept what a person naturally writes.
 *   "₦1500"   → NaN. Same.
 *   "12.345"  → passes silently, and the column is Decimal(12,2). The API rounds or
 *               rejects, and either way the admin did not get the price they typed.
 *
 * So parsing is explicit, and the failure is a message rather than a number.
 *
 * Returns kobo-safe decimals as a `number` deliberately: the API's `moneyIn` takes
 * a JSON number and does its own Decimal conversion server-side. This is the one
 * sanctioned place a money value is a float in this codebase, it is a value about
 * to be serialised rather than arithmetic, and nothing here adds two of them.
 */

export type MoneyInput =
  | { ok: true; value: number }
  | { ok: false; message: string };

/** Naira, currency symbols and thousands separators stripped; two decimals max. */
export function readMoney(raw: unknown, label: string): MoneyInput {
  const text = String(raw ?? "").trim();

  if (text === "") return { ok: false, message: `${label} is required.` };

  // Strip the things a person types and a parser does not want: the currency
  // symbol, the ISO code, spaces and thousands separators.
  const cleaned = text
    .replace(/[₦\s]/g, "")
    .replace(/^ngn/i, "")
    .replace(/,/g, "");

  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    if (/^\d+\.\d{3,}$/.test(cleaned)) {
      return {
        ok: false,
        // Naming the constraint, not just rejecting: the column is Decimal(12,2)
        // and an admin who typed three decimals meant something.
        message: `${label} can have at most 2 decimal places.`,
      };
    }
    return { ok: false, message: `${label} must be an amount, like 12500 or 12500.50.` };
  }

  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    return { ok: false, message: `${label} must be an amount.` };
  }
  // Decimal(12,2) — ten digits before the point. Rejecting here beats a 400 whose
  // message is about database precision.
  if (value > 9_999_999_999) {
    return { ok: false, message: `${label} is too large.` };
  }

  return { ok: true, value };
}

/** A whole number of units, for stock fields. */
export function readInteger(
  raw: unknown,
  label: string,
  opts: { min?: number; allowNegative?: boolean } = {},
): { ok: true; value: number } | { ok: false; message: string } {
  const text = String(raw ?? "").trim().replace(/,/g, "");
  if (text === "") return { ok: false, message: `${label} is required.` };

  const pattern = opts.allowNegative ? /^-?\d+$/ : /^\d+$/;
  if (!pattern.test(text)) {
    return {
      ok: false,
      message: opts.allowNegative
        ? `${label} must be a whole number, positive or negative.`
        : `${label} must be a whole number.`,
    };
  }

  const value = Number(text);
  if (!Number.isSafeInteger(value)) {
    return { ok: false, message: `${label} is too large.` };
  }
  if (opts.min !== undefined && value < opts.min) {
    return { ok: false, message: `${label} cannot be below ${String(opts.min)}.` };
  }
  return { ok: true, value };
}
