import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, safeNext } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

/**
 * The one public page.
 *
 * ## Why the `reason` parameter exists
 *
 * `/api/session/refresh` sends a vendor here with `reason=expired`,
 * `reason=revoked` or `reason=unreachable`, and the three need different words.
 * "Your session expired" in front of someone whose problem is that Railway is
 * mid-deploy sends them hunting for a password that was never wrong. `revoked`
 * matters most: it means the API saw a refresh token replayed and destroyed every
 * session for the account, so from the vendor's side they were signed out of
 * every device at once — silence there is alarming, and a wrong explanation is
 * worse.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;
  const target = safeNext(next, "/");

  // Already signed in — no reason to show a form. The dashboard's own guard
  // decides whether this account may actually see it, which is why this sends
  // them onward rather than trying to answer that here.
  if (await getSession()) redirect(target);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-heading font-semibold tracking-tight">Sign in</h1>
        <p className="text-body text-ink-muted">
          Manage your listings, fulfil orders and track what you have been paid.
        </p>
      </div>

      <LoginForm next={target} reason={reason} />
    </div>
  );
}
