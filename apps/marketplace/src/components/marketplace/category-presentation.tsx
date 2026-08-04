import {
  Headphones,
  Laptop,
  Plug,
  Shapes,
  Smartphone,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Decoration for a category: an icon and a background tint, keyed by slug.
 *
 * ## Why this exists when the images come from the API
 *
 * `CategoryView.imageUrl` is a real product photo, so this is only the **fallback**
 * for a category whose products have no photos — and for the hero sidebar, which is
 * a compact nav list where icons read better than thumbnails.
 *
 * ## Why it is safe for this one to be a hardcoded map
 *
 * Because it degrades to something correct. Every lookup goes through
 * `__default`, so an unmapped category renders a neutral icon and tint — a
 * deliberate-looking tile, not a broken image and not a crash. That is the
 * difference from the slug→PNG map this replaced: a missing entry there produced a
 * 404 image request and an empty circle.
 *
 * It lives in its own module because `LucideIcon` is a component, and components
 * cannot cross the server→client boundary as props. So the map has to be resolved
 * inside the client component that draws it, which means it cannot live in
 * `lib/home.ts` with the rest of the shaping.
 *
 * Keys are the real seeded slugs. Adding a category needs no change here.
 */

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  electronics: Zap,
  audio: Headphones,
  computing: Laptop,
  "phones-tablets": Smartphone,
  "home-kitchen": UtensilsCrossed,
  "small-appliances": Plug,
  __default: Shapes,
};

/**
 * Tints, all built from the design system's own tokens — brand and neutrals only.
 *
 * Not a per-category hue. The token file's first rule is one accent, and eight
 * pastel category colours is exactly how a palette becomes fifteen colours. These
 * vary in *step*, not in hue.
 */
export const CATEGORY_TINTS: Record<string, string> = {
  electronics: "bg-brand-50 text-brand-700",
  audio: "bg-canvas text-ink-muted",
  computing: "bg-brand-50 text-brand-700",
  "phones-tablets": "bg-canvas text-ink-muted",
  "home-kitchen": "bg-brand-50 text-brand-700",
  "small-appliances": "bg-canvas text-ink-muted",
  __default: "bg-canvas text-ink-muted",
};
