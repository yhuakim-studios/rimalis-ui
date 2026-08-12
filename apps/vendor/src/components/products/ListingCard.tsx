import { AlertTriangle, ImageOff, RotateCcw } from "lucide-react";
import type { VendorListing } from "@rimalis/types";
import { removeListing, restoreListing, setListingActive } from "@/lib/listing-actions";
import { Badge, Card } from "@/components/primitives";
import { formatMoney } from "@/lib/money";
import { monogram } from "@/lib/format";
import { PriceEditor } from "./PriceEditor";

/**
 * One listing, with everything a vendor can change about it.
 *
 * ## The three prices, and why all three are shown
 *
 * - `product.basePrice` — the catalogue price an admin set.
 * - `vendorPrice` — this vendor's override. **`null` is normal**, and means "follow
 *   the catalogue"; it is not missing data.
 * - `effectivePrice` — what a shopper is charged. Derived by the API as
 *   `vendorPrice ?? basePrice` and guarded by a database trigger, so it is read-only.
 *
 * Showing only the effective price would make "inheriting ₦280,000" and "overridden
 * to ₦280,000" look identical, and they are not: one tracks future catalogue changes
 * and the other does not. So the card names which is in force.
 *
 * ## Availability is a minimum, not a count
 *
 * `stockCap` is a per-vendor ceiling, not inventory. What a vendor can actually sell
 * is `min(stockCap ?? ∞, product.stock)` — because `product.stock` is the shared pool
 * every vendor draws from. A cap above the pool is legal and does nothing, so this
 * says so rather than showing a number the vendor cannot reach.
 *
 * ## Why removal and restore are plain forms with no confirmation dialog
 *
 * `DELETE` here is a **soft** delete: it sets `deletedAt`, hides the listing from the
 * marketplace, and is undone by one click. A confirmation modal for a reversible
 * action trains people to dismiss confirmations, which is what you do not want when
 * an irreversible one eventually appears. The button says "Remove", the row stays
 * visible under the Removed filter, and Restore is right there.
 */
export function ListingCard({ listing }: { listing: VendorListing }) {
  const { product } = listing;
  const removed = listing.deletedAt !== null;
  const image = product.images[0];

  const inherited = listing.vendorPrice === null;
  const poolStock = product.stock;
  const sellable = listing.stockCap === null ? poolStock : Math.min(listing.stockCap, poolStock);
  const capAbovePool = listing.stockCap !== null && listing.stockCap > poolStock;

  return (
    <Card
      as="li"
      padding="none"
      tone="flat"
      // A removed listing is dimmed rather than hidden or restyled: it must still be
      // readable — a vendor restoring something needs to confirm it is the right one.
      className={removed ? "opacity-60" : undefined}
    >
      <div className="flex gap-3 p-4">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- `unoptimized` is on
          // for this app, so next/image would add a wrapper and a layout shift for
          // nothing at a fixed 56px. See next.config.ts.
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
            {removed ? (
              <Badge tone="danger">Removed</Badge>
            ) : listing.isActive ? (
              <Badge tone="brand">Live</Badge>
            ) : (
              <Badge tone="neutral">Switched off</Badge>
            )}

            {/* The pool, not this vendor's stock. Zero here means nobody can sell it,
                which is not the vendor's fault and not theirs to fix. */}
            {poolStock === 0 && <Badge tone="danger">Out of stock</Badge>}

            {inherited && <Badge tone="neutral">Catalogue price</Badge>}
          </div>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-meta">
            <span className="text-ink-muted">
              Shoppers pay{" "}
              <span className="font-semibold text-ink tabular-nums">
                {formatMoney(listing.effectivePrice)}
              </span>
            </span>
            {!inherited && (
              <span className="text-ink-subtle tabular-nums">
                catalogue {formatMoney(product.basePrice)}
              </span>
            )}
            <span className="text-ink-subtle tabular-nums">
              {sellable} sellable
              {listing.stockCap !== null && ` (cap ${String(listing.stockCap)})`}
            </span>
          </div>

          {capAbovePool && (
            <p className="flex items-start gap-1.5 text-meta text-ink-subtle">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" strokeWidth={1.75} aria-hidden />
              Your cap is above the {poolStock} in the shared pool, so it has no effect right now.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-divider px-4 py-3">
        {removed ? (
          <form action={restoreListing}>
            <input type="hidden" name="listingId" value={listing.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-input border border-divider-strong px-3 py-2 text-meta font-medium transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden />
              Restore
            </button>
          </form>
        ) : (
          <>
            <PriceEditor listing={listing} />

            {/*
              A one-field form, not part of the price editor. Routing the toggle
              through the full editor would submit the price inputs too, and an
              untouched empty price field is the `null` that CLEARS an override —
              see the header of listing-actions.ts.
            */}
            <form action={setListingActive}>
              <input type="hidden" name="listingId" value={listing.id} />
              <input type="hidden" name="isActive" value={listing.isActive ? "false" : "true"} />
              <button
                type="submit"
                className="rounded-input border border-divider-strong px-3 py-2 text-meta font-medium transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                {listing.isActive ? "Switch off" : "Switch on"}
              </button>
            </form>

            <form action={removeListing} className="ml-auto">
              <input type="hidden" name="listingId" value={listing.id} />
              <button
                type="submit"
                className="rounded-input px-3 py-2 text-meta font-medium text-danger transition-colors hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
              >
                Remove
              </button>
            </form>
          </>
        )}
      </div>
    </Card>
  );
}
