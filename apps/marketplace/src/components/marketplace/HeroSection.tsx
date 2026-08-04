"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Tag, ArrowRight, ShoppingBag } from "lucide-react";
import type { CategoryView } from "@/lib/home";
import { CATEGORY_ICONS } from "./category-presentation";

/**
 * The hero: category sidebar plus the main banner.
 *
 * ## What was wired
 *
 * The sidebar listed ten invented categories (`womens-fashion`, `pet-supplies`,
 * `books-stationery`, …). None existed in the catalogue, so every one linked to an
 * empty results page. It now renders the real six, with counts, indented by tree
 * depth — the nesting is real information here (`Audio` and `Computing` sit under
 * `Electronics`) and it was flat before.
 *
 * ## What was NOT wired, and why
 *
 * The banner copy — "New Collection", "Upgrade Your Lifestyle Today" — is
 * marketing, not data. There is no campaign or promotion model in the API, so
 * there is nothing to read it from and it stays as written.
 *
 * The three carousel dots are likewise honest about themselves: they change
 * `activeSlide` and there is one slide. Left as the visual affordance you built,
 * since a real carousel needs banner content the API cannot yet provide.
 *
 * **"Gift Cards" was removed.** There is no gift-card concept anywhere in
 * `digistore-api` — no model, no endpoint, no payment path — so the link went to
 * `/gift-cards`, which 404s. A dead nav item in a black sidebar on the home page is
 * a promise the product cannot keep. "Top Offers" survives because it maps onto
 * something real: the catalogue sorted by ascending price.
 */

export function HeroSection({ categories }: { categories: readonly CategoryView[] }) {
  const [activeSlide, setActiveSlide] = useState(0);

  return (
    <section className="py-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
        {/* Left Category Navigation Sidebar */}
        <div className="lg:col-span-3 bg-black text-white rounded-[24px] p-4 flex flex-col justify-between shadow-card">
          <div>
            <div className="px-3 py-2 font-bold text-caption tracking-tight border-b border-white/10 mb-2 flex items-center gap-2">
              <ShoppingBag className="size-4 text-white/80" />
              <span>Shop by Categories</span>
            </div>
            <nav className="flex flex-col gap-0.5">
              {categories.map((cat) => {
                const IconComponent = CATEGORY_ICONS[cat.slug] ?? CATEGORY_ICONS["__default"]!;
                return (
                  <Link
                    key={cat.slug}
                    href={`/products?category=${encodeURIComponent(cat.slug)}`}
                    className="flex items-center justify-between px-3 py-2 text-caption text-white/90 rounded-xl hover:bg-white/10 hover:text-white transition-colors duration-150 group"
                    // Indentation by tree depth. An inline style because the value
                    // is data-driven — a `pl-${depth}` template string is exactly
                    // the dynamic class Tailwind cannot see at build time and would
                    // emit nothing for. Still an 8-point multiple.
                    style={cat.depth > 0 ? { paddingLeft: `${12 + cat.depth * 16}px` } : undefined}
                  >
                    <div className="flex items-center gap-2.5">
                      <IconComponent
                        className="size-4 text-white/60 group-hover:text-white transition-colors"
                        strokeWidth={1.75}
                      />
                      <span className="text-[13px] font-medium">{cat.name}</span>
                    </div>
                    <span className="flex items-center gap-1.5">
                      <span className="text-meta text-white/40">{cat.productCount}</span>
                      <ChevronRight
                        className="size-4 text-white/40 group-hover:text-white/80 group-hover:translate-x-0.5 transition-all"
                        strokeWidth={1.5}
                      />
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="pt-3 mt-2 border-t border-white/10 flex flex-col gap-1">
            {/* Points at a real query. See the header for why "Gift Cards" is gone. */}
            <Link
              href="/products?sort=price_asc"
              className="flex items-center justify-between px-3 py-2 text-caption text-white/90 rounded-xl hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Tag className="size-4 text-amber-400" strokeWidth={1.75} />
                <span className="text-[13px] font-semibold text-white">Best Prices First</span>
              </div>
              <ChevronRight className="size-4 text-white/40" strokeWidth={1.5} />
            </Link>
          </div>
        </div>

        {/* Right Main Hero Banner */}
        <div className="lg:col-span-9 bg-[#EFEFEF] rounded-[24px] overflow-hidden relative flex flex-col justify-between min-h-[460px] p-8 md:p-12 shadow-sm border border-divider">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center h-full">
            {/* Left Content Area */}
            <div className="md:col-span-7 flex flex-col justify-center gap-5 z-10">
              <span className="text-[11px] font-bold tracking-widest text-ink/70 uppercase">
                NEW COLLECTION
              </span>

              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-ink leading-[1.1]">
                Upgrade Your Lifestyle Today
              </h1>

              <p className="text-caption md:text-body text-ink-muted max-w-md">
                Find the latest trends, top brands and exclusive deals all in one place.
              </p>

              <div className="pt-2">
                <Link
                  href="/products"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-ink text-white font-medium text-caption shadow-md hover:bg-black/90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 group"
                >
                  <span>Shop Now</span>
                  <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" strokeWidth={2} />
                </Link>
              </div>

              {/* Carousel Pagination Dots */}
              <div className="flex items-center gap-2 pt-6">
                {[0, 1, 2].map((idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveSlide(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                    className={`h-2.5 rounded-full transition-all duration-200 ${
                      activeSlide === idx ? "w-6 bg-ink" : "w-2.5 bg-ink/30 hover:bg-ink/60"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Right Image Feature with Architectural Backdrop */}
            <div className="md:col-span-5 relative flex items-center justify-center h-full min-h-[320px]">
              {/* Soft Arch frame backdrop */}
              <div className="absolute inset-0 bg-[#E5E3E0] rounded-t-full rounded-b-3xl border border-white/60 shadow-inner overflow-hidden" />

              {/* Hero Lifestyle Photo */}
              <div className="relative z-10 w-full h-[380px] md:h-[420px] rounded-t-full rounded-b-3xl overflow-hidden shadow-md border border-white/40">
                <Image
                  src="/images/hero_lifestyle.png"
                  // Decorative: the heading beside it carries the message, and the
                  // photo adds mood rather than information.
                  alt=""
                  fill
                  priority
                  className="object-cover object-top hover:scale-105 transition-transform duration-700"
                  sizes="(min-width: 768px) 50vw, 100vw"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
