"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Store } from "lucide-react";
import type { StoreView } from "@/lib/home";

/**
 * The four-card feature row — now the vendor stores.
 *
 * ## Why this became stores rather than "collections"
 *
 * ⚠️ **This is the one place I changed what a section is about, so it is worth
 * being explicit.** The original four cards were editorial collections — "Elegant
 * Outfits", "Skincare Essentials", "Gaming Accessories", "Modern Living" — linked
 * to `womens-fashion`, `beauty-personal-care` and `home-living`. None of those
 * categories exist, so all four cards led to an empty results page.
 *
 * There is no collection, campaign or curation model in `digistore-api` to read
 * them from, and inventing one would mean hardcoding four category slugs and
 * hoping an admin never renames them. The two honest options were to delete the
 * section or to give it real content.
 *
 * Stores are the right real content. This is a **multi-vendor** marketplace where
 * the same product appears under several sellers at different prices — the store is
 * the thing a shopper here actually chooses between, and `/store/:slug` is already a
 * shipped route (the API hardcodes it into transactional emails). It also does not
 * duplicate the category circles directly above.
 *
 * The card design, grid, hover lift and image treatment are all unchanged. If you
 * want editorial collections back, they need a model on the API side first.
 *
 * ## The tints
 *
 * The original four hardcoded pastels (`bg-[#F3ECE6]`, `bg-[#F4ECEC]`,
 * `bg-[#E6ECF2]`, `bg-[#ECEEEA]`) were one per card, which does not survive a
 * variable number of stores. They are now cycled from a fixed list so any count
 * looks deliberate.
 */

/** Cycled by index, so N stores always look intentional. */
const TINTS = ["bg-[#F3ECE6]", "bg-[#F4ECEC]", "bg-[#E6ECF2]", "bg-[#ECEEEA]"] as const;

export function FeaturedCollections({ stores }: { stores: readonly StoreView[] }) {
  if (stores.length === 0) return null;

  return (
    <section className="py-10">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-end justify-between gap-4 border-b border-divider/40 pb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-ink font-sans">
              Featured Stores
            </h2>
            <p className="text-caption text-ink-muted mt-1">
              Every seller reviewed and approved before they can list.
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

        {/* 4 Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {stores.slice(0, 4).map((store, index) => (
            <Link
              key={store.slug}
              href={`/store/${encodeURIComponent(store.slug)}`}
              className={`group relative rounded-[22px] ${TINTS[index % TINTS.length]} p-6 flex flex-col justify-between overflow-hidden min-h-[170px] border border-divider/60 transition-all duration-200 hover:shadow-card hover:-translate-y-1`}
            >
              {/* Card Text Content */}
              <div className="relative z-10 flex flex-col gap-1 max-w-[60%]">
                <h3 className="text-lg font-bold text-ink leading-snug group-hover:text-brand-600 transition-colors">
                  {store.storeName}
                </h3>
                <p className="text-caption text-ink-muted">
                  {store.productCount} {store.productCount === 1 ? "product" : "products"}
                </p>
              </div>

              {/* Right Side Image */}
              <div className="absolute right-0 bottom-0 top-0 w-[45%] flex items-end justify-end pointer-events-none p-2">
                <div className="relative w-full h-full min-h-[130px]">
                  {store.imageUrl ? (
                    <Image
                      src={store.imageUrl}
                      // Decorative: it is one of the store's products standing in
                      // for a logo, and the store name is the heading beside it.
                      alt=""
                      fill
                      className="object-contain object-right-bottom group-hover:scale-105 transition-transform duration-300"
                      sizes="200px"
                    />
                  ) : (
                    <div className="grid size-full place-items-end justify-items-end p-2 text-ink/20" aria-hidden>
                      <Store className="size-12" strokeWidth={1.5} />
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
