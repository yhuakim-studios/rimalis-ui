import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheck, MapPin, ShoppingBag } from "lucide-react";
import { Container } from "@/components/layout";
import { EmptyState, ErrorState } from "@/components/feedback";
import { Card } from "@/components/primitives";
import { account, ctxFor, requireSession } from "@/lib/auth";
import { loadCart } from "@/lib/cart";
import { AddressForm } from "@/app/account/addresses/AddressForm";
import { ResendVerificationForm } from "@/app/(auth)/verify-email/ResendVerificationForm";
import { CheckoutForm } from "./CheckoutForm";

/**
 * Checkout.
 *
 * ## Three gates, in the order a shopper hits them
 *
 *   1. **Signed in.** `requireSession()` bounces to `/login?next=/checkout`.
 *   2. **Email verified.** `POST /orders` answers 403 `EMAIL_NOT_VERIFIED`, so
 *      this page checks first and renders a resend form instead of letting
 *      someone fill in a delivery address and then be told no.
 *   3. **An address exists.** The order needs an `addressId`; a shopper with no
 *      saved address gets the address form inline rather than being sent to the
 *      account section and left to find their way back.
 *
 * The verification check costs a `GET /users/me` on every checkout render, and
 * that is the point: `isVerified` is deliberately NOT stored in the session
 * cookie, because a cookie minted before someone clicked the link in their email
 * would say `false` for a week.
 *
 * ## The basket is re-read here AND again inside the action
 *
 * Twice, on purpose. This render shows the shopper what they are buying; the
 * action re-reads because time passes between reading a page and pressing a
 * button, and the second read is the one that decides. Neither is the
 * authority — `POST /orders` is — but re-reading is what turns a 409 into a
 * sentence about a specific product.
 */

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const session = await requireSession("/checkout");
  const ctx = ctxFor(session);

  const [cart, profile, addresses] = await Promise.all([
    loadCart(),
    account.getProfile(ctx),
    account.listAddresses(ctx),
  ]);

  if (cart.error) {
    return (
      <Shell>
        <ErrorState error={cart.error} title="We couldn't load your basket" />
      </Shell>
    );
  }

  // An empty basket at checkout is not an error and not a 404 — it is what
  // happens after a successful order, when someone presses back.
  if (cart.lines.length === 0) {
    return (
      <Shell>
        <EmptyState
          icon={<ShoppingBag className="size-7" strokeWidth={1.5} />}
          title="There's nothing to check out"
          body="Your basket is empty. If you just placed an order, it's in your account."
          action={{ label: "Browse the catalogue", href: "/products" }}
        />
      </Shell>
    );
  }

  // A basket that changed since the cart page was rendered. Sending them back is
  // better than showing a total here that the API will not honour.
  if (cart.hasProblems) redirect("/cart");

  if (!profile.ok) {
    return (
      <Shell>
        <ErrorState error={profile.error} title="We couldn't load your account" />
      </Shell>
    );
  }

  if (!profile.data.isVerified) {
    return (
      <Shell>
        <div className="mx-auto flex max-w-md flex-col items-center gap-6 text-center">
          <div className="grid size-16 place-items-center rounded-pill bg-canvas text-ink-subtle" aria-hidden>
            <MailCheck className="size-7" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-section text-ink">Confirm your email first</h2>
            <p className="text-body text-ink-muted">
              We sent a link to <strong className="text-ink">{profile.data.email}</strong>.
              Opening it is the last step before you can order — your basket is safe in the
              meantime.
            </p>
          </div>
          <div className="w-full text-left">
            <ResendVerificationForm defaultEmail={profile.data.email} />
          </div>
        </div>
      </Shell>
    );
  }

  if (!addresses.ok) {
    return (
      <Shell>
        <ErrorState error={addresses.error} title="We couldn't load your addresses" />
      </Shell>
    );
  }

  if (addresses.data.length === 0) {
    return (
      <Shell>
        <div className="mx-auto flex max-w-lg flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <MapPin className="size-5 text-ink-muted" strokeWidth={1.75} aria-hidden />
              <h2 className="text-section text-ink">Where should this go?</h2>
            </div>
            <p className="text-body text-ink-muted">
              Add a delivery address to finish your order. You can save more later.
            </p>
          </div>
          {/* The same form the account section uses. One implementation means the
              validation rules and the country-code trap cannot diverge between
              the two places an address gets typed. */}
          <AddressForm />
        </div>
      </Shell>
    );
  }

  const defaultAddress =
    addresses.data.find((address) => address.isDefault) ?? addresses.data[0];

  return (
    <Container className="py-8 md:py-12">
      <div className="flex flex-col gap-2 pb-8">
        <h1 className="text-heading text-ink">Checkout</h1>
        <p className="text-body text-ink-muted">
          Signed in as {session.user.email}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px] lg:gap-12">
        <CheckoutForm
          addresses={addresses.data}
          defaultAddressId={defaultAddress?.id ?? ""}
        />

        <aside className="lg:sticky lg:top-40 lg:h-fit">
          <Card padding="lg" className="flex flex-col gap-6">
            <h2 className="text-section text-ink">Your order</h2>

            <ul className="flex flex-col gap-4">
              {cart.lines.map((line) => (
                <li key={line.listingId} className="flex justify-between gap-4">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-caption text-ink">{line.name}</span>
                    <span className="text-meta text-ink-muted">
                      {line.quantity} × {line.unitPrice} · {line.storeName}
                    </span>
                  </div>
                  <span className="shrink-0 text-caption text-ink">{line.lineTotal}</span>
                </li>
              ))}
            </ul>

            <dl className="flex flex-col gap-3 border-t border-divider pt-4">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-body text-ink-muted">Subtotal</dt>
                <dd className="text-section text-ink">{cart.subtotal}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-caption text-ink-muted">Delivery</dt>
                {/* Still not a number: `shippingTotal` is computed when the
                    order is written. The final figure is on the Paystack page
                    and on the order, both of which come from the API. */}
                <dd className="text-caption text-ink-muted">Added at payment</dd>
              </div>
            </dl>

            <Link
              href="/cart"
              className="text-caption font-medium text-ink underline underline-offset-4"
            >
              Edit basket
            </Link>
          </Card>
        </aside>
      </div>
    </Container>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Container className="py-8 md:py-12">
      <h1 className="pb-8 text-heading text-ink">Checkout</h1>
      {children}
    </Container>
  );
}
