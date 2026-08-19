"use client";

import { useActionState } from "react";
import { Input, Textarea } from "@/components/primitives";
import { FormBanner, SubmitButton } from "@/components/forms";
import { createProduct } from "@/lib/product-actions";
import type { FormState } from "@/lib/form-state";

export interface CategoryOption {
  id: string;
  label: string;
}

/**
 * Create a product in the pool.
 *
 * ## What the copy has to carry
 *
 * Two prices with very different meanings sit next to each other, and getting them
 * the wrong way round is not a validation error the admin will recognise — it is a
 * product every vendor loses money on. So each field says who pays it, and the
 * hint under cost names the consequence rather than the rule.
 *
 * ## No image field here
 *
 * Images need a product id to upload against — the object path is
 * `<productId>/<uuid>.<ext>`, generated server-side — so they are added on the edit
 * screen, and the action redirects there. A DRAFT product cannot be published until
 * it has one, which is the next thing that screen says.
 */
export function ProductForm({ categories }: { categories: readonly CategoryOption[] }) {
  const [state, formAction] = useActionState<FormState, FormData>(createProduct, {});

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="SKU"
          name="sku"
          required
          placeholder="IPHN-13-128-MID"
          hint="Letters, numbers and dashes. Cannot be changed later — orders snapshot it."
          error={state.fieldErrors?.["sku"]}
        />
        <Input
          label="Name"
          name="name"
          required
          placeholder="Apple iPhone 13 128GB"
          error={state.fieldErrors?.["name"]}
        />
      </div>

      <Textarea
        label="Description"
        name="description"
        rows={3}
        hint="Shown on the storefront product page."
        error={state.fieldErrors?.["description"]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Retail price"
          name="retailPrice"
          // Text with a decimal hint, not type="number": a number input's scroll
          // wheel silently changes the value on a page an admin is reading, and this
          // is a price.
          type="text"
          inputMode="decimal"
          required
          placeholder="450000"
          hint="What shoppers pay. The same for every vendor carrying it."
          error={state.fieldErrors?.["retailPrice"]}
        />
        <Input
          label="Cost price"
          name="costPrice"
          type="text"
          inputMode="decimal"
          required
          placeholder="380000"
          hint="What a vendor pays us per unit. The gap is their margin, and commission is charged on that gap — so it has to be worth their money."
          error={state.fieldErrors?.["costPrice"]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label="Opening pool stock"
          name="stock"
          type="text"
          inputMode="numeric"
          placeholder="0"
          hint="Units vendors can buy. Optional — 0 is fine."
          error={state.fieldErrors?.["stock"]}
        />
        <Input
          label="Low stock at"
          name="lowStockAt"
          type="text"
          inputMode="numeric"
          placeholder="5"
          hint="Alert threshold for this product."
          error={state.fieldErrors?.["lowStockAt"]}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-caption font-medium">Category</span>
          <select
            name="categoryId"
            defaultValue=""
            className="h-11 rounded-input border border-divider-strong bg-surface px-3 text-caption focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
          <span className="text-meta text-ink-subtle">
            Optional, but the storefront can only be browsed by category.
          </span>
        </label>
      </div>

      <div>
        <SubmitButton size="lg">Create as draft</SubmitButton>
        <p className="mt-2 text-meta text-ink-subtle">
          Created as a draft and invisible to vendors. You will land on its page to
          add an image — a product cannot be published without one.
        </p>
      </div>
    </form>
  );
}
