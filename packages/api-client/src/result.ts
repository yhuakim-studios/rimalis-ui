/**
 * The result of an API call, as a discriminated union rather than a throw.
 *
 * ## Why not exceptions
 *
 * Almost every failure this client can produce is **control flow the page has
 * to render around**, not an exceptional condition:
 *
 *   404 on a listing            → `notFound()`, for the right status and SEO
 *   403 EMAIL_NOT_VERIFIED      → render the verification gate, with a resend
 *   409 INSUFFICIENT_STOCK      → a per-line message on the offending item
 *   409 VENDOR_PAYOUT_NOT_...   → a distinct message; not the shopper's fault
 *   network / timeout           → "trouble reaching our servers", with a retry
 *
 * Every one of those is a different piece of UI. With `throw`, each call site
 * becomes `try { … } catch (e) { if (e instanceof ApiError && e.code === … ) }`,
 * and under `strict` the `unknown` in the catch clause has to be narrowed before
 * anything can be read off it. Worse, a `catch` silently swallows unrelated
 * bugs — a `TypeError` from a typo in the mapping code lands in the same block
 * as a 404 and gets rendered as "product not found".
 *
 * A union puts the exhaustiveness check where the compiler can enforce it: you
 * cannot read `.data` without having established `ok`.
 *
 * ## Why `meta` is a type parameter
 *
 * Every list endpoint returns `PaginationMeta` alongside `data`, and pagination
 * is not optional decoration — a catalogue page cannot render its pager without
 * it. Threading it through the Result means a list call's `meta` is typed and
 * present, while a detail call's is `undefined`, without a second result type.
 */

/**
 * What went wrong, coarsely — chosen so a caller can pick copy from the `kind`
 * alone and only look at `status`/`code` when it wants to say something more
 * specific.
 *
 * `"malformed"` is not padding. Railway and Cloudflare both return **HTML**
 * error pages under load or during a deploy, and `res.json()` on an HTML body
 * throws a `SyntaxError`. Without this case that reaches the shopper as an
 * unstyled crash, and it is the failure mode most likely to happen in
 * production and never in development.
 */
export type ApiErrorKind =
  /** The API answered with `success: false`. `status` and usually `code` are meaningful. */
  | "http"
  /** The request never completed — DNS, TLS, connection reset, Worker subrequest failure. */
  | "network"
  /** Our own 8s deadline elapsed, or the caller's signal aborted. */
  | "timeout"
  /** A response arrived but was not the envelope — HTML error page, truncated body, wrong shape. */
  | "malformed";

export interface ApiError {
  kind: ApiErrorKind;
  /** HTTP status, or `0` when there was no response (`network`/`timeout`). */
  status: number;
  /** Human-readable. Safe to show a shopper only when `kind === "http"`; otherwise generic copy. */
  message: string;
  /** Machine-readable code from the envelope, e.g. `INSUFFICIENT_STOCK`. Absent on non-`http` kinds. */
  code?: string;
  /** Field-level validation detail from the API's 400s. Shape varies by endpoint; narrow before use. */
  details?: unknown;
  /** Present on the API's 500s. Surface it in the error UI — it finds the server log. */
  requestId?: string;
  /** Parsed from `Retry-After` on a 429, so rate-limit copy can name a real number of seconds. */
  retryAfterMs?: number;
}

export type Ok<TData, TMeta = undefined> = {
  ok: true;
  data: TData;
  meta: TMeta;
};

export type Err = {
  ok: false;
  error: ApiError;
};

export type Result<TData, TMeta = undefined> = Ok<TData, TMeta> | Err;

export const ok = <TData, TMeta = undefined>(data: TData, meta: TMeta): Ok<TData, TMeta> => ({
  ok: true,
  data,
  meta,
});

export const err = (error: ApiError): Err => ({ ok: false, error });

/**
 * True when retrying might plausibly succeed — a transport failure or a 5xx,
 * never a 4xx (which will fail identically forever).
 *
 * Read by the ONE retry site in `http.ts`, which additionally retries only GET.
 * A retried `POST /orders` is precisely the double-charge that the
 * `Idempotency-Key` header exists to prevent, and relying on the key to catch a
 * retry we chose to make is defence-in-depth used as an excuse.
 */
export const isRetryable = (error: ApiError): boolean =>
  error.kind === "network" || error.kind === "timeout" || error.status >= 500;

/**
 * Copy safe to put in front of a shopper, for callers with nothing specific to
 * say about this particular failure.
 *
 * The `network`/`timeout` wording is deliberately about *us*, not about the
 * thing they asked for. A shopper told "product not found" because Railway is
 * mid-deploy concludes the product is gone and leaves; told "we're having
 * trouble reaching our servers" they reload. Never let a transport failure
 * borrow a 404's copy — that rule is why `kind` exists at all.
 */
export const shopperMessage = (error: ApiError): string => {
  switch (error.kind) {
    case "network":
    case "timeout":
      return "We're having trouble reaching our servers. Please check your connection and try again.";
    case "malformed":
      return "Something went wrong on our end. Please try again in a moment.";
    case "http":
      return error.status >= 500
        ? "Something went wrong on our end. Please try again in a moment."
        : error.message;
  }
};
