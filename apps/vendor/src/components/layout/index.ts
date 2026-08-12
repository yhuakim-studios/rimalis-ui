/**
 * Layout components.
 *
 * `Header` is a Server Component (it renders data the layout already has);
 * `BottomNav` and `SideNav` are Client Components because active state comes from
 * `usePathname()`. That split is why they are three files rather than one shell.
 */

export { Container } from "./Container";
export { Header } from "./Header";
export { BottomNav } from "./BottomNav";
export { SideNav } from "./SideNav";
export { NAV_ITEMS, isActive, type NavItem } from "./nav-items";
