import type { ApiResponse } from "@rimalis/types";
import { buildUrl, type ApiClientConfig } from "./config";
import { err, isRetryable, ok, type ApiError, type Result } from "./result";

/**
 * The one function in this package that touches `fetch`.
 *
 * Everything else — `marketplace.ts`, and later `auth.ts`, `orders.ts`,
 * `payments.ts` — describes a request and delegates here. That is what makes the
 * transport rules below enforceable rather than aspirational: there is exactly
 * one place to get the timeout, the retry policy, the envelope branch and the
 * token handling right.
 */

/** 8 seconds. Long enough for Railway cold-starting Postgres, short enough that
 * a hung upstream does not hold a Worker subrequest open until the platform
 * kills the whole invocation. */
const TIMEOUT_MS = 8_000;

/** One retry, after a short pause. See `shouldRetry` for why only one. */
const RETRY_DELAY_MS = 250;

export interface RequestContext {
  config: ApiClientConfig;
  /**
   * The caller's access token, or `undefined` for a public request.
   *
   * ⚠️ **This is a per-request field on purpose, and it must stay one.** The
   * tempting alternative is a module-level `let token` with a
   * `setAccessToken()` — and it would work perfectly in development, where one
   * person makes one request at a time.
   *
   * A Cloudflare Worker isolate serves **concurrent requests from different
   * users**. A module-level token is shared mutable state across all of them:
   * user A's token is set, user B's request reads it, and B sees A's orders.
   * That is a cross-user session leak wearing the ergonomics of a convenience,
   * and it would be very hard to reproduce locally and very easy to ship.
   *
   * The same reasoning rules out caching a resolved token anywhere in this
   * package. Thread it through; the verbosity is the safety.
   */
  accessToken?: string;
  /** For request correlation across the BFF hop. Echoed by the API as `x-request-id`. */
  requestId?: string;
  /** The caller's own cancellation, composed with our timeout rather than replacing it. */
  signal?: AbortSignal;
}

export interface RequestOptions extends RequestContext {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Path after the base path, e.g. `/marketplace/products`. Leading slash optional. */
  path: string;
  /**
   * Query parameters. `undefined` and `null` values are omitted entirely rather
   * than sent as empty strings — the API rejects `?isActive=` with a 400, and
   * several of its numeric filters reject `0`.
   */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** JSON body. Omitted for GET. */
  body?: unknown;
  /**
   * Required on `POST /orders`. A dedicated field rather than a caller-supplied
   * header so the one endpoint that needs it cannot be called without it — see
   * `orders.ts` in Phase 5.
   */
  idempotencyKey?: string;
}

const buildQuery = (query: RequestOptions["query"]): string => {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const serialised = params.toString();
  return serialised ? `?${serialised}` : "";
};

/**
 * `Retry-After` is seconds or an HTTP date. Only the numeric form is worth
 * parsing: the API's `express-rate-limit` always sends seconds, and a date form
 * from some intermediate proxy is better treated as absent than mis-parsed into
 * a countdown that is wrong by hours.
 */
const parseRetryAfter = (header: string | null): number | undefined => {
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
};

const transportError = (cause: unknown, timedOut: boolean): ApiError =>
  timedOut
    ? {
        kind: "timeout",
        status: 0,
        message: `The request did not complete within ${TIMEOUT_MS}ms.`,
      }
    : {
        kind: "network",
        status: 0,
        message: cause instanceof Error ? cause.message : "The request could not be sent.",
      };

/**
 * Retry GET only, once, on a transport failure or a 5xx.
 *
 * **Never a non-GET.** A retried `POST /orders` is precisely the double-charge
 * that the `Idempotency-Key` header exists to prevent, and leaning on that key
 * to absorb a retry we chose to make is using defence-in-depth as an excuse. The
 * same applies to `POST /payments/initialize`, which has no idempotency guard at
 * all.
 *
 * One retry rather than a backoff ladder: this runs inside a Worker serving a
 * page render, where the shopper is already waiting. Two retries at 8s each
 * turns a slow response into a 24-second blank page, which is worse for them
 * than an error state with a Try again button.
 */
