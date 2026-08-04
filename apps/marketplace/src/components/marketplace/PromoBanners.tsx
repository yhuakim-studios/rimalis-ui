"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Two promotional banners. Deliberately NOT wired to the API.
 *
 * There is no campaign, promotion or discount model in `digistore-api` — no
 * percentage-off field, no sale window, no banner content type. So "Up To 50% Off
 * On Bestsellers" has nothing behind it and could not be made true by wiring;
 * making the copy dynamic would just move the invention somewhere less visible.
 * The copy and artwork stay exactly as written, as marketing.
 *
 * What did change is both CTAs. They pointed at `/deals` and `/new-arrivals`,
 * neither of which is a route — so the two most prominent buttons on the home page
 * led to a 404. They now go to real queries: the catalogue sorted by ascending
 * price, and the catalogue itself (whose default sort is newest, which is what
 * "New Arrival" means).
 *
 * ⚠️ Before this ships to real shoppers, the "Up To 50% Off" claim needs to either
 * become true or come down. That is a product decision, not a code one, which is
 * why it is flagged here rather than quietly reworded.
 */

export function PromoBanners() {
  return (
    <section className="py-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Banner 1: SUMMER SALE */}
        <div className="relative rounded-[24px] bg-[#E5EEF5] p-8 md:p-10 overflow-hidden flex flex-col justify-between min-h-[260px] border border-divider/60 shadow-sm group">
          <div className="relative z-10 max-w-xs flex flex-col items-start gap-3">
            <span className="text-[11px] font-bold tracking-widest text-ink/70 uppercase">
              SUMMER SALE
            </span>

            <h3 className="text-2xl md:text-3xl font-extrabold text-ink leading-tight tracking-tight">
              Up To 50% Off On Bestsellers
            </h3>

            <div className="pt-2">
              <Link
                href="/products?sort=price_asc"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-ink text-white font-medium text-caption shadow-xs hover:bg-black/90 hover:scale-[1.02] active:scale-[0.98] transition-all group/btn"
              >
                <span>Shop Sale</span>
                <ArrowRight className="size-4 group-hover/btn:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Banner Graphic/Visual Content */}
          <div className="absolute right-0 bottom-0 top-0 w-1/2 min-w-[200px] flex items-end justify-end pointer-events-none">
            <div className="relative w-full h-full min-h-[220px]">
              <Image
                src="/images/promo_summer_sale.png"
                alt="Summer Sale Bestsellers"
                fill
                className="object-contain object-right-bottom p-2 group-hover:scale-105 transition-transform duration-500"
                sizes="(min-width: 768px) 300px, 50vw"
                onError={(e) => {
                  const target = e.target as HTMLElement;
                  target.style.display = "none";
                }}
              />
              {/* Fallback Graphic */}
              <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-30 -z-10">
                👜
              </div>
            </div>
          </div>
        </div>

        {/* Banner 2: NEW ARRIVAL */}
        <div className="relative rounded-[24px] bg-[#F5EDE6] p-8 md:p-10 overflow-hidden flex flex-col justify-between min-h-[260px] border border-divider/60 shadow-sm group">
          <div className="relative z-10 max-w-xs flex flex-col items-start gap-3">
            <span className="text-[11px] font-bold tracking-widest text-ink/70 uppercase">
              NEW ARRIVAL
            </span>

            <h3 className="text-2xl md:text-3xl font-extrabold text-ink leading-tight tracking-tight">
              Fresh Finds You'll Love
            </h3>

            <div className="pt-2">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-surface border border-divider-strong text-ink font-medium text-caption shadow-xs hover:bg-canvas hover:border-ink transition-all group/btn"
              >
                <span>Explore Now</span>
                <ArrowRight className="size-4 group-hover/btn:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Banner Graphic/Visual Content */}
          <div className="absolute right-0 bottom-0 top-0 w-1/2 min-w-[200px] flex items-end justify-end pointer-events-none">
            <div className="relative w-full h-full min-h-[220px]">
              <Image
                src="/images/promo_fresh_finds.png"
                alt="Fresh Finds Collection"
                fill
                className="object-contain object-right-bottom p-2 group-hover:scale-105 transition-transform duration-500"
                sizes="(min-width: 768px) 300px, 50vw"
                onError={(e) => {
                  const target = e.target as HTMLElement;
                  target.style.display = "none";
                }}
              />
              {/* Fallback Graphic */}
              <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-30 -z-10">
                👟
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
