"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { shopperMessage } from "@rimalis/api-client";
import {
  authClient,
  clearSessionCookie,
  ctxFor,
  getSession,
  safeNext,
  setSessionCookie,
} from "./auth";
import { apiConfig } from "./env";
import { sessionFromTokens } from "./session";
import { fieldErrorsOf, type FormState } from "./form-state";

/**
 * Sign in and sign out — the Server Actions behind the auth forms.
 *
 * ## Why these are Server Actions and not `fetch` from a client component
 *
 * They set the session cookie. Under the BFF (ADR-0003) the browser must never
 * hold the API's tokens, and here that token is an ADMIN one. What the browser
 * gets back is a `Set-Cookie` it cannot read. A client-side call would also
 * *appear to work in development* — the API's local `corsOrigins` allows
 * `localhost:5174` — and fail in production, where that list is empty.
 *
 * ## Errors are returned, not thrown
 *
 * Each action returns a `FormState` for `useActionState`. A throw unmounts the
 * form into `error.tsx`, taking the typed email with it, for something as ordinary
 * as a wrong password. The one exception is success, which `redirect()`s — and
 * `redirect` works by throwing, so it must be called OUTSIDE any try/catch that
 * would swallow it.
 */

/**
 * `FormState` and `fieldErrorsOf` live in `./form-state`, not here.
 *
 * A `"use server"` module may only export async functions — each export becomes a
 * callable RPC endpoint — so a synchronous helper or an exported const is a build
 * error, reported unhelpfully as "Ecmascript file had an error" on the export
 * line. Re-exported below purely so existing imports of this module keep working.
 */
export type { FormState } from "./form-state";

const loginSchema = z.object({
  email: z.email("That doesn't look like an email address."),
  // Deliberately NOT a strength rule. Validating an existing password against
  // today's rules would reject an older account that predates them, telling
  // someone their correct password is invalid.
  password: z.string().min(1, "Enter your password."),
});

/**
 * Exchange credentials for a session.
 *
 * ## This does NOT check that the account is an ADMIN, on purpose
 *
 * A vendor or shopper who signs in here gets a valid session and is then sent to
 * `/not-authorised` by `requireAdmin()` on the next request, against a live
 * `GET /auth/me`.
 *
 * Refusing non-admins *here* would be worse in two ways. It would make this form
 * an oracle for which accounts are admins — a genuinely useful thing for an
 * attacker to learn, and this is the login page for the account type worth
 * attacking. And it would have to decide using `result.data.user.role`, the claim
 * baked into the token, which is exactly the stale value the rest of this app
 * refuses to gate on. One gate, reading one live source.
 */
export async function signIn(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const result = await authClient.login({ config: apiConfig }, parsed.data);

  if (!result.ok) {
    const { error } = result;
    // `INVALID_CREDENTIALS` is deliberately the same answer for a wrong password
    // and an unknown address — the API is not an account-existence oracle, and
    // saying "no account with that email" here would undo that.
    if (error.kind === "http" && error.status === 401) {
      return { error: "That email and password don't match an account." };
    }
    if (error.kind === "http" && error.code === "ACCOUNT_SUSPENDED") {
      return {
        error:
          "This account has been deactivated. Ask another admin to reactivate it.",
      };
    }
    if (error.kind === "http" && error.status === 429) {
      const seconds = error.retryAfterMs
        ? Math.ceil(error.retryAfterMs / 1000)
        : null;
      return {
        error: seconds
          ? `Too many attempts. Try again in ${String(seconds)} seconds.`
          : "Too many attempts. Try again shortly.",
      };
    }
    return { error: shopperMessage(error) };
  }

  await setSessionCookie(sessionFromTokens(result.data));
  // The shell renders the signed-in email from the session.
  revalidatePath("/", "layout");

  // After every await, and outside the failure branch: `redirect` throws.
  redirect(safeNext(String(formData.get("next") ?? ""), "/"));
}

/**
 * Sign out.
 *
 * Revokes the refresh token server-side as a courtesy, then clears the cookie
 * **unconditionally**. If the revocation fails because the network is down, the
 * admin still asked to be signed out; leaving the cookie because a best-effort
 * call failed is the opposite of what they asked for.
 */
export async function signOut(): Promise<void> {
  const session = await getSession();

  if (session) {
    // Best effort. The result is deliberately unused — see above.
    await authClient.logout(ctxFor(session), session.refreshToken);
  }

  await clearSessionCookie();
  revalidatePath("/", "layout");
  redirect("/login");
}
