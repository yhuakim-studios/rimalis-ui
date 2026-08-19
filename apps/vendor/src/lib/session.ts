import type { AuthTokens, AuthUser } from "@rimalis/types";
import { EncryptJWT, jwtDecrypt, base64url } from "jose";
import { sessionSecret } from "./env";

/**
 * The session cookie: what is in it, how it is sealed, and how it is scoped.
 *
 * ## Why there is no `middleware.ts` doing this
 *
 * Refreshing in middleware is the usual BFF shape and it is the wrong one here,
 * for a reason specific to this stack. Middleware runs in the **edge runtime**,
 * and Next **inlines referenced environment variables into edge code at build
 * time**. On Cloudflare, `SESSION_SECRET` is a Worker secret that is injected at
 * *request* time and is absent from the build container by design — the same
 * fact that `env.schema.ts` was rewritten around. So `process.env.SESSION_SECRET`
 * in middleware would be baked in as `undefined`, the build would stay green,
 * and every session would fail to decrypt in production only.
 *
 * Refresh therefore lives in `/api/session/refresh`, an ordinary Node route
 * handler that reads the real environment. `auth.ts` redirects a page there when
 * a token has aged out. That also gives the refresh contract the one thing it
 * needs most — a single chokepoint — since a token replayed concurrently is
 * treated as theft and revokes every session the shopper has.
 *
 * This module is not marked `server-only` itself; it does not need to be, since
 * it imports `env.ts`, which is. A Client Component that reaches for it fails the
 * build one import further down, naming the offending file either way.
 *
 * ## Encrypted, not signed
 *
 * JWE `dir` + A256GCM. `httpOnly` stops JavaScript reading the cookie; it does
 * not stop a TLS-terminating proxy log, a browser profile on disk, or a
 * `Set-Cookie` echoed into an observability trace — and `wrangler.jsonc` has
 * observability enabled. The access and refresh tokens inside are bearer
 * credentials for the API, so they are unreadable rather than merely
 * untampered-with.
 *
 * ## `SameSite=Lax`, for the same reason as the marketplace
 *
 * This was `Strict` while the vendor app had no off-site entry point, and the
 * note here said to change it only when one appeared. One appeared: prepaid
 * wholesale means a vendor pays Paystack for stock and Paystack returns them to
 * `/products/purchases/:id`, which is a **cross-site top-level navigation**. A
 * Strict cookie is not sent on one, so the vendor lands on a login page
 * immediately after being charged, and the confirmation page they were sent to
 * cannot read the purchase it exists to confirm.
 *
 * `Lax` still withholds the cookie from every cross-site subresource request and
 * from cross-site POSTs, which is the CSRF surface that matters. What it gives
 * up is cross-site top-level GETs — and this app's writes are Server Actions
 * (POST) behind Next's action-id check, not GETs.
 *
 * Any future off-site entry point — an email "you have a new order" link counts,
 * since the click originates off-site — needs this to stay `Lax`.
 *
 * ## The cookie NAME is load-bearing in development
 *
 * `rimalis_vendor_session`, not `rimalis_session`. In production the three apps
 * live on three subdomains and a host-only cookie cannot cross them. **In
 * development all three are `localhost`, and cookies ignore the port** — so
 * `localhost:5173` and `localhost:5175` share one cookie jar.
 *
 * With a shared name, signing into the vendor app overwrites the shopper's
 * marketplace cookie and silently signs them out of the storefront, and vice
 * versa. The two apps also use different `SESSION_SECRET`s, so each would
 * receive a cookie it cannot decrypt and read it as "not signed in" — a session
 * that appears to drop at random depending on which app was opened last. Neither
 * symptom points at the cookie name.
 *
 * ## No `Domain` attribute, ever
 *
 * Omitted rather than set to this host. A cookie with no `Domain` is host-only —
 * `shop.example.com` and nothing else. Writing the host explicitly would work
 * identically until someone "fixes" it to `.example.com`, at which point vendor
 * and admin can read the shopper's session and the three-subdomain separation
 * that ADR-0003 exists to provide is silently gone. An attribute that is absent
 * cannot be mistyped.
 */

export const SESSION_COOKIE = "rimalis_vendor_session";

/**
 * Seven days, matching the refresh token's own lifetime.
 *
 * There is no point in a cookie that outlives the credential inside it: it
 * produces a vendor the app believes is signed in, whose every request 401s.
 */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Refresh this many milliseconds BEFORE the access token actually expires.
 *
 * Not padding for the sake of it. Without it, a token that expires between the
 * middleware's check and the API's receipt of the request produces a 401 on a
 * page the vendor had every right to see. Sixty seconds comfortably covers a
 * slow render plus clock skew between Cloudflare and Railway, and costs one
 * extra refresh per 15-minute token at worst.
 */
