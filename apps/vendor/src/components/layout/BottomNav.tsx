"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/primitives";
import { MOBILE_NAV_ITEMS, isActive } from "./nav-items";

/**
 * The mobile bottom bar. Hidden from `md` up, where `SideNav` takes over.
 *
 * ## Why a Client Component when the rest of the shell is server-rendered
 *
 * It needs `usePathname()` to know what is active. That is genuinely client
 * state — it changes on every client-side navigation without a server round trip,
 * so a server-rendered active state would be stale the moment a vendor tapped
 * anything.
 *
 * The cost is contained: the nav is a fixed list of five links and no data, so
 * this ships a few hundred bytes and no API types.
 *
 * ## Five links, and not the same five as the side nav
 *
 * `MOBILE_NAV_ITEMS` drops Settings, which the header already offers on every
 * screen, to make room for Referrals without a sixth target. See `nav-items.ts`.
 *
 * ## `prefetch={false}`, deliberately
 *
 * Every destination here is behind `requireApprovedVendor()`, which means a
 * prefetch is a full authenticated render — `GET /vendors/me` plus whatever the
 * page loads. Five of those firing as the bar enters the viewport is five
 * concurrent renders, and if the access token happens to be due for rotation,
 * several of them redirect to `/api/session/refresh` at once. A refresh token is
 * single use and the API treats a replay as theft, revoking **every** session for
 * the account. So the vendor gets signed out of every device because their nav
 * bar was being helpful. See the concurrency notes in `session.ts` and the
 * refresh route.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 md:hidden",
        "border-t border-divider bg-surface/95 backdrop-blur-sm",
        // The iOS home-bar inset. Without it the last few pixels of the row sit
        // under the system gesture area and the tap targets lose their bottom edge.
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="flex items-stretch justify-around">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          const Icon = item.icon;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                prefetch={false}
                // `page` rather than `true`: this is the current page, not merely
                // a selected control, and screen readers announce the two
                // differently.
                aria-current={active ? "page" : undefined}
                className={cn(
                  // 56px tall — comfortably past the 44px minimum tap target once
                  // the label is included.
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2",
                  "transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600",
                  active ? "text-brand-600" : "text-ink-subtle hover:text-ink-muted",
                )}
              >
                <Icon
                  className="size-5"
                  // Weight, not colour, carries the active state as well — the
                  // system has one accent and it is nearly black, so on a small
                  // icon the colour shift alone is close to invisible.
                  strokeWidth={active ? 2.25 : 1.75}
                  aria-hidden
                />
                <span className={cn("text-meta", active && "font-semibold")}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
