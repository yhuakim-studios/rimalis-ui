"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";
import type { ProductImage } from "@rimalis/types";
import { cn } from "@/components/primitives";
import { imageAlt, primaryImage } from "@/lib/listing";

/**
 * The product image gallery.
 *
 * ## Handles zero, one and many, because all three occur
 *
 * The detail endpoint returns the full set ordered by `sortOrder`, and that set
 * can be **empty** — the API seed carries a product with no images at all (SKU
 * `LOGI-MXK-BLK`) precisely so this branch is reachable without editing the
 * database. With one image the thumbnail strip is suppressed, since a strip of one
 * is a control that does nothing.
 *
 * ## The initial selection is the primary image, not `images[0]`
 *
 * The array is ordered by `sortOrder`, and nothing guarantees the primary image
 * sorts first. `primaryImage()` prefers `isPrimary` and falls back to the first,
 * which is the same rule the grid card uses — so the image a shopper clicked in
 * the grid is the one they land on.
 *
 * ## Thumbnails are buttons, not links
 *
 * Switching the displayed image does not change what page you are on, so it must
 * not change the URL. `aria-current` marks the selected one, since a border alone
 * says it only to sighted users.
 */

export function Gallery({ images, productName }: { images: readonly ProductImage[]; productName: string }) {
  const initial = primaryImage(images);
  const [activeId, setActiveId] = useState<string | null>(initial?.id ?? null);

  // Falls back to `initial` rather than trusting the id: if `images` ever changes
  // identity under this component, a stale id would render nothing at all.
  const active = images.find((image) => image.id === activeId) ?? initial;

  if (!active) {
    return (
      <div
        className="grid aspect-square w-full place-items-center rounded-card bg-canvas text-ink-subtle"
        // Not `aria-hidden`: "no image available" is real information for
        // someone who cannot see that the slot is empty, and silence here would
        // leave them wondering whether an image failed to load.
        role="img"
        aria-label={`No image available for ${productName}`}
      >
        <ImageOff className="size-10" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-card bg-canvas">
        <Image
          // `key` on the URL so React swaps the element rather than mutating
          // `src` on the existing one — without it the browser paints the old
          // image at the new one's dimensions for a frame.
          key={active.url}
          src={active.url}
          alt={imageAlt(active, productName)}
          fill
          sizes="(min-width: 1024px) 600px, 100vw"
          // The first image of the detail page is almost always the largest
          // element above the fold, so it is the one worth prioritising.
          priority
          className="object-contain"
        />
      </div>

      {images.length > 1 && (
        <ul className="flex gap-3 overflow-x-auto pb-1">
          {images.map((image) => {
            const selected = image.id === active.id;
            return (
              <li key={image.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(image.id)}
                  aria-current={selected ? "true" : undefined}
                  // The alt text is on the <Image> inside, so the button needs
                  // its own label describing the ACTION rather than the image.
                  aria-label={`Show image ${images.indexOf(image) + 1} of ${images.length}`}
                  className={cn(
                    "relative size-20 shrink-0 overflow-hidden rounded-input bg-canvas transition-colors duration-150 ease-out-soft",
                    selected ? "ring-2 ring-brand-600" : "ring-1 ring-divider hover:ring-ink-muted",
                  )}
                >
                  <Image
                    src={image.url}
                    // Empty alt is correct HERE and only here: the button's
                    // `aria-label` already names it, and a screen reader
                    // announcing both would say the product name twice per
                    // thumbnail.
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
