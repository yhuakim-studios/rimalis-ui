import { signOut } from "@/lib/auth-actions";

/**
 * Sign out, as a form rather than a link.
 *
 * A `<Link>` would make signing out a GET, which any prefetch, crawler or
 * link-preview can trigger. Next prefetches links in the viewport by default, so
 * the bug is not hypothetical: a nav containing a sign-out link would log
 * an admin out on hover.
 *
 * No Client Component and no `useActionState`: there is nothing to validate and
 * nothing to say if it fails, because `signOut` clears the cookie unconditionally
 * and redirects either way.
 */
export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={
          className ??
          "rounded-input px-2 py-1 text-caption text-ink-muted underline decoration-divider-strong underline-offset-4 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        }
      >
        Sign out
      </button>
    </form>
  );
}
