import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Badge, Card } from "@/components/primitives";
import { ErrorState } from "@/components/feedback";
import {
  ConfirmAction,
  RoleForm,
  accountState,
  userRole,
  verificationState,
} from "@/components/admin";
import { admin, ctxFor, requireAdmin } from "@/lib/auth";
import { isMissing } from "@/lib/errors";
import { absoluteDateTime, badgeTone } from "@/lib/format";
import { reactivateUser, suspendUser } from "@/lib/user-actions";

export const metadata: Metadata = { title: "User" };

/**
 * One account: who it is, what it can do, and whether it can sign in.
 *
 * ## Your own row renders no controls, and says why
 *
 * The API refuses a self role change with a 400 — the guard that stops the last
 * admin locking the whole team out. This screen does not render the control at all
 * in that case, because a disabled control an admin has to click to understand is a
 * worse explanation than a sentence. See lib/user-actions.ts for the three places
 * that guard is enforced.
 *
 * Self-suspension is blocked here too, and that one is our rule rather than the
 * API's: it would sign the admin out mid-action and need somebody else to undo.
 *
 * ## Suspension is not instant, and the copy says so
 *
 * `isActive: false` blocks a new login and blocks refresh, but an access token
 * already issued keeps working until it expires — up to 15 minutes. That is
 * different from suspending a VENDOR, where the API re-reads status from the
 * database on every request and the lock bites immediately. Conflating the two
 * produces "I suspended them and they were still ordering" as a bug report about a
 * system working as designed.
 */
export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const { session } = await requireAdmin(`/users/${userId}`);

  const result = await admin.getUser(ctxFor(session), userId);

  if (!result.ok) {
    if (isMissing(result.error)) notFound();
    return <ErrorState error={result.error} title="Couldn't load this account" />;
  }

  const user = result.data;
  const isSelf = user.id === session.user.id;
  const role = userRole(user.role);
  const account = accountState(user.isActive);
  const verification = verificationState(user.isVerified);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/users"
          prefetch={false}
          className="w-fit text-meta text-ink-muted underline decoration-divider-strong underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          ← All users
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-heading font-semibold tracking-tight">
            {`${user.firstName} ${user.lastName}`.trim() || user.email}
          </h1>
          <Badge tone={badgeTone(role.tone)}>{role.label}</Badge>
          {!user.isActive && (
            <Badge tone={badgeTone(account.tone)}>{account.label}</Badge>
          )}
        </div>
        <p className="text-body text-ink-muted">{user.email}</p>
      </div>

      {isSelf && (
        <Card tone="flat" className="border-brand-600/30 bg-brand-50">
          <div className="flex gap-3">
            <ShieldCheck
              className="size-5 shrink-0 text-brand-700"
              strokeWidth={1.75}
              aria-hidden
            />
            <div className="flex flex-col gap-1">
              <p className="text-caption font-semibold text-ink">
                This is your own account
              </p>
              <p className="text-caption text-ink-muted">
                You can&apos;t change your own role or suspend yourself. That guard
                is what stops the last remaining admin locking every other path to
                the role — promoting someone requires already being an admin. Ask
                another admin if you need either.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-section font-semibold">Account</h2>
          <dl className="flex flex-col gap-3">
            <Row label="First name" value={user.firstName} />
            <Row label="Last name" value={user.lastName} />
            <Row label="Email" value={user.email} />
            <Row label="Phone" value={user.phone} />
            <Row
              label="Email confirmed"
              value={verification.label}
              tone={user.isVerified ? undefined : "warning"}
            />
            <Row
              label="Sign-in"
              value={user.isActive ? "Allowed" : "Blocked"}
              tone={user.isActive ? undefined : "danger"}
            />
            <Row label="Registered" value={absoluteDateTime(user.createdAt)} />
          </dl>
          {!user.isVerified && (
            <p className="mt-4 text-meta text-ink-subtle">
              An unconfirmed email blocks{" "}
              <strong className="font-semibold">checkout</strong>, not sign-in — so
              this is the usual explanation for &quot;I registered but I can&apos;t
              order&quot;. There is no admin endpoint to confirm it on their behalf;
              they resend it themselves from the storefront.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-section font-semibold">Role</h2>
          {isSelf ? (
            <p className="text-caption text-ink-muted">
              Not available on your own account — see above.
            </p>
          ) : (
            <RoleForm userId={user.id} currentRole={user.role} />
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-1 text-section font-semibold">Sign-in</h2>
        <p className="mb-4 text-caption text-ink-muted">
          Suspending blocks a new sign-in and blocks refresh. A token already issued
          keeps working until it expires — up to 15 minutes — so this is not
          instant. Suspending a <em>vendor&apos;s trading</em> is a separate action
          on their vendor page, and that one takes effect on their next request.
        </p>

        <div className="flex flex-wrap gap-3">
          <ConfirmAction
            action={suspendUser}
            label="Suspend account"
            confirmLabel="Suspend"
            consequence="They can't sign in again, and can't refresh an existing session. A token already issued keeps working for up to 15 more minutes."
            danger
            reasonField={{
              label: "Reason",
              hint: "Recorded in the activity log against your account.",
            }}
            hidden={{ userId: user.id }}
            {...(isSelf
              ? { disabledReason: "You can't suspend your own account." }
              : user.isActive
                ? {}
                : { disabledReason: "Already suspended." })}
          />

          <ConfirmAction
            action={reactivateUser}
            label="Reactivate account"
            confirmLabel="Reactivate"
            consequence="They can sign in again. Their vendor status, if they have one, is unchanged by this."
            hidden={{ userId: user.id }}
            {...(user.isActive ? { disabledReason: "This account is active." } : {})}
          />
        </div>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | null;
  tone?: "danger" | "warning";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-meta text-ink-subtle">{label}</dt>
      <dd
        className={[
          "text-caption",
          tone === "danger" ? "text-danger" : tone === "warning" ? "text-ink" : "text-ink",
        ].join(" ")}
      >
        {value === null || value === "" ? (
          <span className="text-ink-subtle">—</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
