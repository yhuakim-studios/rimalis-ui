"use client";

import { useActionState } from "react";
import type { ProductAttribute } from "@rimalis/types";
import { Input } from "@/components/primitives";
import { FormBanner, SubmitButton } from "@/components/forms";
import { ConfirmAction } from "@/components/admin";
import { addAttribute, removeAttribute } from "@/lib/product-actions";
import type { FormState } from "@/lib/form-state";

/**
 * Name/value pairs shown on the storefront product page — "Colour: Midnight Black".
 *
 * There is no update endpoint, only add and delete, so editing a value means
 * removing and re-adding. The UI does not pretend otherwise: no edit affordance,
 * because one would have to fake itself out of two requests and could half-fail,
 * leaving the attribute deleted and not replaced.
 */
export function AttributeEditor({
  productId,
  attributes,
}: {
  productId: string;
  attributes: readonly ProductAttribute[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(addAttribute, {});

  return (
    <div className="flex flex-col gap-4">
      {attributes.length === 0 ? (
        <p className="text-caption text-ink-muted">
          None yet. These appear as a spec table on the storefront.
        </p>
      ) : (
        <ul className="divide-y divide-divider">
          {attributes.map((attribute) => (
            <li
              key={attribute.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2"
            >
              <span className="text-caption font-medium">{attribute.name}</span>
              <span className="text-caption text-ink-muted">{attribute.value}</span>
              <span className="ml-auto">
                <ConfirmAction
                  action={removeAttribute}
                  label="Remove"
                  confirmLabel="Remove"
                  consequence="There is no edit endpoint — to change a value, remove it and add it again."
                  hidden={{ productId, attributeId: attribute.id }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="productId" value={productId} />
        <div className="min-w-[160px] flex-1">
          <Input
            label="Name"
            name="name"
            placeholder="Colour"
            error={state.fieldErrors?.["name"]}
          />
        </div>
        <div className="min-w-[160px] flex-1">
          <Input
            label="Value"
            name="value"
            placeholder="Midnight Black"
            error={state.fieldErrors?.["value"]}
          />
        </div>
        <SubmitButton variant="secondary">Add</SubmitButton>
      </form>

      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}
      {state.message && <FormBanner tone="success">{state.message}</FormBanner>}
    </div>
  );
}
