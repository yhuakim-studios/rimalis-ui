"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, ImageOff, RotateCcw } from "lucide-react";
import type { CatalogueProduct } from "@rimalis/types";
import { createListing, type ListingState } from "@/lib/listing-actions";
import { FormBanner, SubmitButton } from "@/components/forms";
import { Badge, Button, Card, Input } from "@/components/primitives";
import { formatMoney } from "@/lib/money";
import { monogram } from "@/lib/format";

/**
 * One pool product, with the form that adds it to this store.
 *
 * ## The three states of `listing`, and why the button changes meaning
 *
 * `POST /vendor/products` does something different in each, so a single "Add"
 * button would be lying in two of the three:
 *
 * - **`null` — never listed.** The form creates a listing. Blank price and cap are
 *   the sensible defaults, meaning "follow the catalogue" and "no cap".
 * - **A live listing.** There is nothing to add; the endpoint answers 409
 *   `LISTING_EXISTS`. So no form at all — a link to the existing row instead,
 *   because "you already sell this" plus a way to get there is the answer, and a
 *   button that reliably conflicts is not.
 * - **A removed listing.** The endpoint **restores that row and overwrites its
 *   price and cap** with whatever this form sends. That is not a create, and
 *   calling it "Add" would hide the fact that leaving the price blank discards the
 *   override the vendor had before. The copy says "Put back" and warns about it.
 *
 * The API does not report which branch it took, so the warning has to be
 * pre-emptive rather than a confirmation after the fact.
 *
 * ## Collapsed by default, like the price editor
 *
 * A vendor scanning fifteen products for something to carry is not editing. Two
 * number inputs per row would bury the products under their own forms, so the
 * fields appear on demand. `useState` rather than `<details>`: the panel has to
 * close itself after a successful add, and a `<details>` cannot be told to.
 *
 * ## Why the pool stock is shown but never a "sellable" figure
 *
 * `product.stock` is shared across every vendor carrying it. Before a listing
 * exists there is no `stockCap`, so there is no per-vendor number to show — and
 * inventing one by assuming an uncapped listing would be a figure that changes the
 * moment somebody else sells. A cap above the pool does nothing, which is what the
 * cap field's hint says.
 */
export function CatalogueCard({ product }: { product: CatalogueProduct }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ListingState, FormData>(createListing, {});

  const image = product.images[0];
  const listing = product.listing;
  const removed = listing !== null && listing.deletedAt !== null;
  const live = listing !== null && listing.deletedAt === null;
  const outOfStock = product.stock === 0;

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
            {live && (
              <Badge tone="brand">
                {listing.isActive ? "In your store" : "In your store, switched off"}
              </Badge>
            )}
            {removed && <Badge tone="neutral">You removed this</Badge>}
            {/* The shared pool. Zero means nobody can sell it, whoever lists it —
                worth saying before a vendor spends effort adding it. */}
            {outOfStock && <Badge tone="danger">Out of stock</Badge>}
          </div>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-meta">
            <span className="text-ink-muted">
              Catalogue price{" "}
              <span className="font-semibold text-ink tabular-nums">
                {formatMoney(product.basePrice)}
              </span>
            </span>
            <span className="text-ink-subtle tabular-nums">{product.stock} in the shared pool</span>
          </div>

          {product.description && (
            <p className="line-clamp-2 text-meta text-ink-subtle">{product.description}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-divider px-4 py-3">
        {state.error && <FormBanner tone="error">{state.error}</FormBanner>}
        {state.message && <FormBanner tone="success">{state.message}</FormBanner>}

        {live ? (
          <div className="flex items-center gap-2 text-meta text-ink-muted">
            <Check className="size-4 shrink-0 text-brand-600" strokeWidth={2} aria-hidden />
            <span>Already in your store.</span>
            <Link
              href="/products"
              prefetch={false}
              className="font-semibold text-ink underline decoration-divider-strong underline-offset-4"
            >
              Edit its price
            </Link>
          </div>
        ) : !open ? (
          <div>
            <Button
              variant={removed ? "secondary" : "primary"}
              onClick={() => setOpen(true)}
              {...(removed
                ? { icon: <RotateCcw className="size-5" strokeWidth={1.75} aria-hidden /> }
                : {})}
            >
              {removed ? "Put back in my store" : "Add to my store"}
            </Button>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-3" noValidate>
            <input type="hidden" name="productId" value={product.id} />

            {removed && (
              <p className="text-meta text-ink-muted">
                You listed this before and removed it. Putting it back reuses that listing and{" "}
                <span className="font-semibold text-ink">
                  replaces its old price and stock cap with whatever you set here
                </span>{" "}
                — including clearing them if you leave these blank.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Your price (₦)"
                name="vendorPrice"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                placeholder={product.basePrice}
                hint="Leave empty to follow the catalogue price, and to keep following it when Rimalis changes it."
                error={state.fieldErrors?.["vendorPrice"]}
              />
              <Input
                label="Stock cap (units)"
                name="stockCap"
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                hint={`Leave empty for no cap. A cap above the ${String(product.stock)} in the pool has no effect.`}
                error={state.fieldErrors?.["stockCap"]}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SubmitButton>{removed ? "Put back in my store" : "Add to my store"}</SubmitButton>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>

            {/* Said once, at the point of decision: a new listing is immediately
                buyable. There is no draft state on VendorProduct — `isActive`
                defaults to true — so "add" and "publish" are the same click, and a
                vendor who expected a review step needs to know before they press it. */}
            <p className="text-meta text-ink-subtle">
              This goes on the marketplace straight away. You can switch it off from Products at
              any time.
            </p>
          </form>
        )}
      </div>
    </Card>
  );
}
