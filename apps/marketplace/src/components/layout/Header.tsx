import { Suspense } from "react";
import Link from "next/link";
import { Headphones, Heart, ShoppingBag, ShoppingCart, User } from "lucide-react";
import { Container } from "./Container";
import { SearchBox } from "./SearchBox";
import { getSessionUser } from "@/lib/auth";
import { vendorOrigin } from "@/lib/env";
import { cartCount, readCart } from "@/lib/cart";
import { readWishlist } from "@/lib/wishlist";

/**
 * The site header.
 *
 * ## An async Server Component, and what that costs
 *
 * The basket badge, the saved-items badge and the account link all come from
 * cookies read during the render — so the count in the first byte of HTML is the
 * real one. The version this replaced held them in `useState` with hardcoded
 * values, which is fine for a scaffold and a lie once there is a real basket.
 *
 * The cost is honest: reading cookies makes **every route dynamic**, because the
 * header is in the root layout. That is already true of every page here (they
 * all call the API uncached), and Phase 8's R2 cache work is where it becomes a
 * question. If a route ever needs to be static, the badges move into a Suspense
 * boundary of their own rather than the header losing them.
 *
 * ## Only real destinations
 *
 * The scaffold linked to `/compare`, `/brands`, `/inspiration`, `/faq`,
 * `/shipping` and `/support`, none of which exist. A header full of 404s is
 * worse than a shorter header: it teaches shoppers that links here do not work,
 * and it is exactly the kind of thing that survives to launch because nobody
 * clicks their own nav. Every link below resolves.
 */

function SearchBoxFallback() {
  return (
    <div
      aria-hidden
      className="h-12 w-full rounded-pill border border-divider-strong bg-surface"
    />
  );
}

export async function Header() {
  // In parallel: three cookie reads that do not depend on each other.
  const [user, cart, saved] = await Promise.all([
    getSessionUser(),
    readCart(),
    readWishlist(),
  ]);

  const basketCount = cartCount(cart);

  return (
    <header className="sticky top-0 z-30 border-b border-divider bg-surface shadow-sm">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-button focus:bg-ink focus:px-4 focus:py-2 focus:text-caption focus:text-white"
      >
        Skip to content
      </a>

      <div className="border-b border-divider/60 py-3.5">
        <Container width="shell" className="flex items-center justify-between gap-4 md:gap-8">
          <Link href="/" className="group flex shrink-0 items-center gap-3" aria-label="Rimalis home">
            <div className="grid size-11 place-items-center rounded-2xl bg-ink text-white shadow-sm transition-transform duration-200 group-hover:scale-105">
              <ShoppingBag className="size-6" strokeWidth={2} />
            </div>
            <div className="flex flex-col">
              <span className="font-sans text-xl font-extrabold uppercase tracking-tight text-ink">
                {/* Written in mixed case and uppercased by CSS, so a screen
                    reader says "Rimalis" rather than spelling it out. */}
                Rimalis
              </span>
              <span className="-mt-1 text-[11px] font-medium tracking-tight text-ink-muted">
                Live Better. Every Day.
              </span>
            </div>
          </Link>

          <div className="hidden min-w-0 max-w-2xl flex-1 md:block">
            <Suspense fallback={<SearchBoxFallback />}>
              <SearchBox size="lg" />
            </Suspense>
          </div>

          <div className="flex items-center gap-6 sm:gap-8">
            <HeaderLink
              href={user ? "/account" : "/login"}
              label={user ? "Account" : "Sign in"}
              icon={<User className="size-5" strokeWidth={1.75} />}
            />

            <HeaderLink
              href="/wishlist"
              label="Saved"
              icon={<Heart className="size-5" strokeWidth={1.75} />}
              count={saved.length}
            />

            <HeaderLink
              href="/cart"
              label="Basket"
              icon={<ShoppingCart className="size-5" strokeWidth={1.75} />}
              count={basketCount}
            />
          </div>
        </Container>
      </div>

      <div className="hidden border-b border-divider/40 bg-surface py-2.5 md:block">
        <Container width="shell" className="flex items-center justify-between">
          <nav className="flex items-center gap-7" aria-label="Main">
            <NavLink href="/products">All products</NavLink>
            <NavLink href="/products?sort=price_asc">Best prices</NavLink>
            <NavLink href="/stores">Stores</NavLink>
            {user && <NavLink href="/account/orders">Your orders</NavLink>}
          </nav>

          <div className="flex items-center gap-2 text-caption font-medium text-ink">
            <Headphones className="size-4 text-ink" strokeWidth={1.75} aria-hidden />
            <span>
              Support: <strong className="font-semibold text-ink">(123) 456-7890</strong>
            </span>
          </div>
        </Container>
      </div>

      <Container width="shell" className="py-2.5 md:hidden">
        <Suspense fallback={<SearchBoxFallback />}>
          <SearchBox size="md" />
        </Suspense>
      </Container>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-caption font-semibold text-ink transition-colors hover:text-brand-600"
    >
      {children}
    </Link>
  );
}

