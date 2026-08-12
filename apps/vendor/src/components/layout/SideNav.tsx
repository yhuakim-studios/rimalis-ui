"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/primitives";
import { NAV_ITEMS, isActive } from "./nav-items";

/**
 * The desktop sidebar. Hidden below `md`, where `BottomNav` takes over.
 *
 * Same list, same `prefetch={false}` reasoning as `BottomNav` — read the note
 * there before removing it. The two are separate components rather than one
 * responsive component because the markup genuinely differs: a bottom bar is a
 * horizontal row of icon-over-label targets, a sidebar is a vertical list of
 * icon-beside-label rows. Forcing both out of one tree produces a knot of
 * `flex-col md:flex-row` overrides that is harder to read than two small files.
 */
export function SideNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-input px-3 py-2.5 text-caption transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                  active
                    ? // A tint, not a fill. A filled row would be a second primary
                      // emphasis competing with whatever action the page itself is
                      // offering, and the nav is never the point of the screen.
                      "bg-brand-50 font-semibold text-brand-700"
                    : "text-ink-muted hover:bg-canvas hover:text-ink",
                )}
              >
                <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
