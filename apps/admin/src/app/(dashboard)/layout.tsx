import { redirect } from "next/navigation";
import { Header, SideNav, TopNav } from "@/components/layout";
import { getSession } from "@/lib/auth";

/**
 * The signed-in shell.
 *
 * ## Why this does NOT call `requireAdmin()`, and every page does
 *
 * It did, and it cost every deep link. A layout in the App Router **cannot learn the
 * current pathname** — there is no `usePathname` on the server, `headers()` carries
 * no path (verified: only host, user-agent, accept, cookie and the x-forwarded-*
 * set), and the one mechanism that would provide it is `middleware.ts`, which this
 * app must never have because the edge runtime inlines env at build time and
 * `SESSION_SECRET` arrives at request time.
 *
 * So a guard here can only redirect to `/login?next=/`. Layouts and pages render in
 * parallel and the layout's redirect resolves first, so it won IN EVERY CASE: an
 * admin following a link to `/vendors/abc` signed in and landed on the dashboard,
 * every time, with the page they asked for lost. Verified before and after — the
 * `next` parameter was `%2F` for all eleven routes.
 *
 * That is a bad trade. The deep-link loss was certain and user-visible; the
 * protection was redundant, because **every page already calls `requireAdmin(here)`
 * with its own path** — which it can, being the thing that knows it.
 *
 * ## What it still does, and why that part is safe here
 *
 * Two things, both path-independent:
 *
 *   - Reads the session for the header. `getSession()`, which never redirects and
 *     never throws. When there is none, the page's own guard redirects and this
 *     output is discarded, so the shell briefly rendering without an email is not
 *     observable.
 *   - Redirects a signed-in NON-ADMIN to `/not-authorised`, which takes no `next` —
 *     there is nowhere to come back to. This is the cookie's `role` claim, a stale
 *     hint, so it is a fast-fail and not the boundary; the page's live `GET /auth/me`
 *     is. It earns its place by stopping the admin shell from rendering around
 *     someone who cannot use any of it.
 *
 * ⚠️ A layout is not a security boundary in this framework, and this one no longer
 * pretends to be. **Every page under `(dashboard)` must call `requireAdmin(here)`
 * itself.** That is not belt-and-braces any more; it is the guard.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // The cookie's claim, used only to keep the shell off a non-admin's screen. No
  // `next` — /not-authorised is terminal. The live check is on every page.
  if (session !== null && session.user.role !== "ADMIN") redirect("/not-authorised");

  return (
    <div className="flex min-h-screen flex-col">
      <Header email={session?.user.email ?? ""} />

      <div className="mx-auto flex w-full max-w-shell flex-1 gap-8 px-4 md:px-8">
        {/*
          The sidebar column. `sticky` with the header's height as its offset, so a
          long product list does not carry the nav off the top of the screen — on a
          page that scrolls for a hundred rows, a nav you have to scroll back up to
          reach is a nav you stop using.

          `w-[210px]` rather than the vendor app's 200: "Stock purchases" is the
          longest label here and it wraps at 200.
        */}
        <aside className="hidden w-[210px] shrink-0 py-8 md:block">
          <div className="sticky top-[88px]">
            <SideNav />
          </div>
        </aside>

        {/*
          `min-w-0` is load-bearing, and more so in this app than in the others.
          Without it a flex child refuses to shrink below its content's intrinsic
          width, so a six-column table pushes the whole PAGE sideways instead of
          scrolling inside its own card — and the overflow lands on the body, which
          is the one place it must never be, because the sticky header slides off
          with it. `TableShell` owns the inner `overflow-x-auto`; this is the other
          half of that contract.

          No `pb-24` for a bottom nav, unlike the vendor app: `TopNav` sits above
          the content, so nothing overlaps the last row of a list.
        */}
        <main id="main" className="min-w-0 flex-1 pb-12 pt-6 md:pt-8">
          {/* Mobile navigation, above the page content. Hidden from `md` up. */}
          <div className="mb-6 md:hidden">
            <TopNav />
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