const shouldRetry = (method: string, error: ApiError, attempt: number): boolean =>
  method === "GET" && attempt === 0 && isRetryable(error);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function attempt<TData, TMeta>(
  options: RequestOptions,
): Promise<Result<TData, TMeta>> {
  const method = options.method ?? "GET";
  const url = buildUrl(options.config, options.path) + buildQuery(options.query);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.accessToken) headers["Authorization"] = `Bearer ${options.accessToken}`;
  if (options.requestId) headers["x-request-id"] = options.requestId;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  // `AbortSignal.any` composes our deadline with the caller's cancellation
  // instead of choosing between them — a page that unmounts mid-render should
  // abort, and so should an upstream that never answers. Both are native in
  // workerd and in Node 20+.
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
      // NOTE: no `cache` option, deliberately, and it is not an oversight.
      //
      // Three reasons it does not belong here. It is not in the standard
      // `RequestInit` that `@types/node` declares, so it does not even compile
      // in this package. workerd's support for it is partial. And most
      // importantly: inside Next, `fetch` is monkey-patched, so a `cache` value
      // set in this shared package would silently drive Next's Data Cache from a
      // layer the app cannot see — the app would be configuring caching in
      // `revalidate` and route config while this line quietly overrode it.
      //
      // Caching is the APP's decision, made per route. Next 15+ does not cache
      // fetches by default, so the current behaviour is already uncached, which
      // is what Phase 1–7 want. Phase 8 adds R2 + `revalidate` as one
      // deliberate change, at the route level.
    });
  } catch (cause) {
    return err(transportError(cause, timeout.aborted));
  }

  // Parse before branching. The API's envelope is uniform, so `success` is the
  // discriminant and the status is a refinement — but a body that is not the
  // envelope at all has to be caught first, and that is the common production
  // failure: Railway and Cloudflare both answer with HTML error pages, and
  // `res.json()` on those throws a SyntaxError that would otherwise surface to
  // a shopper as an unstyled crash.
  let payload: ApiResponse<TData, TMeta>;
  try {
    payload = (await response.json()) as ApiResponse<TData, TMeta>;
  } catch {
    return err({
      kind: "malformed",
      status: response.status,
      message: `The API returned a ${response.status} that was not JSON.`,
      retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
    });
  }

  if (payload === null || typeof payload !== "object" || !("success" in payload)) {
    return err({
      kind: "malformed",
      status: response.status,
      message: "The API returned JSON that was not the expected envelope.",
    });
  }

  if (payload.success) {
    // `meta` is absent on non-paginated endpoints. Cast rather than guard: the
    // caller's `TMeta` says which it expects, and a list method that asked for
    // PaginationMeta and got none has a server bug, not a client one.
    return ok(payload.data, payload.meta as TMeta);
  }

  return err({
    kind: "http",
    status: response.status,
    message: payload.error,
    ...(payload.code !== undefined ? { code: payload.code } : {}),
    ...(payload.details !== undefined ? { details: payload.details } : {}),
    ...(payload.requestId !== undefined ? { requestId: payload.requestId } : {}),
    ...(response.status === 429
      ? { retryAfterMs: parseRetryAfter(response.headers.get("retry-after")) }
      : {}),
  });
}

/**
 * Issues one API request and returns a `Result` — it does not throw.
 *
 * The exception is a programming error inside this function itself, which
 * should crash rather than be laundered into a `Result` the caller renders as a
 * network problem.
 */
export async function request<TData, TMeta = undefined>(
  options: RequestOptions,
): Promise<Result<TData, TMeta>> {
  const method = options.method ?? "GET";

  for (let i = 0; ; i++) {
    const result = await attempt<TData, TMeta>(options);
    if (result.ok) return result;
    if (!shouldRetry(method, result.error, i)) return result;
    await sleep(RETRY_DELAY_MS);
  }
}
