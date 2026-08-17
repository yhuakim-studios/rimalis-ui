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
  requireSession,
  safeNext,
  setSessionCookie,
  vendor,
} from "./auth";
import { apiConfig } from "./env";
import { sessionFromTokens } from "./session";

/**
 * Sign in, sign out, apply — the Server Actions behind the auth forms.
 *
 * ## Why these are Server Actions and not `fetch` from a client component
 *
 * They set the session cookie. Under the BFF (ADR-0003) the browser must never
 * hold the API's tokens, so the exchange has to happen somewhere the browser
 * cannot see, and what the browser gets back is a `Set-Cookie` it cannot read. A
 * client-side call would also *work in development* — the API's local
 * `corsOrigins` allows `localhost:5175` — and fail in production where that list
 * is empty.
 *
 * ## Errors are returned, not thrown
 *
 * Each action returns a `FormState` for `useActionState`. A throw unmounts the
 * form into `error.tsx`, taking the typed email with it, for something as
 * ordinary as a wrong password. The one exception is success, which
 * `redirect()`s — and `redirect` works by throwing, so it must be called OUTSIDE
 * any try/catch that would swallow it.
 */

export interface FormState {
  /** Shown above the form. `undefined` on first render and on success. */
  error?: string;
  /** Per-field messages, keyed by input name. */
  fieldErrors?: Record<string, string>;
  /** A confirmation for actions that do not navigate. */
  message?: string;
}

const loginSchema = z.object({
  email: z.email("That doesn't look like an email address."),
  // Deliberately NOT a strength rule. Validating an existing password against
  // today's rules would reject an older account that predates them, telling a
  // vendor their correct password is invalid.
  password: z.string().min(1, "Enter your password."),
});

const applySchema = z.object({
  storeName: z
    .string()
    .min(2, "Your store name needs at least 2 characters.")
    .max(120, "Keep the store name under 120 characters."),
  description: z.string().max(2000).optional(),
  businessName: z.string().max(200).optional(),
  cacNumber: z.string().max(50).optional(),
});

/** Turns a Zod failure into per-field copy the form can render inline. */
function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && errors[key] === undefined) errors[key] = issue.message;
  }
  return errors;
}

/**
 * Exchange credentials for a session.
 *
 * ## This does NOT check that the account is a vendor, on purpose
 *
 * A signed-in shopper with no vendor record lands on `/apply`; a `PENDING` one
 * lands on `/pending`. Both of those are decided by `requireApprovedVendor()` on
 * the next request, against a live `GET /vendors/me`.
 *
 * Rejecting non-vendors *here* would be worse in two ways. It would make the
 * login form an oracle for which accounts are vendors, and it would have to
 * decide using `result.data.user.vendorStatus` — the claim baked into the token,
 * which is exactly the stale value the rest of this app refuses to gate on. One
 * gate, reading one live source, is the whole design.
 */
export async function signIn(_previous: FormState, formData: FormData): Promise<FormState> {
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
        error: "This account has been deactivated. Contact support if you think that's a mistake.",
      };
    }
    if (error.kind === "http" && error.status === 429) {
      const seconds = error.retryAfterMs ? Math.ceil(error.retryAfterMs / 1000) : null;
      return {
        error: seconds
          ? `Too many attempts. Try again in ${String(seconds)} seconds.`
          : "Too many attempts. Try again shortly.",
      };
    }
    return { error: shopperMessage(error) };
  }

  await setSessionCookie(sessionFromTokens(result.data));
  // The shell renders the store name and the nav from the session.
  revalidatePath("/", "layout");

  // After every await, and outside the failure branch: `redirect` throws.
  redirect(safeNext(String(formData.get("next") ?? ""), "/"));
}

/**
 * Sign out.
 *
 * Revokes the refresh token server-side as a courtesy, then clears the cookie
 * **unconditionally**. If the revocation fails because the network is down, the
 * vendor still asked to be signed out; leaving the cookie because a best-effort
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

/**
 * Apply to become a vendor, from a signed-in account with no vendor record.
 *
 * Creates a `PENDING` vendor, so the success path is `/pending` rather than the
 * dashboard — there is nothing to show a seller who cannot trade yet. A 409 means
 * an application already exists, which is not an error worth a red banner: send
 * them to the gate, which will explain whichever state it is in.
 */
export async function applyAsVendor(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = applySchema.safeParse({
    storeName: String(formData.get("storeName") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    businessName: String(formData.get("businessName") ?? "").trim() || undefined,
    cacNumber: String(formData.get("cacNumber") ?? "").trim() || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const session = await requireSession("/apply");
  const result = await vendor.apply(ctxFor(session), parsed.data);

  if (!result.ok) {
    const { error } = result;
    if (vendor.isVendorProfileExists(error)) {
      // 409 — an application is already on file. The gate knows which state.
      redirect("/pending");
    }
    if (error.kind === "http" && error.status === 400) {
      return { error: error.message, ...(error.details ? {} : {}) };
    }
    return { error: shopperMessage(error) };
  }

  revalidatePath("/", "layout");
  redirect("/pending");
}
