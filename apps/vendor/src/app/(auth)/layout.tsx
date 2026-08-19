import Link from "next/link";
import { Store } from "lucide-react";

/**
 * The layout for screens a signed-OUT vendor can reach, plus the status gates.
 *
 * One centred column, no nav. Every route in this group is terminal: either it
 * takes a credential (login) or it explains why the dashboard is unavailable
 * (pending, suspended, rejected, apply). Offering navigation to a dashboard the
 * visitor cannot use is the whole thing this group exists to avoid.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-center px-6 pt-10 pb-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-input px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">
            <Store className="size-4" strokeWidth={2} aria-hidden />
          </span>
          <span className="text-section font-semibold tracking-tight">Rimalis</span>
          <span className="text-caption text-ink-muted">for sellers</span>
        </Link>
      </header>

      <main
        id="main"
        className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center px-6 py-10"
      >
        {children}
      </main>

      <footer className="px-6 pb-8 text-center text-meta text-ink-subtle">
        Selling on Rimalis means one basket across every store.
      </footer>
    </div>
  );
}
