/**
 * The signed-in shell.
 *
 * `SideNav` and `TopNav` are the two halves of one navigation — exactly one is
 * mounted at any viewport (`hidden md:block` / `md:hidden`), so there is never a
 * duplicate landmark for a screen reader to announce. Both read the same
 * `NAV_ITEMS`, unlike the vendor app, which needs a second shorter list for its
 * bottom bar. See nav-items.ts.
 */

export { Header } from "./Header";
export { SideNav } from "./SideNav";
export { TopNav } from "./TopNav";
export { Container, Section } from "./Container";
export { NAV_ITEMS, isActive, type NavItem } from "./nav-items";
