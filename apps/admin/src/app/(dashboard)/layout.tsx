import { Header, SideNav, TopNav } from "@/components/layout";
import { requireAdmin } from "@/lib/auth";

/**
 * The signed-in shell, and the gate.
 *
 * ## Every page in this group is guarded by this call — and guards itself again
 *
 * `requireAdmin()` runs before any child renders and either returns an ADMIN
 * identity or redirects: to `/login` with no session, to `/api/session/refresh`
 * on an aged token, to `/not-authorised` for a valid session that is not an
 * admin's. Putting it in the layout means a new route under `(dashboard)` is
 * protected by existing, which is the right default — the failure mode of the
 * alternative is a page someone forgot to guard.
 *
 * ⚠️ **A layout is not a security boundary on its own.** Next renders layouts and
 * pages in parallel, and a layout's `redirect()` does not cancel a child's data
 * fetch that has already started. So a page must never treat "the layout guarded
 * me" as permission to skip its own `requireAdmin()`. Every page calls it. That is
 * not redundant: it costs one JWT-only `GET /auth/me` and it is what makes the
 * page's own access check true rather than inherited. It is also why Next's own
 * documentation says to authorise in the page or the data layer, never in a
 * layout.
 *
 * ## Why the identity is not passed down through context
 *
 * Pages that need it call `requireAdmin()` and get their own copy. Threading it
 * through a Context would make every consumer a Client Component, which for
 * server data that never mutates during a render is a bundle cost for nothing.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { identity } = await requireAdmin("/");

  return (
    <div className="flex min-h-screen flex-col">
      <Header email={identity.email} />

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
