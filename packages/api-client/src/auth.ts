import type {
  AuthIdentity,
  AuthTokens,
  ChangePasswordBody,
  LoginBody,
  MessageResponse,
  RefreshedTokens,
  RegisterBody,
} from "@rimalis/types";
import { request, type RequestContext } from "./http";
import type { ApiError, Result } from "./result";

/**
 * Credentials and sessions.
 *
 * Everything here runs **server-side only**, inside a route handler or a Server
 * Action. That is not a style rule: the tokens these functions return are the
 * session, and the entire point of the BFF (ADR-0003) is that they are sealed
 * into an `httpOnly` cookie without ever passing through the browser. See the
 * header of `index.ts`.
 *
 * ## The refresh contract, which is stricter than it looks
 *
 * `refresh()` **consumes** the token it is given and returns a new pair. Replay
 * is not tolerated and not merely rejected: the API treats a second use as
 * evidence the token leaked and destroys every session for that user, answering
 * `REFRESH_REUSE`. Two consequences for any caller:
 *
 *  1. Persist the new pair before doing anything else with it. A refresh whose
 *     result is dropped on the floor has logged the user out.
 *  2. **Never refresh concurrently.** Two in-flight refreshes with the same
 *     token means one of them is a replay, and the punishment lands on the user.
 *
 * That is why this package has no refresh-on-401 interceptor. An interceptor
 * fires from wherever the 401 happened — including several parallel data fetches
 * in one render — and manufactures exactly the concurrency the contract forbids.
 * Refresh belongs at one chokepoint the app controls; in the marketplace that is
 * the middleware, and it is the only caller.
 */

export const register = (
  ctx: RequestContext,
  body: RegisterBody,
): Promise<Result<AuthTokens>> =>
  request({ ...ctx, method: "POST", path: "/auth/register", body });

export const login = (ctx: RequestContext, body: LoginBody): Promise<Result<AuthTokens>> =>
  request({ ...ctx, method: "POST", path: "/auth/login", body });

/** Rotates the pair. Single use — see the module header before calling this. */
export const refresh = (
  ctx: RequestContext,
  refreshToken: string,
): Promise<Result<RefreshedTokens>> =>
  request({ ...ctx, method: "POST", path: "/auth/refresh", body: { refreshToken } });

/**
 * Revokes one refresh token.
 *
 * Succeeds even for a token that is already invalid or gone — the caller wanted
 * to be signed out, and reporting a failure would only tempt a client into
 * keeping the session up. So a sign-out flow should clear its cookie
 * unconditionally and treat this as best-effort.
 */
export const logout = (
  ctx: RequestContext,
  refreshToken: string,
): Promise<Result<MessageResponse>> =>
  request({ ...ctx, method: "POST", path: "/auth/logout", body: { refreshToken } });

/** Revokes every session for the caller. Needs an access token, not a refresh one. */
export const logoutAll = (ctx: RequestContext): Promise<Result<MessageResponse>> =>
  request({ ...ctx, method: "POST", path: "/auth/logout-all" });

/** Token claims, with no database read. Up to 15 minutes stale — see the DTO. */
export const me = (ctx: RequestContext): Promise<Result<AuthIdentity>> =>
  request({ ...ctx, path: "/auth/me" });

/**
 * Consumes a token from a verification email. Valid for 24 hours.
 *
 * `ALREADY_VERIFIED` arrives as a 400 and is **not a failure worth alarming
 * anyone about** — it is what a shopper gets for clicking the link twice, or for
 * a mail client that prefetched it. Render it as success.
 */
export const verifyEmail = (
  ctx: RequestContext,
  token: string,
): Promise<Result<MessageResponse>> =>
  request({ ...ctx, method: "POST", path: "/auth/verify-email", body: { token } });

/**
 * Sends the verification mail again.
 *
 * Answers the same message whether or not the address exists, so it cannot be
 * used to enumerate accounts — which means the UI must not claim "we've sent it
 * to you" in a way that implies the address was found.
 *
 * Two throttles apply: a per-IP rate limit and a **60 second per-account
 * cooldown** persisted on `User.verificationSentAt`. Read that field and disable
 * the button rather than discovering the cooldown as a 429.
 */
export const resendVerification = (
  ctx: RequestContext,
  email: string,
): Promise<Result<MessageResponse>> =>
  request({ ...ctx, method: "POST", path: "/auth/resend-verification", body: { email } });

/**
 * Changes the password, then **destroys every session including the caller's**.
 *
 * The access token in hand keeps working until it expires, but no refresh will
 * ever succeed again — so the only correct client behaviour is to clear the
 * session cookie immediately and send the user back to sign in. Leaving them on
 * a page that looks signed in produces a mystery 401 up to fifteen minutes later.
 */
export const changePassword = (
  ctx: RequestContext,
  body: ChangePasswordBody,
): Promise<Result<MessageResponse>> =>
  request({ ...ctx, method: "POST", path: "/auth/change-password", body });

/**
 * Whether an error means "this session is over, sign in again".
 *
 * A 401 from any authenticated endpoint means the access token is expired,
 * malformed or revoked. `REFRESH_REUSE` additionally means every other session
 * was just revoked as well, which is worth saying out loud to the user rather
 * than silently bouncing them to a login form.
 *
 * A `network` or `timeout` failure is emphatically NOT this. Signing someone out
 * because the API was mid-deploy loses their cart and their trust for a problem
 * that fixed itself.
 */
export const isUnauthenticated = (error: ApiError): boolean =>
  error.kind === "http" && error.status === 401;

/** True when the API says every session was revoked — the theft-detection path. */
export const isSessionRevoked = (error: ApiError): boolean =>
  error.kind === "http" && error.code === "REFRESH_REUSE";
