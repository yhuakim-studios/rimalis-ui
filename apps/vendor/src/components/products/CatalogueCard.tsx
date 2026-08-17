"use client";

import { useActionState, useState } from "react";
import { ImageOff, ShoppingCart } from "lucide-react";
import type { CatalogueProduct } from "@rimalis/types";
import { buyStock, type ListingState } from "@/lib/listing-actions";
import { FormBanner, SubmitButton } from "@/components/forms";
import { Badge, Button, Card, Input } from "@/components/primitives";
import { formatMoney, formatNaira, multiply, parseMoney, subtract } from "@/lib/money";
import { monogram, pluralise } from "@/lib/format";

/**
 * One pool product, with the form that buys stock of it.
 *
 * ## The vendor is spending real money on this screen
 *
 * This is not "add to my store" any more. Pressing the button charges the vendor
 * `quantity × costPrice` and sends them to Paystack. That reframes the whole
 * component: the running total has to be visible before they commit, the margin has
 * to be stated so the decision is informed, and the copy has to be unambiguous that
 * money moves.
 *
 * ## Why the total is computed here rather than after submitting
 *
 * A vendor typing `50` against a ₦106,000 product is about to spend ₦5.3m. Showing
 * that only on the Paystack page — after the redirect, in someone else's UI — is how
 * a misplaced zero becomes a real charge. `multiply` is display-only arithmetic on
 * branded kobo (see lib/money.ts); the number actually charged is recomputed
 * server-side from the same cost price, so this can never disagree with the invoice
 * in a way that favours us.
 *
 * ## `listing` is context, not a branch in behaviour
 *
 * Buying always does the same thing — open a listing or top one up — so unlike the
 * old add flow there is no state where the button means something different. What
 * changes is the copy, and the state that matters most is the one that reads as
 * absence:
 *
 * - **`null`** — never carried. "Buy stock".
 * - **`ownedStock > 0`** — carried, with units left. "Buy more".
 * - **`ownedStock === 0`** — **sold out.** The vendor HAS this listing and sold
 *   through it. Rendering that identically to "never carried" hides the fact that
 *   they had stock and it ran out, which is the one thing they need to know.
 * - **`deletedAt`** — removed. Buying revives the same row.
 *
 * ## Two stock numbers, and they are not interchangeable
 *
 * `product.stock` is the platform's unsold pool — the ceiling on how many the vendor
 * can buy right now. `listing.ownedStock` is what they already hold. Conflating them
 * is how a vendor concludes they have 40 units when 40 is what Rimalis has left.
 */
