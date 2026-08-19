import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  auth as authApi,
  orders as ordersApi,
  payments as paymentsApi,
  users as usersApi,
  type RequestContext,
} from "@rimalis/api-client";
import { apiConfig } from "./env";
import {
  SESSION_COOKIE,
  clearedSessionCookieOptions,
  decryptSession,
  encryptSession,
  needsRefresh,
  sessionCookieOptions,
  type Session,
} from "./session";

/**
 * Reading the session, and turning it into an authenticated request context.
 *
 * ## The one rule
 *
 * **A Server Component may READ the session. It may not refresh it.** Next
 * forbids writing a cookie during a render — there is no response to attach a
 * `Set-Cookie` to yet — so a page that discovers an aged-out token cannot fix it
 * in place. It sends the shopper through `/api/session/refresh` instead, which
 * is a real route handler with a real response, and which redirects straight
 * back. `requireSession()` does that for you.
 *
 * That indirection buys the thing the refresh contract actually needs: exactly
 * one place that calls `POST /auth/refresh`. The API treats a refresh token used
 * twice as stolen and destroys **every** session for that user, so a client that
 * refreshes from several places at once eventually signs someone out of every
 * device they own for no reason. See the header of `auth.ts` in the API client.
 *
 * ## Why there is no refresh-on-401 anywhere
 *
 * The tempting alternative is an interceptor in the API client that catches a
 * 401, refreshes and replays. It manufactures precisely the concurrency above:
 * a page that fetches its profile and its orders in parallel gets two 401s and
 * fires two refreshes with the same token, and the second is a replay. The
 * session then dies *because* we tried to keep it alive.
 */

/** The session, or `null`. Never throws — see `decryptSession`. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return decryptSession(store.get(SESSION_COOKIE)?.value);
}

/**
 * The signed-in shopper's summary for chrome — the header greeting, an
 * account link — or `null`.
 *
 * Reads the cookie only. It costs no API call, which is why the header can use
 * it on every page, and it is why the fields it exposes are limited to ones that
 * effectively never change. Anything live (`isVerified`, `phone`) comes from
 * `getProfile()`.
 */
export async function getSessionUser() {
  return (await getSession())?.user ?? null;
}

/**
 * An authenticated request context, or `null` when there is no usable session.
 *
 * Returns `null` rather than throwing, and rather than silently producing a
 * context with an empty token: a request with `Authorization: Bearer undefined`
 * comes back as a confusing 401 from deep inside a page that thought it was
 * signed in. The `null` forces the caller to decide what a signed-out visitor
 * should see, which is a decision every caller genuinely has.
 *
 * ⚠️ It does **not** check expiry. A page that needs the call to succeed should
 * go through `requireSession()`, which refreshes first. This exists for the
 * optional case — a page that renders either way and simply shows more when it
 * can.
 */
export async function authedCtx(init?: { requestId?: string }): Promise<RequestContext | null> {
  const session = await getSession();
  if (!session) return null;
  return {
    config: apiConfig,
    accessToken: session.accessToken,
    ...(init?.requestId !== undefined ? { requestId: init.requestId } : {}),
  };
}

/** The same context from a session already in hand — for a route handler that just refreshed. */
export const ctxFor = (session: Session): RequestContext => ({
  config: apiConfig,
  accessToken: session.accessToken,
});

/**
 * A guaranteed-fresh session, or a redirect. For any page behind a sign-in.
 *
 * Three outcomes, in order:
 *
 *   no session          → `/login?next=<here>`
 *   token aged out      → `/api/session/refresh?next=<here>`, which comes back
 *   token still good    → returns it
 *
 * `next` is a path, never a full URL, and `safeNext()` on the receiving side
 * rejects anything that is not a same-site path. An open redirect on a login
 * page is the classic phishing primitive: a link to our own domain that bounces
 * to an attacker's copy of it, arriving with our brand's trust already spent.
 *
 * @param here the current path, so the shopper lands back where they were
 */
export async function requireSession(here: string): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(here)}`);
  if (needsRefresh(session)) {
    redirect(`/api/session/refresh?next=${encodeURIComponent(here)}`);
  }
  return session;
}

/**
 * Writes a session cookie. Only callable where a response exists — a Server
 * Action or a route handler.
 */
export async function setSessionCookie(session: Session): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await encryptSession(session), sessionCookieOptions());
}

/**
 * Clears the session cookie.
 *
 * Unconditional, and never gated on the API call that revokes the token
 * server-side succeeding. If `POST /auth/logout` fails because the network is
 * down, the shopper still asked to be signed out, and leaving the cookie in
 * place because a best-effort revocation failed is the opposite of what they
 * asked for.
 */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", clearedSessionCookieOptions());
}

/**
 * Where a `next` parameter is allowed to point.
 *
 * A single leading slash, and not two. `//evil.example` is a protocol-relative
 * URL: browsers treat it as `https://evil.example`, it passes a naive
 * `startsWith("/")` check, and it is the exact shape of the open-redirect bug
 * this function exists to prevent. Backslashes are rejected too, because some
 * clients normalise `/\evil.example` the same way.
 */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

/**
 * The API surfaces, re-exported so a page needs one import.
 *
 * Re-exported rather than wrapped per endpoint: a wrapper apiece would be
 * pass-through that drifts from the client's signatures, and the client's doc
 * comments are where the warnings actually live — the idempotency key on
 * `orders.create`, the 204 on `users.deleteAddress`, the fact that the payment
 * webhook rather than the callback is what settles a charge.
 */
export const account = usersApi;
export const authClient = authApi;
export const orders = ordersApi;
export const payments = paymentsApi;
