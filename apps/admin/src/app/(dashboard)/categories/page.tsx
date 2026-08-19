import type { Metadata } from "next";
import { AlertTriangle, FolderTree } from "lucide-react";
import { Card } from "@/components/primitives";
import { EmptyState, ErrorState } from "@/components/feedback";
import { categories, ctxFor, requireAdmin } from "@/lib/auth";
import { buildCategoryTree, flattenTree, type CategoryNode } from "@/lib/category-tree";
import { CategoryRow, CreateCategoryForm, type ParentOption } from "./CategoryForms";

export const metadata: Metadata = { title: "Categories" };

/**
 * The catalogue taxonomy.
 *
 * ## `GET /categories`, not `GET /marketplace/categories`
 *
 * The marketplace variant returns only categories with at least one publicly
 * visible listing, which is right for a shopper's filter panel and wrong here: a
 * category nobody stocks yet would be invisible to the admin whose job is to create
 * it. `/categories` is the raw list.
 *
 * ## Orphans are surfaced, not dropped
 *
 * `buildCategoryTree` returns them separately. `/categories` returns every row so
 * the set is connected in practice, but the endpoint makes no such promise — and the
 * marketplace endpoint once broke exactly this way, silently losing whole subtrees
 * from the filter panel with no error anywhere. Rendering orphans with a warning
 * costs six lines and means a regression is visible instead of invisible.
 *
 * ## No pagination, deliberately
 *
 * `/categories` is flat and unpaginated on the API, and a taxonomy that needed
 * paging would be a taxonomy nobody could navigate. If this list ever grows past a
 * screen, the fix is a shallower tree, not a pager.
 */
export default async function CategoriesPage() {
  const { session } = await requireAdmin("/categories");
  const result = await categories.listAll(ctxFor(session));

  if (!result.ok) {
    return <ErrorState error={result.error} title="Couldn't load categories" />;
  }

  const { roots, orphans } = buildCategoryTree(result.data);
  const rows = flattenTree(roots);

  // Every category is a candidate parent for the create form. For an EDIT the
  // caller must exclude the category itself and its descendants, or the select
  // offers a choice the API is guaranteed to reject with CATEGORY_CYCLE.
  const allOptions: ParentOption[] = rows.map(({ category, depth }) => ({
    id: category.id,
    // U+00A0, not a plain space. A run of ordinary spaces COLLAPSES to one
    // inside an <option>, so the indentation that is the only cue to hierarchy in
    // a native select silently did not render. Verified in the served HTML.
    label: `${"\u00A0\u00A0\u00A0".repeat(depth)}${category.name}`,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-heading font-semibold tracking-tight">Categories</h1>
        <p className="text-body text-ink-muted">
          The shape of the catalogue. Every product hangs off this tree, and the
          storefront&apos;s filters are built from it.
        </p>
      </div>

      <Card>
        <h2 className="mb-4 text-section font-semibold">Add a category</h2>
        <CreateCategoryForm parents={allOptions} />
      </Card>

      {orphans.length > 0 && (
        <Card tone="flat" className="border-danger/40 bg-danger-soft">
          <div className="flex gap-3">
            <AlertTriangle
              className="size-5 shrink-0 text-danger"
              strokeWidth={1.75}
              aria-hidden
            />
            <div className="flex flex-col gap-1">
              <p className="text-caption font-semibold text-ink">
                {orphans.length} category with a missing parent
              </p>
              <p className="text-caption text-ink-muted">
                These point at a parent the API did not return, so they cannot be
                placed in the tree. They are listed below rather than dropped —
                silently losing them is how a whole subtree once disappeared from the
                storefront filters.
              </p>
            </div>
          </div>
        </Card>
      )}

      {rows.length === 0 && orphans.length === 0 ? (
        <EmptyState
          icon={<FolderTree className="size-6" strokeWidth={1.5} />}
          title="No categories yet"
          body="Add the first one above. Products can exist without a category, but nothing on the storefront can be browsed by one until this tree has something in it."
        />
      ) : (
        <Card padding="none">
          <ul className="divide-y divide-divider">
            {rows.map(({ category, depth }) => (
              <CategoryRow
                key={category.id}
                category={category}
                depth={depth}
                parentOptions={optionsExcludingSubtree(allOptions, category)}
              />
            ))}
            {orphans.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                depth={0}
                parentOptions={optionsExcludingSubtree(allOptions, category)}
              />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/**
 * Parent choices that cannot produce a cycle.
 *
 * Excludes the category itself and everything under it. The API refuses a cycle
 * with `CATEGORY_CYCLE`, so this is not the safety mechanism — it is the difference
 * between a control that only offers valid choices and one that lets an admin pick
 * something guaranteed to fail.
 */
function optionsExcludingSubtree(
  options: readonly ParentOption[],
  category: CategoryNode,
): ParentOption[] {
  const blocked = new Set<string>();
  const walk = (node: CategoryNode): void => {
    blocked.add(node.id);
    for (const child of node.children) walk(child);
  };
  walk(category);
  return options.filter((option) => !blocked.has(option.id));
}
