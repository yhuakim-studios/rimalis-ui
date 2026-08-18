"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/primitives";
import { NAV_ITEMS, isActive } from "./nav-items";

/**
 * The sub-`md` nav: one horizontally scrollable row of pills.
 *
 * ## Why not a bottom bar, and why not a drawer
 *
 * The vendor and marketplace apps use a **bottom bar**, and it is right for them:
 * a bottom bar fits five 44px targets across a 360px viewport. This app has ten
 * destinations. Six is already where labels start truncating, so ten in a fixed
 * bar means either unlabelled icons — and "FolderTree" versus "Percent" as bare
 * glyphs is a guessing game — or a bar that scrolls, which is a scrolling bottom
 * bar, which is worse than a scrolling top one because it fights the thumb.
 *
 * A **drawer** was the other option and is rejected for the reason the vendor
 * app's `Header` already gives: it is a second navigation to the same places,
 * behind an extra tap, whose open/closed state is one more thing to manage. It
 * also needs client state and a focus trap to be accessible, for a nav that fits
 * on screen if you let it scroll.
 *
 * So: the same ten items, in the same order, scrolled. An admin on a phone is
 * doing something specific and urgent — approving a vendor, checking whether an
 * order paid — and a scroll is a smaller tax than a hunt.
 *
 * `prefetch={false}` for the same non-negotiable reason as `SideNav`: ten links
 * in the viewport would fire ten authenticated renders and can trigger concurrent
 * session refreshes, which the API treats as token theft.
 */
export function TopNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      // `md:hidden` — the mirror of SideNav's `hidden md:block`, so exactly one
      // of the two is ever mounted and there is no duplicate landmark for a
      // screen reader to announce.
      className="md:hidden"
    >
      {/*
        `-mx-4 px-4` bleeds the scroll region to the screen edges while keeping
        the first and last pill inset — without it the row appears to be clipped
        mid-pill rather than to continue, which is the difference between "there
        is more here" and "this is broken".

        `scrollbar-none` is deliberately NOT used: there is no such utility in the
        theme, and a hidden scrollbar on a scroll region with no other affordance
        hides the only hint that it scrolls at all.
      */}
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          const Icon = item.icon;

          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // `rounded-pill` and a 44px min height: this is the primary
                  // touch target on mobile and the design system's minimum
                  // applies to it.
                  "flex min-h-11 items-center gap-2 rounded-pill px-3.5 text-caption transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                  active
                    ? // A tint, not a fill — the nav is never the point of the
                      // screen, and a filled pill would compete with whatever
                      // action the page itself is offering.
                      "bg-brand-50 font-semibold text-brand-700"
                    : "bg-canvas text-ink-muted hover:text-ink",
                )}
              >
                <Icon
                  className="size-[18px] shrink-0"
                  strokeWidth={active ? 2.25 : 1.75}
                  aria-hidden
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