export function CatalogueCard({ product }: { product: CatalogueProduct }) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [state, formAction] = useActionState<ListingState, FormData>(buyStock, {});

  const image = product.images[0];
  const listing = product.listing;
  const removed = listing !== null && listing.deletedAt !== null;
  const carried = listing !== null && listing.deletedAt === null;
  const soldOut = carried && listing.ownedStock === 0;
  const poolEmpty = product.stock === 0;

  const unitCost = parseMoney(product.costPrice);
  const unitMargin = subtract(parseMoney(product.retailPrice), unitCost);

  // Number() on a non-numeric string is NaN, which would render "₦NaN". Guard to 0
  // and let the server-side validation own the actual error message.
  const typed = Number(quantity);
  const units = Number.isFinite(typed) && typed > 0 ? Math.floor(typed) : 0;
  const totalCost = multiply(unitCost, units);
  const totalMargin = multiply(unitMargin, units);

  return (
    <Card as="li" padding="none" tone="flat">
      <div className="flex gap-3 p-4">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- `unoptimized` is on
          // for this app, so next/image buys nothing at a fixed 56px. See
          // next.config.ts and the same note in ListingCard.
          <img
            src={image.url}
            alt=""
            width={56}
            height={56}
            className="size-14 shrink-0 rounded-input bg-canvas object-cover"
          />
        ) : (
          <span
            className="grid size-14 shrink-0 place-items-center rounded-input bg-canvas text-caption font-semibold text-ink-muted"
            aria-hidden
          >
            {product.name ? monogram(product.name) : <ImageOff className="size-5" strokeWidth={1.5} />}
          </span>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-caption font-semibold">{product.name}</p>
            <p className="truncate text-meta text-ink-subtle tabular-nums">
              {product.sku}
              {product.category && ` · ${product.category.name}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Sold out is checked first: it is the state most easily mistaken for
                "not carried", and it must never be silently absent. */}
            {soldOut ? (
              <Badge tone="danger">Sold out — you have 0 left</Badge>
            ) : carried ? (
              <Badge tone="brand">
                {listing.isActive
                  ? `In your store · ${String(listing.ownedStock)} left`
                  : `Switched off · ${String(listing.ownedStock)} left`}
              </Badge>
            ) : null}
            {removed && <Badge tone="neutral">You removed this</Badge>}
            {poolEmpty && <Badge tone="danger">Rimalis is out of stock</Badge>}
          </div>

          {/* The two prices side by side, because the gap between them is the
              decision. A vendor cannot judge a ₦106,000 cost without knowing what
              it sells for. */}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-meta">
            <span className="text-ink-muted">
              You pay{" "}
              <span className="font-semibold text-ink tabular-nums">
                {formatMoney(product.costPrice)}
              </span>
            </span>
            <span className="text-ink-muted">
              Sells for{" "}
              <span className="font-semibold text-ink tabular-nums">
                {formatMoney(product.retailPrice)}
              </span>
            </span>
            <span className="text-ink-subtle tabular-nums">
              {formatNaira(unitMargin)} margin each
            </span>
          </div>

          <p className="text-meta text-ink-subtle tabular-nums">
            {pluralise(product.stock, "unit")} available from Rimalis
          </p>

          {product.description && (
            <p className="line-clamp-2 text-meta text-ink-subtle">{product.description}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-divider px-4 py-3">
        {state.error && <FormBanner tone="error">{state.error}</FormBanner>}

        {poolEmpty ? (
          <p className="text-meta text-ink-muted">
            Rimalis has none of these left to sell you. This will become buyable again when
            they restock.
          </p>
        ) : !open ? (
          <div>
            <Button
              variant={carried ? "secondary" : "primary"}
              onClick={() => setOpen(true)}
              icon={<ShoppingCart className="size-5" strokeWidth={1.75} aria-hidden />}
            >
              {soldOut ? "Buy more stock" : carried ? "Buy more" : "Buy stock"}
            </Button>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-3" noValidate>
            <input type="hidden" name="productId" value={product.id} />

            {removed && (
              <p className="text-meta text-ink-muted">
                You carried this before and removed it. Buying stock puts that same listing
                back, with the units you buy now.
              </p>
            )}

            <Input
              label="How many units?"
              name="quantity"
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              max={String(product.stock)}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              hint={`Rimalis has ${String(product.stock)} available.`}
              error={state.fieldErrors?.["quantity"]}
            />

            {/* The number they are about to be charged, at the size that decision
                deserves. Shown before the button, not after the redirect. */}
            <div className="flex flex-col gap-1 rounded-input bg-canvas px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-meta text-ink-muted">You pay now</span>
                <span className="text-caption font-semibold tabular-nums">
                  {formatNaira(totalCost)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-meta text-ink-subtle">
                  Your margin if all {pluralise(units, "unit")} sell
                </span>
                <span className="text-meta text-ink-muted tabular-nums">
                  {formatNaira(totalMargin)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SubmitButton>Pay {formatNaira(totalCost)}</SubmitButton>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>

            {/* Said once, at the point of decision. Two things a vendor cannot
                discover afterwards: that they are leaving the app to pay, and that
                the stock is theirs once they have. */}
            <p className="text-meta text-ink-subtle">
              You&apos;ll be taken to Paystack to pay. Once it clears, these units are yours to
              sell and the listing goes live — commission comes out of your margin, not out of
              what you paid.
            </p>
          </form>
        )}
      </div>
    </Card>
  );
}
