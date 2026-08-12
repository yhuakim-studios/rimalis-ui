import Link from "next/link";
import { Store } from "lucide-react";
import type { VendorProfile } from "@rimalis/types";
import { Badge } from "@/components/primitives";
import { SignOutButton } from "@/components/SignOutButton";

/**
 * The app header: which store you are in, and the way out.
 *
 * ## What the reference design puts here, and what replaced it
 *
 * The design has a hamburger on the left and a camera on the right. Neither
 * survives contact with this app:
 *
 * - The **hamburger** opened a drawer duplicating the bottom nav. Two navigations
 *   to the same five places is one too many, and the drawer is the one nobody
 *   maintains. On desktop the sidebar is always visible, so there is nothing to
 *   toggle there either.
 * - The **camera** was a scan-to-add affordance. Adding a listing here means
 *   picking a product out of the *admin-managed pool* — a vendor cannot create a
 *   product, only carry one — so there is no barcode to scan and nothing a camera
 *   could resolve to.
 *
 * What a vendor actually needs at the top of every screen is confirmation of
 * whose store they are looking at, which matters more than it sounds: the seed
 * alone has five stores, and a support conversation starts with "which store".
 *
 * A Server Component. It takes the profile the layout already loaded rather than
 * fetching its own — one `GET /vendors/me` per render, not two.
 */
export function Header({ vendor }: { vendor: VendorProfile }) {
  return (
    <header className="sticky top-0 z-30 border-b border-divider bg-surface/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-3 md:px-8">
        <Link
          href="/"
          prefetch={false}
          className="flex min-w-0 items-center gap-2.5 rounded-input px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {/*
            The vendor's own logo when they have one, a monogram tile otherwise.
            `next/image` is not used: `unoptimized` is on for this app, so it would
            add a wrapper and a layout shift for no benefit over a plain <img> at
            a fixed 32px. See next.config.ts.
          */}
          {vendor.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- see above
            <img
              src={vendor.logoUrl}
              alt=""
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <span
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-white"
              aria-hidden
            >
              <Store className="size-4" strokeWidth={2} />
            </span>
          )}

          <span className="flex min-w-0 flex-col leading-tight">
            {/* `truncate` because a store name is vendor-supplied and unbounded
                at 120 characters, which would otherwise push the sign-out
                control off a 360px viewport. */}
            <span className="truncate text-caption font-semibold">{vendor.storeName}</span>
            <span className="text-meta text-ink-subtle">Rimalis for sellers</span>
          </span>
        </Link>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          {/*
            A payout warning in the chrome, because it is the one misconfiguration
            that is invisible where it hurts. Without a subaccount, checkout fails
            with 409 VENDOR_PAYOUT_NOT_CONFIGURED for every order containing this
            vendor's items — so the store looks live, listings look live, and
            nothing can be bought. There is no vendor-facing signal for that
            anywhere else, so it lives here on every screen until it is fixed.
          */}
          {vendor.paystackSubaccountCode === null && (
            <Link
              href="/settings"
              prefetch={false}
              className="rounded-pill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <Badge tone="danger">Add payout details</Badge>
            </Link>
          )}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
