import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/primitives";
import { categories, ctxFor, requireAdmin } from "@/lib/auth";
import { buildCategoryTree, flattenTree } from "@/lib/category-tree";
import { ProductForm, type CategoryOption } from "./ProductForm";

export const metadata: Metadata = { title: "New product" };

/**
 * Add a product to the pool.
 *
 * A failed category load is not fatal: the field is optional, so the form renders
 * with an empty select rather than blocking the whole page on a supporting read.
 */
export default async function NewProductPage() {
  const { session } = await requireAdmin("/products/new");
  const result = await categories.listAll(ctxFor(session));

  const options: CategoryOption[] = result.ok
    ? flattenTree(buildCategoryTree(result.data).roots).map(({ category, depth }) => ({
        id: category.id,
        // U+00A0 as an ESCAPE, not a literal: an ordinary run of spaces collapses
        // to one inside an <option>, and a literal non-breaking space in source is
        // invisible to a reader and easily destroyed by a reformat.
        label: `${"\u00A0\u00A0\u00A0".repeat(depth)}${category.name}`,
      }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/products"
          prefetch={false}
          className="w-fit text-meta text-ink-muted underline decoration-divider-strong underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          ← All products
        </Link>
        <h1 className="text-heading font-semibold tracking-tight">New product</h1>
        <p className="text-body text-ink-muted">
          Vendors cannot create products — they buy stock of what is in this pool.
        </p>
      </div>

      <Card>
        <ProductForm categories={options} />
      </Card>
    </div>
  );
}
