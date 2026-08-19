import { NextResponse, type NextRequest } from "next/server";
import { authClient, getSession, safeNext } from "@/lib/auth";
import { apiConfig } from "@/lib/env";
import {
  SESSION_COOKIE,
  clearedSessionCookieOptions,
  encryptSession,
  needsRefresh,
  sessionCookieOptions,
  sessionFromTokens,
  type Session,
} from "@/lib/session";

/**
 * The ONE place that calls `POST /auth/refresh`.
 *
 * ## Why a route handler and not middleware, and not a page
 *
 * A page cannot write a cookie — there is no response to attach `Set-Cookie` to
 * during a render. Middleware could, but it runs in the edge runtime, where Next
 * **inlines environment variables at build time**; `SESSION_SECRET` is a
 * Cloudflare Worker secret that does not exist in the build container, so the
 * middleware version of this would ship with `undefined` baked in and fail only
 * in production. See the header of `lib/session.ts`.
 *
 * So: `requireSession()` redirects here, this refreshes, and this redirects
 * back. One extra hop per fifteen minutes for a signed-in admin.
 *
 * ## Concurrency is the real hazard, and it is mitigated rather than solved
 *
 * A refresh token is single use. The API treats a second presentation as theft
 * and destroys **every** session for that user, answering `REFRESH_REUSE`. Two
 * requests arriving here at once with the same cookie is therefore not a
 * harmless duplicate — it signs the admin out everywhere.
 *
 * It cannot be locked away entirely: cookies set on one response are invisible
 * to a request already in flight, so there is no shared state to serialise on
 * inside a stateless Worker. What is done instead:
 *
 *  - **Only one route reaches here.** No interceptor, no per-fetch retry, no
 *    parallel refresh from three data loads in one render.
 *  - **Re-read the cookie after entering.** If another request refreshed while
 *    this one was being routed, the cookie already holds a fresh token and this
 *    returns without calling the API at all. That closes the common window,
 *    which is a redirect plus a route dispatch wide.
 *  - **`prefetch={false}` on links into gated areas.** A viewport prefetch of an
 *    `/orders` link is a second concurrent render, and it is the most likely
 *    source of a genuine double refresh in normal browsing.
 *  - **A reuse response is handled as a real event**, not swallowed: the cookie
 *    is cleared and the admin is sent to sign in with an explanation, because
 *    from their side every device just logged out and silence would be alarming.
 */

/** Node, not edge — this needs the real `SESSION_SECRET` at request time. */
export const runtime = "nodejs";

/** Never cached. A cached refresh would hand one admin’s tokens to another. */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const session = await getSession();

  if (!session) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(next)}`, request.url),
    );
  }

  // Someone else got here first — see "Re-read the cookie" above. Sending them
  // on with the token that is already good is strictly better than burning a
  // second refresh to prove it.
  if (!needsRefresh(session)) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  const result = await authClient.refresh({ config: apiConfig }, session.refreshToken);

  if (!result.ok) {
    // A transport failure is NOT a dead session. The refresh token is still
    // valid and will still be there in a moment, so the cookie is **left
    // alone** — signing someone out because Railway was mid-deploy loses their
    // half-typed price edit for a problem that fixed itself.
    //
    // But it must not redirect back to `next` either: that page calls
    // `requireSession()`, which sees the same aged-out token and sends them
    // straight back here, and the two bounce until the browser gives up. So it
    // lands on `/login`, which is public and therefore terminal, with copy that
    // says the servers are unreachable rather than that the session expired.
    if (result.error.kind !== "http") {
      return NextResponse.redirect(
        new URL(`/login?next=${encodeURIComponent(next)}&reason=unreachable`, request.url),
      );
    }

    const revoked = authClient.isSessionRevoked(result.error);
    const response = NextResponse.redirect(
      new URL(
        `/login?next=${encodeURIComponent(next)}&reason=${revoked ? "revoked" : "expired"}`,
        request.url,
      ),
    );
    response.cookies.set(SESSION_COOKIE, "", clearedSessionCookieOptions());
    return response;
  }

  // Replace the pair WHOLESALE. Keeping the old refresh token — the obvious
  // half-measure when only the access token looks stale — guarantees a
  // `REFRESH_REUSE` on the next rotation, since that token has already been
  // consumed by this very call.
  const refreshed: Session = {
    ...sessionFromTokens({ ...result.data, user: session.user }),
  };

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(
    SESSION_COOKIE,
    await encryptSession(refreshed),
    sessionCookieOptions(),
  );
  return response;
}