/**
 * One of the three icon links on the right.
 *
 * The badge is `aria-hidden` and the count is folded into the link's accessible
 * name instead — "Basket, 3 items" rather than "Basket" followed by a stray "3"
 * that a screen reader reads as unrelated text.
 */
function HeaderLink({
  href,
  label,
  icon,
  count,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
}) {
  const showCount = count !== undefined && count > 0;

  return (
    <Link
      href={href}
      // Gated destinations are not prefetched: a viewport prefetch of an account
      // route is a second concurrent render of a page that may trigger a token
      // refresh, and two refreshes at once is what trips the API's theft
      // detection. See app/api/session/refresh/route.ts.
      prefetch={false}
      aria-label={showCount ? `${label}, ${count} ${count === 1 ? "item" : "items"}` : label}
      className="group flex flex-col items-center gap-1 text-ink transition-colors duration-150 hover:text-brand-600"
    >
      <span className="relative">
        <span className="block transition-transform duration-150 group-hover:scale-110">
          {icon}
        </span>
        {showCount && (
          <span
            aria-hidden
            className="absolute -right-2.5 -top-2 grid min-w-4.5 place-items-center rounded-full bg-ink px-1 text-[10px] font-bold text-white shadow-xs"
          >
            {/* Two digits is the honest ceiling for a 18px circle. The cart caps
                lines at 50 and units at 99, so "99+" is reachable. */}
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
      <span className="text-[12px] font-medium leading-none text-ink">{label}</span>
    </Link>
  );
}

/**
 * The footer, and the only place the storefront mentions that you can SELL here.
 *
 * Before this, nothing on the marketplace linked to the vendor app at all: the
 * apply flow existed, was complete, and was reachable only by knowing the vendor
 * app's URL. Every seller had to arrive by word of mouth.
 *
 * A plain `<a>`, not `next/link`: the vendor dashboard is a separate deployment on
 * its own origin, so there is no route to prefetch and `<Link>` would only add
 * client-side machinery to a full page load. `rel="noreferrer"` is omitted on
 * purpose — it is the same platform, and the referrer is useful to it.
 *
 * The whole column disappears when `VENDOR_ORIGIN` is unset rather than rendering
 * a dead link or throwing. See `vendorOrigin()` for why absence must not 500 a
 * page that every route renders.
 */
export function Footer() {
  const vendorHref = vendorOrigin();

  return (
    <footer className="mt-auto border-t border-divider bg-surface">
      <Container width="shell" className="py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="flex flex-col gap-4 md:col-span-2">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-ink text-white">
                <ShoppingBag className="size-5" strokeWidth={2} />
              </div>
              <span className="text-lg font-bold uppercase tracking-tight text-ink">Rimalis</span>
            </div>
            <p className="max-w-sm text-caption text-ink-muted">
              Live Better. Every Day. Nigeria&rsquo;s multi-vendor marketplace for
              electronics, audio and computing — one basket across every store.
            </p>
            <p className="text-meta text-ink-subtle">
              © {new Date().getFullYear()} Rimalis Inc. All rights reserved.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-caption font-semibold uppercase tracking-wider text-ink">Shop</h2>
            <FooterLink href="/products">All products</FooterLink>
            <FooterLink href="/products?sort=price_asc">Lowest prices</FooterLink>
            <FooterLink href="/products?sort=price_desc">Premium picks</FooterLink>
            <FooterLink href="/stores">Stores</FooterLink>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-caption font-semibold uppercase tracking-wider text-ink">
              Your account
            </h2>
            <FooterLink href="/account">Profile</FooterLink>
            <FooterLink href="/account/orders">Orders</FooterLink>
            <FooterLink href="/account/addresses">Addresses</FooterLink>
            <FooterLink href="/wishlist">Saved items</FooterLink>

            {vendorHref !== undefined && (
              <>
                <h2 className="mt-5 text-caption font-semibold uppercase tracking-wider text-ink">
                  Sell
                </h2>
                <a
                  href={`${vendorHref}/apply`}
                  className="text-caption text-ink-muted hover:text-ink"
                >
                  Sell on Rimalis
                </a>
                <a
                  href={vendorHref}
                  className="text-caption text-ink-muted hover:text-ink"
                >
                  Seller sign in
                </a>
              </>
            )}
          </div>
        </div>
      </Container>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} prefetch={false} className="text-caption text-ink-muted hover:text-ink">
      {children}
    </Link>
  );
}
