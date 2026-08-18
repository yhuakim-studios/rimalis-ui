import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  admin as adminApi,
  auth as authApi,
  categories as categoriesApi,
  type RequestContext,
} from "@rimalis/api-client";
import type { AuthIdentity } from "@rimalis/types";
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
 * Reading the session, and turning it into an authenticated ADMIN context.
 *
 * ## The one rule
 *
 * **A Server Component may READ the session. It may not refresh it.** Next
 * forbids writing a cookie during a render — there is no response to attach a
 * `Set-Cookie` to yet — so a page that finds an aged-out token cannot fix it in
 * place. It sends the admin through `/api/session/refresh` instead, which is a
 * real route handler with a real response and redirects straight back.
 * `requireSession()` does that.
 *
 * That indirection buys the thing the refresh contract needs: exactly ONE place
 * that calls `POST /auth/refresh`. The API treats a refresh token used twice as
 * stolen and destroys **every** session for that user.
 *
 * ## Why there is no refresh-on-401, and why it matters most in this app
 *
 * The tempting alternative is an interceptor that catches a 401, refreshes and
 * replays. It manufactures exactly that concurrency — and this app's landing page
 * is the worst possible place for it. The dashboard fans out to several list
 * calls at once; three 401s become three refreshes with the same token, two of
 * them are replays, and the session dies *because* we tried to keep it alive.
 *
 * The rule that follows: every page issues ONE `requireAdmin()` and then does its
 * fetching under a single `Promise.all` with the context that returns. Never a
 * guard per fetch.
 */

/** The session, or `null`. Never throws — see `decryptSession`. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return decryptSession(store.get(SESSION_COOKIE)?.value);
}

/**
 * The signed-in user's summary for chrome — an email in the header, a sign-out
 * button — or `null`. Reads the cookie only, so it costs no API call.
 *
 * ⚠️ **`user.role` on this object is a stale hint and must never be the gate.** It
 * was sealed into the cookie at login and can be up to seven days old; an admin
 * demoting another admin does not reach into a cookie. Use it to decide whether
 * to render a nav item, never to decide whether someone may administer the
 * platform. The live answer is `requireAdmin()`.
 */
export async function getSessionUser() {
  return (await getSession())?.user ?? null;
}

/**
 * An authenticated request context, or `null` when there is no usable session.
 *
 * Returns `null` rather than a context with an empty token: a request with
 * `Authorization: Bearer undefined` comes back as a confusing 401 from deep inside
 * a page that believed it was signed in.
 *
 * ⚠️ Does **not** check expiry or role. Anything that must succeed goes through
 * `requireAdmin()`.
 */
export async function authedCtx(init?: {
  requestId?: string;
}): Promise<RequestContext | null> {
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
 * rejects anything that is not a same-site path. An open redirect on a login page
 * is the classic phishing primitive: a link to our own domain that bounces to an
 * attacker's copy of it, arriving with our brand's trust already spent. On the
 * admin console the credential at the far end of that bounce is the one that can
 * suspend vendors and reprice the catalogue.
 *
 * @param here the current path, so the admin lands back where they were
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
 * A fresh session belonging to an ADMIN, or a redirect. The guard every page
 * under `(dashboard)` calls — **including the ones whose layout already called
 * it.**
 *
 * ## Why every page repeats it
 *
 * A layout is not a security boundary. Next renders layouts and pages in
 * parallel, so a `redirect()` thrown in `(dashboard)/layout.tsx` does not cancel
 * a child page's data fetching that has already begun. The layout's guard stops
 * the *chrome* rendering; only the page's own guard stops the page's own queries.
 * The cost of getting this right is one JWT-only API call per page.
 *
 * ## Two checks, and why both
 *
 * 1. **The cookie's `role`** — free, and a stale hint. Used to fail fast, not to
 *    authorise. A user who was never an admin is caught here without an API call.
 *
 * 2. **`GET /auth/me`** — the live answer. The API reads it straight off the
 *    verified JWT with no database lookup, so it is cheap, and it is the same
 *    claim `requireRole("ADMIN")` will check on every subsequent call. If the
 *    cookie and the token disagree — a hand-edited cookie, a session sealed
 *    before a role change — this is what notices.
 *
 * ## The failure that is NOT an authorisation problem
 *
 * A 401 means the token died between the freshness check above and this call:
 * back through `/login`. A 403 or a non-ADMIN role means the credentials are fine
 * and the *account* is not: `/not-authorised`, never `/login`, because signing in
 * again succeeds and lands straight back here forever.
 *
 * Anything else — network, timeout, malformed, a 5xx — is OUR problem and is
 * **thrown**, not redirected. `(dashboard)/error.tsx` catches it and offers a
 * retry. Telling a real admin they are not authorised because Railway was
 * mid-deploy is the single most alarming thing this app could get wrong, and it
 * is the exact mistake the vendor app's guard documents avoiding.
 *
 * ## The residual gap, stated plainly
 *
 * `/auth/me` is derived from the JWT, so a demoted admin keeps the admin UI until
 * their access token expires — up to 15 minutes. That is a UI-only window: every
 * write still 403s server-side against the same claim, and a suspended user
 * cannot refresh, so the session dies inside it. Closing the window properly
 * needs a DB-backed `GET /admin/me` on the API; it is not worth a database read
 * on every page render until there is a reason.
 */
export async function requireAdmin(
  here: string,
): Promise<{ session: Session; identity: AuthIdentity }> {
  const session = await requireSession(here);

  // Cheap fail-fast on the cookie's claim. NOT the boundary — see above.
  if (session.user.role !== "ADMIN") redirect("/not-authorised");

  const result = await authApi.me(ctxFor(session));

  if (!result.ok) {
    const { error } = result;

    // The token died in the gap. Back through login, which will return here.
    if (error.kind === "http" && error.status === 401) {
      redirect(`/login?next=${encodeURIComponent(here)}`);
    }

    // A 403 on /auth/me would be surprising — it is `authenticate`-only — but if
    // it happens it is a statement about the account, not about us.
    if (error.kind === "http" && error.status === 403) {
      redirect("/not-authorised");
    }

    // Ours. Hand it to error.tsx rather than accusing a real admin.
    throw new Error(`Could not confirm your admin session: ${error.message}`);
  }

  if (result.data.role !== "ADMIN") redirect("/not-authorised");

  return { session, identity: result.data };
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
 * down, the admin still asked to be signed out, and leaving the cookie in place
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
 * `startsWith("/")` check, and it is the exact shape of the open-redirect bug this
 * function exists to prevent. Backslashes are rejected too, because some clients
 * normalise `/\evil.example` the same way.
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
 * comments are where the warnings actually live — `commissionRateOverride: null`
 * meaning "the ladder decides" rather than "the default", `reject` accepting no
 * body, a pool product's `images` possibly being empty.
 */
export const admin = adminApi;
export const authClient = authApi;
/** Reads are public; `create`/`update`/`remove` on it are ADMIN-gated. */
export const categories = categoriesApi;
