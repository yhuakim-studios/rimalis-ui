"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, ChevronLeft } from "lucide-react";
import type { CategoryView } from "@/lib/home";
import { CATEGORY_ICONS, CATEGORY_TINTS } from "./category-presentation";

/**
 * The category carousel. Presentational — data comes from `loadHomeData()`.
 *
 * ## Why the hardcoded list had to go
 *
 * It offered eight categories — `fashion`, `beauty`, `sports`, `toys-games`,
 * `automotive`, `books`, `home-living`, `electronics`. The catalogue has six:
 * `electronics` and `home-kitchen` at the top level, with `audio`, `computing`,
 * `phones-tablets` and `small-appliances` beneath them. Only `electronics`
 * overlapped, so **seven of the eight circles linked to an empty results page** —
 * a dead end that renders as a successful search finding nothing, which is the
 * hardest kind of broken to notice.
 *
 * ## Images come from products, not from a file map
 *
 * `imageUrl` is a real product photo from that category, chosen server-side. A
 * slug→PNG map would need editing every time the admin adds a category, and until
 * someone did, the new circle would render a broken `<Image src>`. The icon tile
 * below is the designed fallback for a category whose products have no photos.
 *
 * ## ⚠️ Counts are DIRECT, because the API does not roll up
 *
 * `GET /marketplace/products?categoryId=X` matches only products assigned to X
 * itself — it does **not** include X's descendants. Measured against the live
 * catalogue:
 *
 *     electronics       1 direct   (children hold 4 + 3 + 10 = 17 more)
 *     home-kitchen      0 direct   (its child small-appliances holds 2)
 *
 * So a top-level "Electronics" circle would show 18 products and deliver 1, and
 * "Home & Kitchen" would deliver none at all. Both are worse than a dead link,
 * because the page renders as a successful search that found almost nothing.
 *
 * `loadHomeData()` therefore counts and filters on **direct** listings only, which
 * makes the number on each circle exactly what the click delivers — accurate, and
 * never a dead end. The visible consequence is that `home-kitchen` does not appear
 * and `electronics` reads "1 item".
 *
 * The real fix belongs on the API: `categoryId` should match the subtree, which it
 * already knows how to walk (`GET /categories/tree` exists). Until then, do not
 * "fix" this by summing children into the parent here — the count would be right
 * and the link would still be wrong.
 */

export function CategoryCircles({ categories }: { categories: readonly CategoryView[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -300 : 300;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  if (categories.length === 0) return null;

  return (
    <section className="py-10 border-b border-divider">
      <div className="flex flex-col gap-6">
        {/* Title Block */}
        <div className="text-center flex flex-col items-center gap-1.5">
          <h2 className="text-2xl font-bold tracking-tight text-ink font-sans">
            Browse By Categories
          </h2>
          <p className="text-caption text-ink-muted">
            Explore handpicked collections for every part of your life.
          </p>
        </div>

        {/* Carousel Container */}
        <div className="relative group px-2">
          {/* Scroll Left Button */}
          <button
            onClick={() => scroll("left")}
            aria-label="Scroll left"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 size-9 rounded-full bg-surface border border-divider shadow-md flex items-center justify-center text-ink opacity-0 group-hover:opacity-100 transition-opacity hover:bg-canvas"
          >
            <ChevronLeft className="size-5" />
          </button>

          {/* Circle Row */}
          <div
            ref={scrollRef}
            className="flex items-center gap-6 overflow-x-auto no-scrollbar py-3 px-2 scroll-smooth"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {categories.map((item) => {
              const Icon = CATEGORY_ICONS[item.slug] ?? CATEGORY_ICONS["__default"]!;
              const tint = CATEGORY_TINTS[item.slug] ?? CATEGORY_TINTS["__default"]!;

              return (
                <Link
                  key={item.slug}
                  href={`/products?category=${encodeURIComponent(item.slug)}`}
                  className="flex flex-col items-center gap-3 shrink-0 group/circle"
                >
                  {/* Outer Circular Container with Hover Ring */}
                  <div className="relative size-24 md:size-28 rounded-full overflow-hidden bg-canvas border border-divider shadow-xs transition-transform duration-200 group-hover/circle:scale-105 group-hover/circle:shadow-md group-hover/circle:border-ink/30 flex items-center justify-center">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        // Decorative: the category name is a label directly below,
                        // so describing the photo would just repeat it.
                        alt=""
                        fill
                        className="object-cover transition-transform duration-300 group-hover/circle:scale-110"
                        sizes="112px"
                      />
                    ) : (
                      <div className={`grid size-full place-items-center ${tint}`} aria-hidden>
                        <Icon className="size-8" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>

                  <span className="text-[13px] font-semibold text-ink group-hover/circle:text-brand-600 transition-colors">
                    {item.name}
                  </span>
                  {/* A real count, so a shopper knows whether the circle is worth
                      a click before they spend one on it. */}
                  <span className="-mt-2 text-meta text-ink-subtle">
                    {item.productCount} {item.productCount === 1 ? "item" : "items"}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Scroll Right Button */}
          <button
            onClick={() => scroll("right")}
            aria-label="Scroll right"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 size-9 rounded-full bg-surface border border-divider shadow-md flex items-center justify-center text-ink hover:bg-canvas transition-all"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
