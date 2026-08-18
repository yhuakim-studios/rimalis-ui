import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, safeNext } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

/**
 * The one page reachable without a session.
 *
 * ## Why the `reason` parameter exists
 *
 * `/api/session/refresh` sends an admin here with `reason=expired`,
 * `reason=revoked` or `reason=unreachable`, and the three need different words.
 * "Your session expired" in front of someone whose problem is that the API is
 * mid-deploy sends them hunting for a password that was never wrong. `revoked`
 * matters most: it means the API saw a refresh token replayed and destroyed every
 * session for the account, so from the admin's side they were signed out of every
 * device at once. Silence there is alarming, and a wrong explanation is worse.
 *
 * ## Why an existing session is sent onward rather than judged here
 *
 * A vendor or shopper who lands here with a valid cookie is redirected to the
 * target, and `requireAdmin()` there decides they belong on `/not-authorised`.
 * Answering it on this page would mean reading `role` off the cookie — the stale
 * claim the whole app refuses to gate on — and would make this form an oracle for
 * which accounts are admins.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;
  const target = safeNext(next, "/");

  if (await getSession()) redirect(target);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-heading font-semibold tracking-tight">Sign in</h1>
        <p className="text-body text-ink-muted">
          Platform administration — vendors, the product pool, orders and the
          ledger.
        </p>
      </div>

      <LoginForm next={target} reason={reason} />
    </div>
  );
}
