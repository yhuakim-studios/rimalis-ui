/**
 * The response envelope and the primitives every other module builds on.
 *
 * ## Two rules that govern this whole package
 *
 * **1. Money is a string.** Every monetary field on the wire serialises as a
 * decimal STRING, because the API keeps it as a Prisma `Decimal` end-to-end.
 * Typing one as `number` reintroduces exactly the float drift the API went to
 * some trouble to remove. The genuine numbers are `commissionRate`,
 * `effectiveStock`, `stockCap`, `weightGrams`, `stock`, `quantity` and the
 * pagination fields — nothing else.
 *
 * **2. Nullability is transcribed, not guessed.** Every `| null` here was read
 * off the API's own OpenAPI document and checked against a live response. A
 * field typed non-null that arrives null is a crash under `strict`; a field
 * typed nullable that never is costs a pointless guard. Both are worth avoiding,
 * and neither is guessable.
 */

/**
 * A monetary amount in Naira, as a decimal string.
 *
 * ⚠️ **Trailing zeros are stripped.** The column is `Decimal(12,2)`, but
 * `175000.00` arrives as `"175000"` and `12500.50` as `"12500.5"`. Two
 * consequences:
 *
 *   - Never compare two of these for equality. `"175000" !== "175000.00"` and
 *     both are the same amount.
 *   - Never render one raw. Always `formatMoney()`, which pads to two decimals.
 *
 * `parseFloat` followed by arithmetic is the bug this type exists to prevent.
 */
export type Money = string;

/** An ISO-8601 timestamp, e.g. `"2026-08-03T13:11:23.775Z"`. */
export type IsoDateTime = string;

/** A UUID. Aliased for readability only — it is not validated by the type. */
export type Uuid = string;

export interface ApiSuccess<TData, TMeta = undefined> {
  success: true;
  data: TData;
  meta?: TMeta;
}

export interface ApiFailure {
  success: false;
  error: string;
  /**
   * Machine-readable code, e.g. `INSUFFICIENT_STOCK`.
   *
   * ⚠️ **Optional, and often absent.** Roughly a third of the API's domain
   * errors are thrown without one — "Listing not found" and "Store not found"
   * among them. Branch on the HTTP status first and treat `code` as a
   * refinement. Code that requires `code` to be present will break on the
   * errors that matter most.
   */
  code?: string;
  /**
   * Field-level detail on a 400, shaped `{ body?|params?|query?: string[] }`.
   * Typed `unknown` because the shape varies and narrowing it at the one place
   * that renders it is honest; typing it precisely here would be a guess.
   */
  details?: unknown;
  /** Present on 500s. Quote it in a bug report and it finds the server log. */
  requestId?: string;
}

export type ApiResponse<TData, TMeta = undefined> =
  | ApiSuccess<TData, TMeta>
  | ApiFailure;

/** `meta` on every paginated list endpoint. */
export interface PaginationMeta {
  page: number;
  limit: number;
  /** Total matching rows across all pages, not the length of `data`. */
  total: number;
  totalPages: number;
}
