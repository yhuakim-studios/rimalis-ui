import Image from "next/image";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import type { MarketplaceListing } from "@rimalis/types";
import { Badge, Card } from "@/components/primitives";
import { formatMoney } from "@/lib/money";
import { availabilityOf, imageAlt, primaryImage } from "@/lib/listing";

/**
 * One listing in a grid.
 *
 * ## The three things this gets right that an inline version would not
 *
 * **1. It renders `effectivePrice`, never `basePrice` or `vendorPrice`.** Those
 * two are the *inputs* to a price; `effectivePrice` is the answer, resolved
 * server-side. Rendering `basePrice` shows the admin's catalogue price rather than
 * what this vendor charges — a wrong number that looks completely plausible, and
 * one a shopper only discovers at checkout.
 *
 * **2. It links by `listing.id`, never `product.id`.** One product carried by
 * three vendors has one product id and three listing ids. A link on `product.id`
 * 404s, and a *cart line* on it would silently pick a vendor.
 *
 * **3. It survives an empty `images` array.** Browse rows carry *at most* the
 * primary image; a product with no images yields `[]`. The seed includes one
 * (`LOGI-MXK-BLK`) so this path is reachable without editing the database.
 *
 * ## Why the whole card is one link
 *
 * A card with separate links on the image, the title and the vendor gives a
 * keyboard user three stops for one destination, and a screen reader three
 * announcements. One anchor over the whole card, with the vendor name as
 * non-interactive text, is one stop. The vendor's own storefront is reachable
 * from the product page — which is the right place for it, since that page has
 * room to say whose store it is.
 */

export function ProductCard({ listing }: { listing: MarketplaceListing }) {
  const image = primaryImage(listing.product.images);
  const availability = availabilityOf(listing);

  return (
    // `<li>` because a grid of products is a list, and screen readers announce
    // "list, 24 items" — real orientation a set of divs cannot give.
    <Card as="li" padding="none" interactive>
      <Link href={`/products/${listing.id}`} className="flex h-full flex-col">
        <div className="relative aspect-square w-full bg-canvas">
          {image ? (
            <Image
              src={image.url}
              // Never `alt=""` for a product photo — in a grid it is often the
              // only thing distinguishing two rows. See `imageAlt`.
              alt={imageAlt(image, listing.product.name)}
              fill
              // `sizes` still matters with `unoptimized: true`: it drives which
              // candidate the browser picks and stops it downloading a 1200px
              // image for a 300px slot on a phone.
              sizes="(min-width: 1280px) 300px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center text-ink-subtle" aria-hidden>
              <ImageOff className="size-8" strokeWidth={1.5} />
            </div>
          )}

          {availability.kind === "out_of_stock" && (
            <span className="absolute left-3 top-3">
              <Badge tone="danger">Out of stock</Badge>
            </span>
          )}
          {availability.kind === "low_stock" && (
            <span className="absolute left-3 top-3">
              <Badge tone="brand">
                Only {availability.available} left
              </Badge>
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          {/* `line-clamp-2` with a `min-h` so cards in a row align even when one
              title wraps and its neighbour does not — otherwise the prices sit
              at different heights and the grid looks broken.

              `min-h-11` (44px) is two lines of `text-body` at its 1.5
              line-height, and it is an 8-point step. NOT `min-h-[2.75rem]`,
              which is the same number expressed as the arbitrary value the
              design system forbids and the Phase 1 audit greps for. */}
          <h3 className="line-clamp-2 min-h-11 text-body font-medium text-ink">
            {listing.product.name}
          </h3>

          <p className="text-meta text-ink-muted">{listing.vendor.storeName}</p>

          {/* `mt-auto` pins the price to the bottom of the card regardless of
              how many lines the title took. */}
          <p className="mt-auto text-section text-ink">
            {formatMoney(listing.effectivePrice)}
          </p>
        </div>
      </Link>
    </Card>
  );
}

/** The card's own skeleton, in the same file so the two cannot drift in height —
 * a skeleton that is shorter than the card promises a layout and then breaks it,
 * which is worse than no skeleton at all. */
export function ProductCardSkeleton() {
  return (
    <li className="overflow-hidden rounded-card bg-surface shadow-card">
      <div className="aspect-square w-full animate-shimmer bg-divider" aria-hidden />
      <div className="flex flex-col gap-2 p-4" aria-hidden>
        <div className="h-4 w-full animate-shimmer rounded-input bg-divider" />
        <div className="h-4 w-2/3 animate-shimmer rounded-input bg-divider" />
        <div className="mt-2 h-6 w-1/2 animate-shimmer rounded-input bg-divider" />
      </div>
    </li>
  );
}