const REFRESH_SKEW_MS = 60_000;

/**
 * What the cookie holds.
 *
 * The user summary is denormalised in on purpose: rendering the store name in the
 * header must not cost a `GET /vendors/me` on every request, and the fields it
 * carries (name, email, role) change roughly never. Anything that DOES change
 * and matters — `isVerified` above all — is deliberately absent, so a page that
 * needs it has to ask the API and cannot accidentally read a stale copy sealed
 * into a cookie a week ago.
 */
export interface Session {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds at which `accessToken` stops being accepted. */
  accessExpiresAt: number;
}

/** A256GCM needs exactly 32 bytes; `env.schema.ts` has already proven it decodes to that. */
const key = (): Uint8Array => base64url.decode(sessionSecret());

/**
 * Reads the access token's own `exp` claim rather than assuming 15 minutes.
 *
 * The API's token lifetime is its configuration, not ours, and a hardcoded 15
 * minutes here would silently start refreshing too late — producing intermittent
 * 401s — the day it were shortened. The claim is read WITHOUT verification: this
 * is not a trust decision, only a scheduling one, and we could not verify it
 * anyway since the signing key lives on the API.
 *
 * Falls back to ten minutes from now if the token is unreadable. A short
 * fallback fails safe: the worst outcome is one unnecessary refresh, whereas a
 * long one is a session that stops working with no attempt to fix itself.
 */
export function accessTokenExpiry(accessToken: string): number {
  const parts = accessToken.split(".");
  const payload = parts[1];
  if (parts.length !== 3 || payload === undefined) return Date.now() + 10 * 60_000;

  try {
    const claims: unknown = JSON.parse(new TextDecoder().decode(base64url.decode(payload)));
    if (
      typeof claims === "object" &&
      claims !== null &&
      "exp" in claims &&
      typeof (claims as { exp: unknown }).exp === "number"
    ) {
      // `exp` is seconds since the epoch; everything else in this app is ms.
      return (claims as { exp: number }).exp * 1000;
    }
  } catch {
    // Malformed base64 or JSON — fall through to the safe default.
  }
  return Date.now() + 10 * 60_000;
}

/** Builds a session from a fresh token pair. */
export const sessionFromTokens = (tokens: AuthTokens): Session => ({
  user: tokens.user,
  accessToken: tokens.accessToken,
  refreshToken: tokens.refreshToken,
  accessExpiresAt: accessTokenExpiry(tokens.accessToken),
});

/** True when the access token is expired, or close enough that it will be. */
export const needsRefresh = (session: Session): boolean =>
  session.accessExpiresAt - REFRESH_SKEW_MS <= Date.now();

/** Seals a session into the cookie value. */
export async function encryptSession(session: Session): Promise<string> {
  return new EncryptJWT({ ...session } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    // The JWE's own expiry, checked by `jwtDecrypt` before we see the payload.
    // Belt and braces with the cookie's `Max-Age`: a cookie's expiry is a hint a
    // client may ignore, while this one is enforced by the server that reads it.
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .encrypt(key());
}

/**
 * Opens the cookie, or returns `null`.
 *
 * Never throws. A cookie that fails to decrypt is not an exceptional condition —
 * it is what every vendor holds the moment `SESSION_SECRET` is rotated, and
 * what a tampering attempt produces. Both mean the same thing to the app: this
 * request is not authenticated. Throwing would turn a routine rotation into a
 * site-wide 500 for every vendor holding an old cookie.
 */
export async function decryptSession(value: string | undefined): Promise<Session | null> {
  if (!value) return null;
  try {
    const { payload } = await jwtDecrypt(value, key());
    const session = payload as unknown as Partial<Session>;
    if (
      typeof session.accessToken !== "string" ||
      typeof session.refreshToken !== "string" ||
      typeof session.accessExpiresAt !== "number" ||
      typeof session.user !== "object" ||
      session.user === null
    ) {
      return null;
    }
    return session as Session;
  } catch {
    return null;
  }
}

/**
 * The cookie attributes, in one place so the three writers cannot disagree.
 *
 * `secure` follows `NODE_ENV` because a Secure cookie is dropped outright over
 * plain HTTP, which is what `localhost` is — leaving development with a login
 * that appears to succeed and a session that never exists.
 */
export const sessionCookieOptions = () =>
  ({
    httpOnly: true,
    // Lax, not Strict — see the module header. Paystack returns the vendor to
    // /products/purchases/:id as a cross-site top-level GET, and Strict would
    // withhold the session on exactly that hop.
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    // No `domain`. See the module header — this is the security boundary.
  }) satisfies Record<string, unknown>;

/** The same attributes with a zero lifetime, for signing out. */
export const clearedSessionCookieOptions = () => ({
  ...sessionCookieOptions(),
  maxAge: 0,
});
