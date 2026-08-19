import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { SignOutButton } from "@/components/SignOutButton";

/**
 * The app header: which platform you are administering, as whom, and the way out.
 *
 * ## Why the signed-in email is here rather than nowhere
 *
 * The vendor app's header answers "which store am I in", because the seed alone
 * has five and a support conversation starts with that. The admin equivalent is
 * "which account am I acting as", and it matters for a sharper reason: every
 * action taken here is written to the audit trail against this identity. An admin
 * who does not notice they are signed in as a shared or colleague's account
 * attributes their own suspensions and price changes to someone else, and the
 * trail is the one record that is supposed to be trustworthy.
 *
 * ## No logo image, no drawer, no store chip
 *
 * There is no per-tenant logo to render — there is one platform. The hamburger
 * that would open a nav drawer is rejected for the reason `TopNav` explains: it is
 * a second navigation to the same ten places behind an extra tap.
 *
 * A Server Component. It takes the identity `requireAdmin()` already fetched
 * rather than fetching its own — one `GET /auth/me` per render, not two.
 */
export function Header({ email }: { email: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-divider bg-surface/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-3 md:px-8">
        <Link
          href="/"
          prefetch={false}
          className="flex min-w-0 items-center gap-2.5 rounded-input px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <span
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-white"
            aria-hidden
          >
            <ShieldCheck className="size-4" strokeWidth={2} />
          </span>

          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-caption font-semibold">Rimalis admin</span>
            {/*
              `truncate` because an email is user-supplied and unbounded, which
              would otherwise push the sign-out control off a 360px viewport.
            */}
            {/*
              Can be empty for one discarded render: the layout reads the session
              without redirecting, so when there is none the page's own guard
              redirects and this output is thrown away. Rendering an empty span
              rather than "undefined" keeps that invisible.
            */}
            {email !== "" && (
              <span className="truncate text-meta text-ink-subtle">{email}</span>
            )}
          </span>
        </Link>

        <div className="ml-auto shrink-0">
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
