import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ImageOff, ShoppingBag } from "lucide-react";
import { Container } from "@/components/layout";
import { EmptyState, ErrorState } from "@/components/feedback";
import { Badge, ButtonLink, Card } from "@/components/primitives";
import { QuantityStepper, RemoveLineButton } from "@/components/cart";
import { loadCart, type CartLineView } from "@/lib/cart";
import { getSessionUser } from "@/lib/auth";

/**
 * The basket.
 *
 * ## Everything on this page is re-read from the API on every render
 *
 * The cookie holds ids and quantities. Names, images, prices, stock and every
 * "this line has a problem" verdict come from a fresh `getListing` per line —
 * see `lib/cart.ts`. That is what makes a price change or a sell-out visible
 * *here*, where it can be fixed by editing the basket, rather than at the moment
 * of payment, where it becomes a 409 the shopper has to decode.
 *
 * ## Problems block checkout, and the button says why
 *
 * A line that cannot be ordered — sold out, more units than remain, listing gone
 * — disables the checkout CTA rather than letting the shopper proceed into a
 * rejected `POST /orders`. The API would reject it anyway; the difference is
 * whether they find out before or after they have started paying attention to
 * card details.
 *
 * ## The subtotal is an estimate, and says so
 *
 * The API computes the real total when the order is written, from its own data.
 * Nothing on this page is sent as a price — `POST /orders` takes ids and
 * quantities only, deliberately. The line at the bottom of the summary says
 * "shipping calculated at checkout" because `shippingTotal` is an order field
 * that does not exist until the order does.
 */

export const metadata: Metadata = {
  title: "Your basket",
  robots: { index: false, follow: false },
};

/** Reads a cookie, so it could never be static — declared rather than inferred. */
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const [cart, user] = await Promise.all([loadCart(), getSessionUser()]);

  if (cart.error) {
    return (
      <Container className="py-8 md:py-12">
        <h1 className="pb-8 text-heading text-ink">Your basket</h1>
        {/*
          NOT an empty state. A shopper shown "your basket is empty" because the
          API was mid-deploy concludes their basket was lost — and the one thing
          they will not do is come back later to check. The cookie is untouched
          and the items are still there.
        */}
        <ErrorState error={cart.error} title="We couldn't load your basket" />
      </Container>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <Container className="py-8 md:py-12">
        <h1 className="pb-8 text-heading text-ink">Your basket</h1>
        <EmptyState
          icon={<ShoppingBag className="size-7" strokeWidth={1.5} />}
          title="Your basket is empty"
          body="Everything you add stays here on this device, whether or not you're signed in."
          action={{ label: "Browse the catalogue", href: "/products" }}
        />
      </Container>
    );
  }

  const checkoutHref = user ? "/checkout" : "/login?next=%2Fcheckout";

  return (
    <Container className="py-8 md:py-12">
      <div className="flex flex-col gap-2 pb-8">
        <h1 className="text-heading text-ink">Your basket</h1>
        <p className="text-body text-ink-muted">
          {cart.count} {cart.count === 1 ? "item" : "items"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px] lg:gap-12">
        <ul className="flex flex-col gap-4">
          {cart.lines.map((line) => (
            <CartLineRow key={line.listingId} line={line} />
          ))}
        </ul>

        {/* `lg:sticky` so the total and the CTA stay in view down a long basket.
            `top-40` clears the sticky header, which is two bars tall. */}
        <aside className="lg:sticky lg:top-40 lg:h-fit">
          <Card padding="lg" className="flex flex-col gap-6">
            <h2 className="text-section text-ink">Summary</h2>

            <dl className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-body text-ink-muted">Subtotal</dt>
                <dd className="text-section text-ink">{cart.subtotal}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-caption text-ink-muted">Delivery</dt>
                {/* Honest rather than "Free": shipping is an order-level figure
                    the API produces when the order is created, and promising
                    zero here would be a number we cannot keep. */}
                <dd className="text-caption text-ink-muted">Calculated at checkout</dd>
              </div>
            </dl>

            {cart.hasProblems ? (
              // No disabled "Checkout" button here, and no link to nowhere. A
              // disabled primary CTA is the shape a shopper scans for, and
              // finding it dead tells them nothing about why. The message names
              // the blocker; each line above names its own remedy.
              <p role="alert" className="text-caption text-danger">
                Some items need attention before you can check out — see the notes beside
                them.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <ButtonLink href={checkoutHref} size="lg" fullWidth>
                  {user ? "Checkout" : "Sign in to check out"}
                </ButtonLink>
                <p className="text-caption text-ink-muted">
                  Prices and availability are checked again when you place the order.
                </p>
              </div>
            )}

            <ButtonLink href="/products" variant="tertiary" fullWidth>
              Continue shopping
            </ButtonLink>
          </Card>
        </aside>
      </div>
    </Container>
  );
}

function CartLineRow({ line }: { line: CartLineView }) {
  const gone = line.problem?.kind === "gone";

  return (
    <Card as="li" tone="flat" padding="md">
      <div className="flex gap-4">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-input bg-canvas">
          {line.imageUrl ? (
            <Image
              src={line.imageUrl}
              alt={line.imageAlt}
              fill
              sizes="96px"
              className="object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center text-ink-subtle" aria-hidden>
              <ImageOff className="size-6" strokeWidth={1.5} />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              {gone ? (
                <p className="text-body font-medium text-ink">{line.name}</p>
              ) : (
                <Link
                  href={`/products/${line.listingId}`}
                  className="text-body font-medium text-ink hover:underline"
                >
                  {line.name}
                </Link>
              )}
              {line.storeName && (
                <p className="text-meta text-ink-muted">Sold by {line.storeName}</p>
              )}
            </div>

            <p className="text-body text-ink">{line.lineTotal}</p>
          </div>

          <LineProblem line={line} />

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
            {gone ? (
              <span className="text-caption text-ink-subtle">Quantity {line.quantity}</span>
            ) : (
              <QuantityStepper
                listingId={line.listingId}
                quantity={line.quantity}
                max={line.available}
                productName={line.name}
              />
            )}

            <div className="flex items-center gap-4">
              {!gone && (
                <span className="text-meta text-ink-muted">{line.unitPrice} each</span>
              )}
              <RemoveLineButton listingId={line.listingId} productName={line.name} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Why a line cannot be ordered, and what to do about it.
 *
 * Three problems, three different remedies — which is exactly why `cart.ts`
 * models them as a union rather than an `available: boolean`. "Unavailable" with
 * a single generic message would leave a shopper guessing whether to reduce the
 * quantity or give up on the item.
 */
function LineProblem({ line }: { line: CartLineView }) {
  if (line.problem === null) return null;

  if (line.problem.kind === "gone") {
    return (
      <p className="text-caption text-danger">
        This listing has been withdrawn. Remove it to continue.
      </p>
    );
  }

  if (line.problem.kind === "out_of_stock") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="danger">Out of stock</Badge>
        <span className="text-caption text-ink-muted">
          Remove it, or check another store for the same product.
        </span>
      </div>
    );
  }

  return (
    <p className="text-caption text-danger">
      Only {line.problem.available} left — reduce the quantity to continue.
    </p>
  );
}
