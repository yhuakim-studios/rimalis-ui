"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ImageOff, ShoppingBag, ArrowRight, Check } from "lucide-react";
import type { ProductCardView } from "@/lib/home";

/**
 * The trending row. Presentational — data comes from `loadHomeData()`.
 *
 * ## Three things changed when this was wired to the API
 *
 * **The star rating is gone, and it could not be kept.** `rimalis-api` has no
 * rating, review or score field anywhere — not on `Product`, not on `VendorProduct`,
 * not on `OrderItem`. A hardcoded 4.8 on every tile is a claim about a real
 * merchant's goods that nothing backs, and shoppers read star ratings as fact. The
 * slot now carries the vendor's store name, which is real, and is the more useful
 * thing to show on a multi-vendor marketplace anyway: it tells you *whose* price
 * you are looking at, and the same product appears again under another store at a
 * different price.
 *
 * **Prices are ₦, formatted server-side.** They arrive pre-formatted as strings;
 * see `lib/home.ts` for why the formatting does not happen here. The old
 * `${price.toFixed(2)}` was rendering US dollars from a float.
 *
 * **The image can be absent.** `imageUrl` is `null` for a product with no photos —
 * the seed carries one (SKU `LOGI-MXK-BLK`) so the branch is reachable. The old
 * emoji fallback sat behind `-z-10` and so was never visible; this renders a real
 * placeholder instead.
 *
 * The add-to-cart button stays a local-state stub. The cart is Phase 3, and a
 * button that pretends to work is worse than one that visibly acknowledges the
 * click, which is what this does.
 */

export function TrendingProducts({ products }: { products: readonly ProductCardView[] }) {
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});

  const handleAddToCart = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAddedIds((prev) => ({ ...prev, [id]: true }));

    // Reset feedback state after 1.5s
    setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [id]: false }));
    }, 1500);
  };

  if (products.length === 0) return null;

  return (
    <section className="py-10">
      <div className="flex flex-col gap-6">
        {/* Section Header */}
        <div className="flex items-end justify-between gap-4 border-b border-divider/40 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-ink font-sans">
                Trending Right Now
              </h2>
              {/* `text-amber-500` was dropped: a colour emoji paints from its own
                  font colour table and ignores `text-*` entirely, so the class was
                  inert — it only registered as a second accent to the audit grep
                  (rule 1 in theme.css). The emoji looks identical without it. */}
              <span className="text-xl">⚡</span>
            </div>
            <p className="text-caption text-ink-muted mt-1">
              Top picks that everyone is loving this week.
            </p>
          </div>

          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-caption font-semibold text-ink hover:text-brand-600 transition-colors group"
          >
            <span>View All</span>
            <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Product Cards Grid (6 columns on desktop) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-5">
          {products.map((prod) => {
            const isAdded = !!addedIds[prod.listingId];
            return (
              <div
                key={prod.listingId}
                className="group relative flex flex-col justify-between rounded-[20px] bg-[#F7F7F5] border border-divider/80 p-3.5 transition-all duration-200 hover:shadow-card hover:bg-surface hover:-translate-y-0.5"
              >
                {/* Product Image Slot */}
                {/* `listingId`, NOT a product id — one product carried by three
                    vendors has three listing ids, and only this one identifies
                    whose price the shopper just saw. */}
                <Link href={`/products/${prod.listingId}`} className="block">
                  <div className="relative aspect-square w-full rounded-2xl bg-white flex items-center justify-center p-3 overflow-hidden shadow-xs mb-3">
                    {prod.imageUrl ? (
                      <Image
                        src={prod.imageUrl}
                        alt={prod.imageAlt}
                        fill
                        className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                        sizes="(min-width: 1024px) 200px, 50vw"
                      />
                    ) : (
                      <div className="grid size-full place-items-center text-ink-subtle" aria-hidden>
                        <ImageOff className="size-7" strokeWidth={1.5} />
                      </div>
                    )}

                    {prod.outOfStock && (
                      <span className="absolute left-2 top-2 rounded-pill bg-danger-soft px-2 py-0.5 text-meta font-semibold text-danger">
                        Sold out
                      </span>
                    )}
                    {!prod.outOfStock && prod.lowStock !== null && (
                      <span className="absolute left-2 top-2 rounded-pill bg-brand-50 px-2 py-0.5 text-meta font-semibold text-brand-700">
                        {prod.lowStock} left
                      </span>
                    )}
                  </div>

                  {/* Title & Price Info */}
                  <div className="flex flex-col gap-1">
                    <h3 className="text-[13px] font-semibold text-ink leading-tight line-clamp-1 group-hover:text-brand-600 transition-colors">
                      {prod.name}
                    </h3>

                    <div className="flex items-center justify-between mt-1">
                      <span className="text-body font-bold text-ink">{prod.price}</span>
                    </div>
                  </div>
                </Link>

                {/* Vendor & Cart Action Bar */}
                <div className="flex items-center justify-between gap-2 pt-2.5 mt-2 border-t border-divider/60">
                  {/* Was a hardcoded star rating. The API has no rating field, so
                      this shows the store instead — see the header. */}
                  <span className="min-w-0 truncate text-meta text-ink-muted" title={prod.storeName}>
                    {prod.storeName}
                  </span>

                  <button
                    onClick={(e) => handleAddToCart(prod.listingId, e)}
                    disabled={prod.outOfStock}
                    aria-label={
                      prod.outOfStock ? `${prod.name} is sold out` : `Add ${prod.name} to cart`
                    }
                    className={`grid size-9 shrink-0 place-items-center rounded-xl border border-divider transition-all duration-150 ${
                      prod.outOfStock
                        ? "cursor-not-allowed bg-canvas text-ink-subtle"
                        : isAdded
                          ? "bg-brand-600 border-brand-600 text-white scale-105"
                          : "bg-surface text-ink hover:bg-ink hover:text-white hover:border-ink"
                    }`}
                  >
                    {isAdded ? (
                      <Check className="size-4 animate-in zoom-in-50" strokeWidth={2.5} />
                    ) : (
                      <ShoppingBag className="size-4" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
