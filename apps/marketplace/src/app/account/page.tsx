import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, MailWarning } from "lucide-react";
import { ErrorState } from "@/components/feedback";
import { Badge, Card } from "@/components/primitives";
import { account, ctxFor, requireSession } from "@/lib/auth";
import { ProfileForm } from "./ProfileForm";
import { PasswordForm } from "./PasswordForm";
import { SessionActions } from "./SessionActions";

/**
 * Profile, verification status, password, sessions.
 *
 * ## Everything here comes from `GET /users/me`, not from the session cookie
 *
 * The cookie carries a name and an email so the header can greet someone
 * without an API call. This page shows `isVerified`, `phone` and
 * `verificationSentAt`, none of which are in it — deliberately. A cookie minted
 * before the shopper clicked the link in their email would report them
 * unverified for a week, and an account page that is wrong about the one thing
 * gating checkout is worse than no account page.
 */

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requireSession("/account");
  const profile = await account.getProfile(ctxFor(session));

  if (!profile.ok) {
    return <ErrorState error={profile.error} title="We couldn't load your account" />;
  }

  const user = profile.data;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-heading text-ink">
          {user.firstName} {user.lastName}
        </h1>
        <p className="text-body text-ink-muted">{user.email}</p>
      </div>

      <Card tone="flat" padding="md" className="flex flex-wrap items-center gap-4">
        {user.isVerified ? (
          <>
            <BadgeCheck className="size-5 text-brand-700" strokeWidth={1.75} aria-hidden />
            <div className="flex min-w-0 flex-col gap-1">
              <Badge tone="brand">Email verified</Badge>
              <p className="text-caption text-ink-muted">
                You can check out with this account.
              </p>
            </div>
          </>
        ) : (
          <>
            <MailWarning className="size-5 text-danger" strokeWidth={1.75} aria-hidden />
            <div className="flex min-w-0 flex-col gap-1">
              <Badge tone="danger">Email not verified</Badge>
              <p className="text-caption text-ink-muted">
                Ordering needs a confirmed address.{" "}
                <Link href="/verify-email" className="font-medium text-ink underline underline-offset-4">
                  Send a new link
                </Link>
                .
              </p>
            </div>
          </>
        )}
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-section text-ink">Your details</h2>
        <ProfileForm user={user} />
      </section>

      <section className="flex flex-col gap-4 border-t border-divider pt-8">
        <h2 className="text-section text-ink">Password</h2>
        <p className="text-caption text-ink-muted">
          {/* Said before they start typing, not after. Changing the password
              revokes every session including this one — a shopper who learns
              that from being logged out concludes something broke. */}
          Changing your password signs you out everywhere, including here.
        </p>
        <PasswordForm />
      </section>

      <section className="flex flex-col gap-4 border-t border-divider pt-8">
        <h2 className="text-section text-ink">Sessions</h2>
        <SessionActions />
      </section>
    </div>
  );
}
