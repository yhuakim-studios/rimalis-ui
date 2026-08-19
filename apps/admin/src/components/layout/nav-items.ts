import {
  ClipboardList,
  FolderTree,
  LayoutDashboard,
  Package,
  Percent,
  ReceiptText,
  ShoppingBag,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The ten destinations, declared once and rendered by both navs.
 *
 * ## Why one list here where the vendor app needs two
 *
 * The vendor app keeps a separate `MOBILE_NAV_ITEMS`, because a bottom bar fits
 * five 44px targets across a 360px viewport and it has six destinations. That
 * arithmetic does not stretch to ten, so this app does not try: there is no bottom
 * bar. Below `md`, `TopNav` renders the SAME ten as a horizontally scrollable row
 * of pills — see the header of that file.
 *
 * One list, therefore one source of truth, and no possibility of a destination
 * that exists in one nav and not the other.
 *
 * ## The order is the workflow, not the API
 *
 * Dashboard first because it is where the queue lives. Then the two things an
 * admin acts on daily and in this order — Vendors (the approval queue) and Orders.
 * Then Products, which is the biggest screen but a considered, unhurried one.
 * Then the three read-only money surfaces: Stock purchases (what vendors paid us),
 * Payouts (what they are owed), Users. Then the two settings-shaped taxonomies,
 * Categories and Commission, which are edited rarely and deliberately. Activity
 * last, because it is what you open when something has already gone wrong.
 *
 * Grouping by REST resource instead would put Products next to Categories and
 * bury Vendors in the middle, which is exactly backwards: the approval queue is
 * the one thing with a person waiting at the other end of it.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /**
   * Matches `/orders` and `/orders/abc` but not `/orders-archive`.
   *
   * A plain `startsWith` would light up "Orders" on an unrelated sibling route,
   * and an exact match would unlight it as soon as an admin opened one order —
   * losing their place in the nav at the moment they most need to know where they
   * are. The dashboard is `exact` because `/` is a prefix of everything.
   */
  exact?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/vendors", label: "Vendors", icon: Store },
  { href: "/orders", label: "Orders", icon: ReceiptText },
  { href: "/products", label: "Products", icon: Package },
  { href: "/stock-purchases", label: "Stock purchases", icon: ShoppingBag },
  { href: "/payouts", label: "Payouts", icon: Wallet },
  { href: "/users", label: "Users", icon: Users },
  { href: "/categories", label: "Categories", icon: FolderTree },
  { href: "/commission-tiers", label: "Commission", icon: Percent },
  { href: "/activity", label: "Activity", icon: ClipboardList },
];

/** Whether `pathname` is inside `item`. See the note on `exact`. */
export function isActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
