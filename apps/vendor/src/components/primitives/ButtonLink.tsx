import type { ReactNode } from "react";
import Link from "next/link";
import { buttonClasses, buttonFocusInset, type ButtonSize, type ButtonVariant } from "./Button";

/**
 * A link that looks like a button.
 *
 * The correct markup for anything that **navigates**, which is most CTAs in a
 * storefront: "Browse the catalogue", "View store", "Continue shopping".
 *
 * The two wrong ways to do this, both common:
 *
 *   <Link href="..."><Button>…</Button></Link>
 *     An `<a>` wrapping a `<button>` is invalid HTML. Browsers disagree on
 *     whether the click navigates, focus order is odd, and it is announced twice.
 *
 *   <Button onClick={() => router.push("...")}>…</Button>
 *     Looks fine and breaks everything a link gives you for free: middle-click,
 *     cmd-click to open in a new tab, right-click → copy address, hover preview,
 *     and an `href` for a crawler to follow. A storefront that a search engine
 *     cannot crawl is a storefront nobody finds.
 *
 * It shares `buttonClasses` with `Button` so the two cannot drift.
 */

export interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** A 20px lucide icon before the label. */
  icon?: ReactNode;
  children: ReactNode;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  icon,
  children,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      data-focus-inset={buttonFocusInset(variant)}
      className={buttonClasses(variant, size, fullWidth)}
    >
      {icon}
      {children}
    </Link>
  );
}
