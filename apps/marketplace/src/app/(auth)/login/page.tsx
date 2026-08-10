import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormBanner } from "@/components/forms";
import { getSession, safeNext } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

/**
 * Sign in.
 *
 * ## `reason` exists because a silent bounce to a login form is alarming
 *
 * Several paths land a shopper here who did not click "Sign in": a session that
 * aged out, a password change that revoked every session, a refresh token the
 * API decided was stolen. Arriving at a login page with no explanation reads as
 * "the site logged me out for no reason", and the theft case in particular is
 * something they should be told about rather than shielded from.
 *
 * The values are ours, not the API's, and unknown ones render nothing — this is
 * a query parameter anyone can type, so it selects from a fixed table rather
 * than being displayed.
 */

export const metadata: Metadata = {
  title: "Sign in",
  // A sign-in page has nothing to offer a search engine and every reason not to
  // appear in one — an indexed login page is a phishing target with our brand
  // already attached to it.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const REASONS: Record<string, { tone: "error" | "success"; message: string }> = {
  expired: {
    tone: "error",
    message: "Your session expired. Sign in again to pick up where you left off.",
  },
  revoked: {
    tone: "error",
    message:
      "You've been signed out of every device. If that wasn't you, change your password after signing in.",
  },
  unreachable: {
    tone: "error",
    message:
      "We couldn't reach our servers to renew your session. Try signing in again in a moment.",
  },
  "password-changed": {
    tone: "success",
    message: "Your password has been changed. Sign in with the new one.",
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next: rawNext, reason } = await searchParams;
  const next = safeNext(rawNext);

  // Already signed in and arriving here by hand — send them on rather than
  // offering a second sign-in, which would burn a refresh token to replace a
  // session that is working.
  const session = await getSession();
  if (session) redirect(next);

  const notice = reason ? REASONS[reason] : undefined;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-heading text-ink">Sign in</h1>
        <p className="text-body text-ink-muted">
          Your basket is saved on this device either way — signing in is what lets you
          check out.
        </p>
      </div>

      {notice && <FormBanner tone={notice.tone}>{notice.message}</FormBanner>}

      <LoginForm next={next} />
    </div>
  );
}
