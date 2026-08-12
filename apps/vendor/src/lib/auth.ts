import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  auth as authApi,
  payouts as payoutsApi,
  vendor as vendorApi,
  type RequestContext,
} from "@rimalis/api-client";
import type { VendorProfile } from "@rimalis/types";
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
 * Reading the session, and turning it into an authenticated vendor context.
 *
 * ## The one rule
 *
 * **A Server Component may READ the session. It may not refresh it.** Next
 * forbids writing a cookie during a render — there is no response to attach a
 * `Set-Cookie` to yet — so a page that discovers an aged-out token cannot fix it
 * in place. It sends the vendor through `/api/session/refresh` instead, which is
 * a real route handler with a real response, and which redirects straight back.
 * `requireSession()` does that for you.
 *
 * That indirection buys the thing the refresh contract actually needs: exactly
 * one place that calls `POST /auth/refresh`. The API treats a refresh token used
 * twice as stolen and destroys **every** session for that user, so a client that
 * refreshes from several places at once eventually signs someone out of every
 * device they own for no reason.
 *
 * ## Why there is no refresh-on-401 anywhere
 *
 * The tempting alternative is an interceptor that catches a 401, refreshes and
 * replays. It manufactures precisely the concurrency above: a dashboard that
 * fetches orders, listings and a payout summary in parallel gets three 401s and
 * fires three refreshes with the same token, and two of them are replays. The
 * session then dies *because* we tried to keep it alive. The dashboard is the
 * worst offender in this app, which is why this warning is repeated here.
 */

/** The session, or `null`. Never throws — see `decryptSession`. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return decryptSession(store.get(SESSION_COOKIE)?.value);
}

/**
 * The signed-in user's summary for chrome — a name in the header, a sign-out
 * button — or `null`.
 *
 * Reads the cookie only, so it costs no API call.
 *
 * ⚠️ **`user.vendorStatus` on this object is a stale hint and must never gate
 * anything.** It was sealed into the cookie at login and can be up to seven days
 * old; an admin suspending a vendor does not reach into a cookie. Use it to
 * decide whether to render a status chip, never to decide whether someone may
 * see the dashboard. The live answer is `requireApprovedVendor()`, which asks the
 * API on every request.
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
 * signed in.
 *
 * ⚠️ It does **not** check expiry. Anything that must succeed should go through
 * `requireSession()` or `requireApprovedVendor()`, which refresh first.
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
 *   no session       → `/login?next=<here>`
 *   token aged out   → `/api/session/refresh?next=<here>`, which comes back
 *   token still good → returns it
 *
 * `next` is a path, never a full URL, and `safeNext()` on the receiving side
 * rejects anything that is not a same-site path. An open redirect on a login
 * page is the classic phishing primitive: a link to our own domain that bounces
 * to an attacker's copy of it, arriving with our brand's trust already spent.
 *
 * @param here the current path, so the vendor lands back where they were
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
 * A fresh session **and** an `APPROVED` vendor profile, or a redirect to the
 * screen that explains why not. The guard every page under `(dashboard)` uses.
 *
 * ## Why the status is read live, on every request
 *
 * `session.user.vendorStatus` is right there in the cookie and using it would be
 * free. It is also up to seven days stale. `requireVendor` on the API does a
 * **live database check** for exactly this reason, so a suspended vendor's next
 * request 403s — and if this app gated on the cookie instead, it would keep
 * rendering a full dashboard whose every data call failed, which reads as the
 * app being broken rather than as an account being suspended.
 *
 * `GET /vendors/me` is deliberately mounted behind `authenticate` alone rather
 * than `requireVendor`, so it stays readable for a `PENDING`, `SUSPENDED` or
 * `REJECTED` vendor. That is what makes it possible to say *which* it is.
 *
 * ## Why a redirect rather than a rendered gate
 *
 * The gate screens live at their own URLs (`/pending`, `/suspended`,
 * `/rejected`, `/apply`) instead of being rendered in place. Two reasons: a
 * vendor can bookmark or be linked to an explanation, and the dashboard layout —
 * bottom nav, order counts, the lot — is not rendered around a screen where none
 * of it works. A nav bar whose every destination 403s is worse than no nav bar.
 *
 * ## The failure that is NOT a status problem
 *
 * A 401 here means the token died between the refresh check above and this call.
 * That goes back through `/login`. A 403 means the credentials are fine and the
 * *account* is not — sending that to `/login` produces an infinite loop, because
 * signing in again succeeds and lands straight back here. `vendor.isNotApproved`
 * exists to keep the two apart, and this is the one function that must get it
 * right.
 */
export async function requireApprovedVendor(
  here: string,
): Promise<{ session: Session; vendor: VendorProfile }> {
  const session = await requireSession(here);
  const result = await vendorApi.me(ctxFor(session));

  if (!result.ok) {
    const { error } = result;

    // No vendor record at all — a shopper account that signed in here, or an
    // application never submitted. An invitation, not a refusal.
    if (vendorApi.isNotAVendor(error)) redirect("/apply");

    // The token died in the gap. Back through login, which will come here again.
    if (error.kind === "http" && error.status === 401) {
      redirect(`/login?next=${encodeURIComponent(here)}`);
    }

    // Anything else — network, timeout, malformed, a 5xx — is OUR problem, not a
    // statement about this account. Throwing hands it to the nearest `error.tsx`,
    // which offers a retry. Redirecting to a status screen instead would tell a
    // perfectly good vendor their account was suspended because Railway was
    // mid-deploy, which is the single most alarming thing this app could get
    // wrong.
    throw new Error(`Could not load your vendor profile: ${error.message}`);
  }

  const vendor = result.data;

  switch (vendor.status) {
    case "APPROVED":
      return { session, vendor };
    case "PENDING":
      redirect("/pending");
    // falls through — `redirect` throws, but TypeScript cannot know that from
    // a function typed `never` in a `case` without the explicit break in flow.
    case "SUSPENDED":
      redirect("/suspended");
    case "REJECTED":
      redirect("/rejected");
    default:
      // An unrecognised status from a newer API. Fail closed: a vendor who
      // should not be trading must not reach the dashboard because we did not
      // recognise the word for why.
      redirect("/pending");
  }
}

/**
 * The vendor profile without the approval gate, for the status screens
 * themselves.
 *
 * They cannot use `requireApprovedVendor()` — it would redirect them to
 * themselves, forever. This returns whatever the profile says, including a
 * `null` when there is no vendor record, and lets the caller render it.
 */
export async function getVendorProfile(here: string): Promise<VendorProfile | null> {
  const session = await requireSession(here);
  const result = await vendorApi.me(ctxFor(session));
  return result.ok ? result.data : null;
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
 * down, the vendor still asked to be signed out, and leaving the cookie in place
 * because a best-effort revocation failed is the opposite of what they asked for.
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
 * comments are where the warnings actually live — `vendorPrice: null` clearing
 * an override, `grandTotal` including another vendor's money, the summary
 * counting only settled rows.
 */
export const vendor = vendorApi;
export const payouts = payoutsApi;
export const authClient = authApi;
