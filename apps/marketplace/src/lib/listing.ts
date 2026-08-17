import type { Category, MarketplaceListing, ProductImage } from "@rimalis/types";

/**
 * Small derivations over catalogue DTOs.
 *
 * Each of these is somewhere the wire shape and what a screen needs to render
 * differ, and each is a place where the obvious inline expression is subtly
 * wrong. They live here so the wrongness is fixed once.
 */

/**
 * The image to show, or `null`.
 *
 * `images[0]` is wrong twice over. The array can be **empty** — browse rows carry
 * *at most* the primary image, and the API seed includes a product with no
 * images at all (SKU `LOGI-MXK-BLK`) precisely so this path is reachable. And on
 * a detail row the array is the full gallery ordered by `sortOrder`, where the
 * primary image is not guaranteed to be first.
 *
 * `noUncheckedIndexedAccess` catches the first mistake at compile time. It does
 * not catch the second, which is why this prefers `isPrimary` explicitly.
 */
export const primaryImage = (images: readonly ProductImage[]): ProductImage | null =>
  images.find((image) => image.isPrimary) ?? images[0] ?? null;

/**
 * Alt text for a product image.
 *
 * Falls back to the product name rather than to `""`. An empty `alt` tells a
 * screen reader the image is decorative, and a product photo in a shopping grid
 * is the opposite of decorative — it is often the only thing distinguishing two
 * rows. Never pass `alt=""` here.
 */
export const imageAlt = (image: ProductImage | null, productName: string): string =>
  image?.altText?.trim() || productName;

/**
 * How a listing can be bought, as a single discriminant.
 *
 * Derived rather than read from a field because the API has no such field: the
 * information is spread across `ownedStock` and `isActive`, and the rules for
 * combining them are the same on a grid card, a detail page and a cart line. One
 * function means those three cannot disagree — which they will, if each writes
 * its own `stock > 0 ? … : …`.
 *
 * `ownedStock` is inventory THIS vendor bought and holds. It replaced a derived
 * `effectiveStock` (pool stock capped per vendor) when the platform moved to
 * prepaid wholesale: two vendors carrying one product now draw down separate
 * inventories, so one selling out no longer empties the other's listing.
 * `product.stock` is the platform's unsold remainder and must never be shown to
 * a shopper as availability.
 *
 * Note what is NOT a state here: a listing being invisible. Suspended vendors,
 * inactive listings and UNAVAILABLE products are filtered out by the API and
 * never reach this code, so there is no branch for them.
 */
export type Availability =
  /** Buyable now. `available` is the ceiling a quantity stepper should clamp to. */
  | { kind: "in_stock"; available: number }
  /** Buyable, but nearly gone — worth saying so, and a real conversion signal. */
  | { kind: "low_stock"; available: number }
  /** Visible but not buyable. The API returns these rather than hiding them, so a
   *  shopper can see the product exists and the vendor keeps the page's SEO. */
  | { kind: "out_of_stock" };

/** Below this many units, say so. Five is the API's own `lowStockAt` default. */
export const LOW_STOCK_THRESHOLD = 5;

export const availabilityOf = (listing: MarketplaceListing): Availability => {
  if (listing.ownedStock <= 0) return { kind: "out_of_stock" };
  if (listing.ownedStock <= LOW_STOCK_THRESHOLD)
    return { kind: "low_stock", available: listing.ownedStock };
  return { kind: "in_stock", available: listing.ownedStock };
};

export const isBuyable = (listing: MarketplaceListing): boolean =>
  availabilityOf(listing).kind !== "out_of_stock";

/** A category and its children, for the filter panel. */
export interface CategoryNode extends Category {
  children: CategoryNode[];
}

/**
 * Builds the category tree from the flat array the API returns.
 *
 * Two passes rather than recursion, and it relies on a guarantee the API makes
 * explicitly: **the returned set is connected** — every ancestor of every
 * returned category is included, so no node's `parentId` points at something
 * absent. That guarantee is why this can be simple.
 *
 * It is also why it is worth stating. The API did NOT make that guarantee
 * originally: `/marketplace/categories` returned only categories with visible
 * listings, so a nested category arrived with its parent missing, and a
 * naive builder silently dropped every nested category — the whole subtree
 * vanished from the filter panel with no error anywhere. Fixed API-side in
 * migration-era commit `fix/marketplace-sort-and-category-tree`.
 *
 * The `orphans` return value keeps that honest rather than trusting it: if the
 * guarantee ever regresses, the caller can surface the orphans at the top level
 * instead of losing them. Silently dropping data is the one behaviour to avoid.
 */
export function buildCategoryTree(categories: readonly Category[]): {
  roots: CategoryNode[];
  orphans: CategoryNode[];
} {
  const nodes = new Map<string, CategoryNode>(
    categories.map((category) => [category.id, { ...category, children: [] }]),
  );

  const roots: CategoryNode[] = [];
  const orphans: CategoryNode[] = [];

  for (const node of nodes.values()) {
    if (node.parentId === null) {
      roots.push(node);
      continue;
    }
    const parent = nodes.get(node.parentId);
    if (parent) parent.children.push(node);
    else orphans.push(node);
  }

  const byName = (a: Category, b: Category) => a.name.localeCompare(b.name);
  roots.sort(byName);
  for (const node of nodes.values()) node.children.sort(byName);

  return { roots, orphans };
}

/** Flattens a tree back to a depth-annotated list, for rendering an indented
 * `<select>` or a nested list without recursive components. */
export function flattenTree(
  nodes: readonly CategoryNode[],
  depth = 0,
): Array<{ category: CategoryNode; depth: number }> {
  return nodes.flatMap((category) => [
    { category, depth },
    ...flattenTree(category.children, depth + 1),
  ]);
}
