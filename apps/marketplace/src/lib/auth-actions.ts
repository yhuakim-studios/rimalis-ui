"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { shopperMessage } from "@rimalis/api-client";
import { authClient, clearSessionCookie, getSession, safeNext, setSessionCookie } from "./auth";
import { apiConfig } from "./env";
import { sessionFromTokens } from "./session";

/**
 * Sign in, sign up, sign out, verify — the Server Actions behind the auth forms.
 *
 * ## Why these are Server Actions and not `fetch` from a client component
 *
 * They set the session cookie. Under the BFF (ADR-0003) the browser must never
 * hold the API's tokens, so the exchange has to happen somewhere the browser
 * cannot see, and the response the browser gets back is a `Set-Cookie` it cannot
 * read. A client-side call to the API would also *work in development* — the
 * API's local `corsOrigins` allows `localhost:5173` — and fail in production
 * where that list is empty, which is the worst possible time to find out.
 *
 * ## The shape of the state, and why errors are returned rather than thrown
 *
 * Each action returns a `FormState` for `useActionState`. A throw would unmount
 * the form into `error.tsx`, taking the shopper's typed email with it, for
 * something as ordinary as a wrong password. The one exception is a successful
 * sign-in, which `redirect()`s — and `redirect` throws by design, so it must be
 * called OUTSIDE any try/catch that would swallow it.
 */

export interface FormState {
  /** Shown above the form. `undefined` on first render and on success. */
  error?: string;
  /** Per-field messages, keyed by input name. */
  fieldErrors?: Record<string, string>;
  /** A confirmation for actions that do not navigate. */
  message?: string;
}

/** The API's own password rule, mirrored so a shopper hears it before submitting. */
const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .regex(/[A-Z]/, "Include at least one capital letter.")
  .regex(/[0-9]/, "Include at least one number.");

const loginSchema = z.object({
  email: z.email("That doesn't look like an email address."),
  // Deliberately NOT the `password` schema. Validating an existing password
  // against today's rules would reject an older account that predates them,
  // telling a shopper their correct password is invalid.
  password: z.string().min(1, "Enter your password."),
});

const registerSchema = z.object({
  firstName: z.string().min(1, "Enter your first name.").max(100),
  lastName: z.string().min(1, "Enter your last name.").max(100),
  email: z.email("That doesn't look like an email address."),
  password,
  phone: z.string().trim().optional(),
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
    // helpfully saying "no account with that email" here would undo that.
    if (error.kind === "http" && error.status === 401) {
      return { error: "That email and password don't match an account." };
    }
    if (error.kind === "http" && error.code === "ACCOUNT_SUSPENDED") {
      return {
        error:
          "This account has been deactivated. Contact support if you think that's a mistake.",
      };
    }
    if (error.kind === "http" && error.status === 429) {
      const seconds = error.retryAfterMs ? Math.ceil(error.retryAfterMs / 1000) : null;
      return {
        error: seconds
          ? `Too many attempts. Try again in ${seconds} seconds.`
          : "Too many attempts. Try again shortly.",
      };
    }
    return { error: shopperMessage(error) };
  }

  await setSessionCookie(sessionFromTokens(result.data));
  // The cart badge and any signed-in chrome are rendered in the root layout.
  revalidatePath("/", "layout");

  // Outside the `if (!result.ok)` above and after every await: `redirect` works
  // by throwing, so anything that catches broadly would swallow the navigation
  // and leave the shopper on a form that appears to have done nothing.
  redirect(safeNext(String(formData.get("next") ?? ""), "/"));
}

