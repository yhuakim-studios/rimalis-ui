import { ShieldCheck } from "lucide-react";

/**
 * The layout for screens reachable without an admin session.
 *
 * One centred column, no nav. Both routes in this group are terminal: `/login`
 * takes a credential, `/not-authorised` explains why a valid session still cannot
 * be here. Offering navigation to a console the visitor cannot use is the whole
 * thing this group exists to avoid — a nav bar whose every destination 403s reads
 * as a broken app rather than a closed door.
 *
 * The wordmark is deliberately NOT a link, unlike the vendor app's. There `/`
 * is a storefront-adjacent dashboard worth returning to; here it is a gated page
 * that would bounce straight back, so a link on the one screen a signed-out
 * visitor sees would be a loop.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-center px-6 pb-2 pt-10">
        <span className="inline-flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">
            <ShieldCheck className="size-4" strokeWidth={2} aria-hidden />
          </span>
          <span className="text-section font-semibold tracking-tight">Rimalis</span>
          <span className="text-caption text-ink-muted">admin</span>
        </span>
      </header>

      <main
        id="main"
        className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center px-6 py-10"
      >
        {children}
      </main>

      <footer className="px-6 pb-8 text-center text-meta text-ink-subtle">
        Every action here is recorded against your account.
      </footer>
    </div>
  );
}
