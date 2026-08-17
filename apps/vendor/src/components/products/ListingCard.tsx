import { ImageOff, RotateCcw, ShoppingCart } from "lucide-react";
import Link from "next/link";
import type { VendorListing } from "@rimalis/types";
import { removeListing, restoreListing, setListingActive } from "@/lib/listing-actions";
import { Badge, Card } from "@/components/primitives";
import { formatMoney, formatNaira, parseMoney, subtract } from "@/lib/money";
import { monogram, pluralise } from "@/lib/format";

/**
 * One listing, with everything a vendor can change about it.
 *
 * ## One price, and it is not the vendor's
 *
 * `product.retailPrice` is what shoppers pay, set by an admin and identical across
 * every vendor. `product.costPrice` is what this vendor paid per unit. The gap is
 * their margin, and commission comes out of it — so the card shows the margin rather
 * than making them subtract two numbers to find out whether the listing is worth
 * keeping. There is no price editor because there is nothing to edit.
 *
 * ## `ownedStock` is inventory, and `0` is the state that matters
 *
 * Real units this vendor paid for, not a ceiling over a shared pool. At zero the
 * listing is SOLD OUT, not delisted — the row is intact, the vendor sold through it,
 * and buying another batch tops up the same listing. That distinction gets the
 * loudest treatment on the card, because a vendor who reads "sold out" as "removed"
 * goes looking for a listing they already have.
 *
 * `product.stock` is deliberately NOT shown as availability. It is the platform's
 * unsold remainder — how many more this vendor could buy — and putting it next to
 * `ownedStock` invites reading it as inventory they can sell.
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

  const soldOut = listing.ownedStock === 0;
  const unitMargin = subtract(parseMoney(product.retailPrice), parseMoney(product.costPrice));
  const sold = listing.totalPurchased - listing.ownedStock;

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

            {/* This vendor's own inventory. Unlike the old pool-empty badge, this
                one IS theirs to fix — by buying more — so it links to doing that. */}
            {soldOut && !removed && <Badge tone="danger">Sold out</Badge>}
          </div>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-meta">
            <span className="text-ink-muted">
              Shoppers pay{" "}
              <span className="font-semibold text-ink tabular-nums">
                {formatMoney(product.retailPrice)}
              </span>
            </span>
            <span className="text-ink-subtle tabular-nums">
              you paid {formatMoney(product.costPrice)}
            </span>
            <span className="text-ink-subtle tabular-nums">
              {formatNaira(unitMargin)} margin each
            </span>
          </div>

          <p className="text-meta text-ink-subtle tabular-nums">
            {soldOut ? (
              <span className="font-semibold text-ink">
                0 left — buy more to keep selling
              </span>
            ) : (
              <>{pluralise(listing.ownedStock, "unit")} left</>
            )}
            {sold > 0 && ` · ${String(sold)} sold of ${String(listing.totalPurchased)} bought`}
          </p>
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
            {/* Restocking is a purchase, so it leaves for the catalogue rather
                than being an inline form — the vendor is about to be charged and
                needs the cost, margin and pool ceiling in front of them. */}
            <Link
              href={`/products/add?q=${encodeURIComponent(product.sku)}`}
              prefetch={false}
              className="inline-flex items-center gap-1.5 rounded-input border border-divider-strong px-3 py-2 text-meta font-medium transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <ShoppingCart className="size-3.5" strokeWidth={1.75} aria-hidden />
              {soldOut ? "Buy more stock" : "Buy more"}
            </Link>

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
