import Link from "next/link";
import { Store } from "lucide-react";
import { BottomNav, Header, SideNav } from "@/components/layout";
import { requireApprovedVendor } from "@/lib/auth";

/**
 * The signed-in shell, and the gate.
 *
 * ## Every page in this group is protected by this one call
 *
 * `requireApprovedVendor()` runs before any child renders, and it either returns
 * an `APPROVED` profile or redirects — to `/login` with no session, to
 * `/api/session/refresh` on an aged token, or to the matching status screen.
 * Putting it in the layout rather than in each page means a new route under
 * `(dashboard)` is protected by existing, which is the right default: the failure
 * mode of the alternative is a page someone forgot to guard.
 *
 * ⚠️ **A layout is not a security boundary on its own.** Next renders layouts and
 * pages in parallel and a layout's redirect does not cancel a child's data fetch,
 * so a page must never treat "the layout guarded me" as permission to skip its own
 * `requireApprovedVendor()`. Each page calls it too. That is not redundant — it
 * costs one cached `GET /vendors/me` and it is what makes the page's own access
 * check true rather than inherited. The same reasoning is why Next's own docs
 * tell you to authorise in the page or the data layer, not the layout.
 *
 * ## Why the profile is not passed down through context
 *
 * The pages that need it call `requireApprovedVendor()` and get their own copy.
 * Threading it through a Context would make every consumer a Client Component,
 * which for a profile that is server data and never mutates during a render is a
 * bundle cost for nothing.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { vendor } = await requireApprovedVendor("/");

  return (
    <div className="flex min-h-screen flex-col">
      <Header vendor={vendor} />

      <div className="mx-auto flex w-full max-w-shell flex-1 gap-8 px-4 md:px-8">
        {/*
          The sidebar column. `sticky` with its own scroll so a long product list
          does not carry the nav off the top of the screen — on a page that scrolls
          for a hundred listings, a nav you have to scroll back up to reach is a
          nav you stop using.
        */}
        <aside className="hidden w-[200px] shrink-0 py-8 md:block">
          <div className="sticky top-[88px]">
            <SideNav />

            <Link
              href="/settings"
              prefetch={false}
              className="mt-6 flex items-center gap-2 rounded-input px-3 py-2 text-meta text-ink-subtle transition-colors hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <Store className="size-3.5" strokeWidth={1.75} aria-hidden />
              <span className="truncate">/{vendor.slug}</span>
            </Link>
          </div>
        </aside>

        {/*
          `min-w-0` is load-bearing. Without it a flex child refuses to shrink
          below its content's intrinsic width, so one long product name or a wide
          table pushes the whole page horizontally instead of truncating — and the
          overflow appears on the body, which is the one place it must never be.

          `pb-24` on mobile clears the fixed bottom nav. Without it the last row of
          every list sits underneath it and cannot be tapped.
        */}
        <main id="main" className="min-w-0 flex-1 pb-24 pt-6 md:pb-12 md:pt-8">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
