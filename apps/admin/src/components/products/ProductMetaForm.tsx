"use client";

import { useActionState } from "react";
import type { PoolProductDetail } from "@rimalis/types";
import { Input, Textarea } from "@/components/primitives";
import { FormBanner, SubmitButton } from "@/components/forms";
import { updateProduct } from "@/lib/product-actions";
import type { FormState } from "@/lib/form-state";

export interface CategoryOption {
  id: string;
  label: string;
}

/**
 * Everything about a pool product that can be edited in place.
 *
 * ## SKU and stock are not here
 *
 * SKU is an identity other rows snapshotted — `OrderItem.productSkuSnapshot` exists
 * so order history survives a rename — and the API rejects it on PATCH. Stock moves
 * only through the adjustment form, which demands a reason and writes an audit
 * entry. Both are shown read-only rather than omitted, so an admin can see the value
 * and see that it is not editable here.
 *
 * ## Both prices in one form, on purpose
 *
 * `costPrice >= retailPrice` is refused, and the check needs both values. Splitting
 * them into two forms would mean a save that is valid on its own and invalid
 * together, with no field to attach the error to.
 */
export function ProductMetaForm({
  product,
  categories,
}: {
  product: PoolProductDetail;
  categories: readonly CategoryOption[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(updateProduct, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="productId" value={product.id} />

      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}
      {state.message && <FormBanner tone="success">{state.message}</FormBanner>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-caption font-medium">SKU</span>
          <p className="flex h-11 items-center rounded-input bg-canvas px-3 font-mono text-caption text-ink-muted">
            {product.sku}
          </p>
          <span className="text-meta text-ink-subtle">
            Generated from the name at creation. Fixed — orders snapshot it, so a
            change would rewrite history.
          </span>
        </div>
        <Input
          label="Name"
          name="name"
          defaultValue={product.name}
          error={state.fieldErrors?.["name"]}
        />
      </div>

      <Textarea
        label="Description"
        name="description"
        rows={3}
        defaultValue={product.description ?? ""}
        error={state.fieldErrors?.["description"]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Retail price"
          name="retailPrice"
          type="text"
          inputMode="decimal"
          defaultValue={product.retailPrice}
          hint="What shoppers pay."
          error={state.fieldErrors?.["retailPrice"]}
        />
        <Input
          label="Cost price"
          name="costPrice"
          type="text"
          inputMode="decimal"
          defaultValue={product.costPrice}
          hint="What vendors pay us. Must stay below retail — the gap is their margin, and commission is charged on it."
          error={state.fieldErrors?.["costPrice"]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label="Low stock at"
          name="lowStockAt"
          type="text"
          inputMode="numeric"
          defaultValue={String(product.lowStockAt)}
          hint="Alert threshold for this product."
          error={state.fieldErrors?.["lowStockAt"]}
        />
        <Input
          label="Weight (grams)"
          name="weightGrams"
          type="text"
          inputMode="numeric"
          defaultValue={product.weightGrams === null ? "" : String(product.weightGrams)}
          error={state.fieldErrors?.["weightGrams"]}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-caption font-medium">Category</span>
          <select
            name="categoryId"
            defaultValue={product.categoryId ?? ""}
            className="h-11 rounded-input border border-divider-strong bg-surface px-3 text-caption focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            {/* Empty CLEARS the category — the action maps "" to null. On this form
                the field is always submitted, so there is no "unchanged" state to
                confuse it with. */}
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <SubmitButton>Save changes</SubmitButton>
      </div>
    </form>
  );
}
