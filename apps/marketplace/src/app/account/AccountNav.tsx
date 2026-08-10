"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, MapPin, Package, User } from "lucide-react";
import { cn } from "@/components/primitives";

/**
 * The account sidebar.
 *
 * A Client Component because it needs `usePathname` to mark the current page —
 * which is the one thing a nav must do and the thing a server-rendered version
 * cannot, since the layout that holds it is not re-rendered per route.
 *
 * `aria-current="page"` carries the state, not the background colour. Colour
 * alone tells a screen-reader user nothing about where they are, and this is a
 * list where "where am I" is the whole question.
 *
 * `prefetch={false}` on every link here, and it is not a performance
 * micro-decision: a viewport prefetch of an account route is a second concurrent
 * render of a gated page, and a gated page whose token has aged out redirects
 * into the refresh route. Two of those at once is the one way to trip the API's
 * refresh-reuse detection, which signs the shopper out of every device. See the
 * route handler's header.
 */

const LINKS = [
  { href: "/account", label: "Profile", icon: User },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/wishlist", label: "Saved items", icon: Heart },
] as const;

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account" className="lg:sticky lg:top-40 lg:h-fit">
      <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {LINKS.map(({ href, label, icon: Icon }) => {
          // `/account` must not light up on `/account/orders`, so the root is an
          // exact match while the rest match their subtree — an order detail
          // page should still show "Orders" as current.
          const active = href === "/account" ? pathname === href : pathname.startsWith(href);

          return (
            <li key={href}>
              <Link
                href={href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-3 whitespace-nowrap rounded-input px-4 text-caption transition-colors duration-150 ease-out-soft lg:w-full",
                  active
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-ink-muted hover:bg-divider/60 hover:text-ink",
                )}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
