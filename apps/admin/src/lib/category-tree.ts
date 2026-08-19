import type { Category } from "@rimalis/types";

/**
 * The category tree, copied from `apps/marketplace/src/lib/listing.ts`.
 *
 * Copied rather than imported: `packages/ui` is still `export {}` and the
 * primitives are already duplicated three ways by the same deliberate decision —
 * extract once, when the shape has stopped moving, as its own reviewable change.
 * See the header of components/primitives/index.ts.
 *
 * ⚠️ ONE DIFFERENCE that matters, and it is about which endpoint feeds it.
 *
 * The marketplace builds this from `GET /marketplace/categories`, which guarantees
 * the returned set is CONNECTED — every ancestor of every returned category is
 * included. The admin console builds it from `GET /categories`, which returns
 * every category and therefore satisfies that guarantee trivially, but **does not
 * promise it**. So the `orphans` return value is not a formality here: it is the
 * only thing standing between a regression in that endpoint and a subtree silently
 * vanishing from this screen. The categories page renders orphans at the top level
 * with a warning rather than dropping them.
 */

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