export async function signUp(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    phone: String(formData.get("phone") ?? "").trim() || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { phone, ...rest } = parsed.data;
  const result = await authClient.register(
    { config: apiConfig },
    { ...rest, ...(phone ? { phone } : {}) },
  );

  if (!result.ok) {
    const { error } = result;
    if (error.kind === "http" && error.code === "EMAIL_TAKEN") {
      return {
        fieldErrors: { email: "An account already uses this email. Sign in instead." },
      };
    }
    return { error: shopperMessage(error) };
  }

  // Registration returns a usable token pair immediately — verification gates
  // CHECKOUT, not sign-in — so a new shopper lands signed in and can browse and
  // build a basket while the mail is still in flight.
  await setSessionCookie(sessionFromTokens(result.data));
  revalidatePath("/", "layout");

  redirect(safeNext(String(formData.get("next") ?? ""), "/"));
}

/**
 * Signs out.
 *
 * The cookie is cleared **unconditionally**, before the outcome of the
 * revocation is known and regardless of it. The shopper asked to be signed out;
 * leaving them signed in because the API was unreachable is the opposite of what
 * they asked for, and the refresh token they keep expires on its own within a
 * week either way.
 */
export async function signOut(): Promise<void> {
  const session = await getSession();
  await clearSessionCookie();

  if (session) {
    // Best effort, and its failure is ignored on purpose. The API answers 200
    // even for a token that is already gone, so there is nothing to report.
    await authClient.logout({ config: apiConfig }, session.refreshToken);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Revokes every session for this account — the remedy for "I think someone else
 * is signed in as me".
 */
export async function signOutEverywhere(): Promise<void> {
  const session = await getSession();
  if (session) {
    await authClient.logoutAll({ config: apiConfig, accessToken: session.accessToken });
  }
  await clearSessionCookie();
  revalidatePath("/", "layout");
  redirect("/login?reason=revoked");
}

/**
 * Asks for another verification email.
 *
 * Two throttles sit behind this: a per-IP rate limit and a **60 second
 * per-account cooldown** on `User.verificationSentAt`. The account page reads
 * that field and disables the button, so this handles the 429 mainly for the
 * case of two tabs.
 *
 * The API answers identically whether or not the address exists, so the copy
 * must not imply the address was found.
 */
export async function resendVerification(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter the email address on your account." };

  const result = await authClient.resendVerification({ config: apiConfig }, email);

  if (!result.ok) {
    if (result.error.kind === "http" && result.error.status === 429) {
      const seconds = result.error.retryAfterMs
        ? Math.ceil(result.error.retryAfterMs / 1000)
        : 60;
      return { error: `Please wait ${seconds} seconds before asking again.` };
    }
    return { error: shopperMessage(result.error) };
  }

  return {
    message: "If that address has an account, a verification email is on its way.",
  };
}

/**
 * Changes the password, then signs the shopper out — because the API has
 * already destroyed every session, including this one.
 *
 * The access token in hand keeps working until it expires, so a UI that stayed
 * put would look fine and then fail with an unexplained 401 up to fifteen
 * minutes later. Clearing the cookie and redirecting is the only honest response.
 */
export async function changePassword(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const parsed = password.safeParse(String(formData.get("newPassword") ?? ""));

  if (!currentPassword) {
    return { fieldErrors: { currentPassword: "Enter your current password." } };
  }
  if (!parsed.success) {
    return { fieldErrors: { newPassword: parsed.error.issues[0]?.message ?? "Invalid password." } };
  }

  const session = await getSession();
  if (!session) redirect("/login?next=%2Faccount");

  const result = await authClient.changePassword(
    { config: apiConfig, accessToken: session.accessToken },
    { currentPassword, newPassword: parsed.data },
  );

  if (!result.ok) {
    // Both are 400s with a `code`, NOT 401s — the caller is authenticated, the
    // *payload* is wrong. Branching on the status alone would put "wrong
    // password" copy under a session-expired banner.
    if (result.error.code === "WRONG_PASSWORD") {
      return { fieldErrors: { currentPassword: "That isn't your current password." } };
    }
    if (result.error.code === "SAME_PASSWORD") {
      return { fieldErrors: { newPassword: "Choose a password you haven't used here before." } };
    }
    return { error: shopperMessage(result.error) };
  }

  await clearSessionCookie();
  revalidatePath("/", "layout");
  redirect("/login?reason=password-changed");
}
