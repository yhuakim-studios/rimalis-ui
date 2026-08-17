import {
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The five destinations, declared once and rendered by both navs.
 *
 * ## Why these five and not the reference design's five
 *
 * The design shows Dashboard · Orders · Shipping · Products · Support. Two of
 * those have nothing behind them in this API and one is a different thing here:
 *
 * - **Shipping** — there is no shipping resource. Fulfilment is a per-line status
 *   on an order (`PATCH /vendor/orders/:id/items/:itemId`), so it belongs *inside*
 *   Orders, next to the line it advances. A separate tab would either duplicate
 *   the order list or show an empty page, and a nav item that leads nowhere is
 *   the worst kind of dead end — it reads as a broken feature rather than an
 *   absent one.
 * - **Support** — no tickets, no threads, no endpoint. The honest version is an
 *   email address, which lives in Settings rather than occupying a fifth of the
 *   bottom bar.
 * - **Payouts** replaces one of them, because `/vendor/payouts` is real, is a
 *   vendor's most-asked question, and had no home in the reference at all.
 *
 * Settings is the fifth: it holds the storefront profile and — much more
 * importantly — the Paystack payout details, without which every checkout
 * containing this vendor's items fails.
 *
 * ## Referrals is the sixth, and only on desktop
 *
 * `/vendor/referrals` is real, and a commission ladder nobody can find is a
 * commission ladder nobody recruits for. But the note above still holds: the
 * bottom bar fits five 44px targets across a 360px viewport, and six is where
 * labels start truncating.
 *
 * So the two navs diverge, which is why there are two lists below. The side nav
 * takes all six — it is a vertical column with room to spare. The bottom bar
 * drops **Settings**, because it is the one destination already reachable from the
 * header on every screen, so removing it costs a mobile vendor nothing. Dropping
 * Payouts or Products instead would strand a destination with no other route to
 * it.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /**
   * Matches `/orders` and `/orders/abc` but not `/orders-archive`.
   *
   * A plain `startsWith` would light up "Orders" on an unrelated sibling route,
   * and an exact match would unlight it as soon as a vendor opened one order —
   * losing their place in the nav at the moment they most need to know where
   * they are. The dashboard is `exact` because `/` is a prefix of everything.
   */
  exact?: boolean;
}

/** The desktop `SideNav`. All six destinations. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/orders", label: "Orders", icon: ReceiptText },
  { href: "/products", label: "Products", icon: Package },
  { href: "/payouts", label: "Payouts", icon: Wallet },
  { href: "/referrals", label: "Referrals", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * The mobile `BottomNav`. Five, with Settings dropped — see the note above.
 *
 * Derived from `NAV_ITEMS` rather than written out again, so a destination added
 * to one list cannot silently miss the other. The filter names what is excluded,
 * which is the part worth reading in a diff.
 */
export const MOBILE_NAV_ITEMS: readonly NavItem[] = NAV_ITEMS.filter(
  (item) => item.href !== "/settings",
);

/** Whether `pathname` is inside `item`. See the note on `exact`. */
export function isActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
