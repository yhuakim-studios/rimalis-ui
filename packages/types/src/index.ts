/**
 * Shared DTOs mirroring the digistore-api contract.
 *
 * EMPTY ON PURPOSE — this is Part B (scaffold), and populating it is Part C.
 * The package exists now so the dependency graph, the build order and the
 * emitted-types plumbing are all proven before any real type depends on them.
 *
 * When it is filled in, two rules from the API side carry over and are easy to
 * get wrong from the frontend:
 *
 * 1. **Money is a string, not a number.** Every monetary field on the wire
 *    (`basePrice`, `vendorPrice`, `effectivePrice`, `grandTotal`, `unitPrice`,
 *    `vendorPayout`, …) serialises as a JSON string, because the API keeps it
 *    as a Prisma `Decimal` end-to-end to avoid float drift. Typing any of them
 *    as `number` reintroduces exactly the bug the API went to some trouble to
 *    remove. See digistore-api ADJUSTMENTS #5.
 * 2. **The response envelope is uniform.** Success is
 *    `{ success: true, data, meta? }`; failure is
 *    `{ success: false, error, code?, requestId? }`. The two types below are
 *    the only part of the contract stable enough to commit to today.
 */

/** Monetary amounts cross the wire as decimal strings. Never `number`. */
export type Money = string;

export interface ApiSuccess<TData, TMeta = undefined> {
  success: true;
  data: TData;
  meta?: TMeta;
}

export interface ApiFailure {
  success: false;
  error: string;
  /** Machine-readable code, e.g. `LISTING_HAS_OPEN_ORDERS`. Not on every error. */
  code?: string;
  /** Present on 500s — quote it in a bug report and it finds the server log. */
  requestId?: string;
}

export type ApiResponse<TData, TMeta = undefined> =
  | ApiSuccess<TData, TMeta>
  | ApiFailure;

/** Pagination shape returned in `meta` by every list endpoint. */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
