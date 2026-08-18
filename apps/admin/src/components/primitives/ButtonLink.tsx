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
 *
 * ## ⚠️ THIS COPY DIVERGES FROM THE OTHER TWO APPS
 *
 * It takes a `prefetch` prop, and **it defaults to `false`**, where marketplace
 * and vendor have no such prop and therefore get Next's default of `true`.
 *
 * That default is right for a storefront: prefetching a public product page costs
 * a cached GET and makes the next navigation instant. It is wrong here. Every
 * destination in this app is gated, so a prefetch is a full authenticated render
 * that calls `requireAdmin()` — and several of them entering the viewport at once
 * means several concurrent chances to discover the same aged-out access token and
 * bounce to `/api/session/refresh`. The API treats a refresh token used twice as
 * STOLEN and revokes every session for the account, so the storefront's harmless
 * default can sign an admin out of everything.
 *
 * Opting in per call site was the alternative and it fails the wrong way: the one
 * link somebody forgets is indistinguishable from the rest in review, and the
 * symptom (an occasional unexplained sign-out) points nowhere near a missing prop.
 * Safe by default, loud to opt out of.
 *
 * See risk 4 in the plan, and the header of src/lib/auth.ts.
 */

export interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** A 20px lucide icon before the label. */
  icon?: ReactNode;
  /**
   * Defaults to `false` — see the header. Only pass `true` for a link to a page
   * that is genuinely cheap to render, and say why at the call site.
   */
  prefetch?: boolean;
  children: ReactNode;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  icon,
  prefetch = false,
  children,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      data-focus-inset={buttonFocusInset(variant)}
      className={buttonClasses(variant, size, fullWidth)}
    >
      {icon}
      {children}
    </Link>
  );
}
