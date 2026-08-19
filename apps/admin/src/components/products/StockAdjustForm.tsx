"use client";

import { useActionState } from "react";
import { Input, Textarea } from "@/components/primitives";
import { FormBanner, SubmitButton } from "@/components/forms";
import { adjustStock } from "@/lib/product-actions";
import type { FormState } from "@/lib/form-state";

/**
 * Move the platform pool by a signed delta.
 *
 * ## A delta, never "set stock to N"
 *
 * Two admins reading the same stale page and both setting 100 lose one of the
 * adjustments silently. Two deltas of +50 both land. The endpoint is a delta on
 * purpose and this form must not paper over it with an absolute field — which is the
 * obvious "friendlier" design and the one that loses inventory.
 *
 * ## The reason is required, and the copy says where it goes
 *
 * It is recorded in the audit trail against the acting admin. This is the field that
 * answers "why is there 40 less stock than the purchase orders say" six months
 * later, and the audit table exists precisely because three endpoints used to
 * validate a reason and then discard it.
 *
 * ## What a negative delta can and cannot take
 *
 * Only UNSOLD units. Stock a vendor has already bought is theirs — it lives on their
 * listing, not in the pool — so the pool cannot go below zero and the API returns
 * INSUFFICIENT_STOCK. Said here rather than only in the error, because an admin
 * expecting to "recall" stock from vendors needs to know they cannot.
 */
export function StockAdjustForm({
  productId,
  currentStock,
}: {
  productId: string;
  currentStock: number;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(adjustStock, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="productId" value={productId} />

      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}
      {state.message && <FormBanner tone="success">{state.message}</FormBanner>}

      <p className="text-caption text-ink-muted">
        The pool holds{" "}
        <strong className="font-semibold tabular-nums text-ink">
          {currentStock}
        </strong>{" "}
        unsold units. Adjusting it does not touch stock vendors have already bought —
        those units are theirs.
      </p>

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-[140px]">
          <Input
            label="Adjustment"
            name="delta"
            type="text"
            inputMode="numeric"
            required
            placeholder="+50 or -10"
            hint="Signed, and not zero."
            error={state.fieldErrors?.["delta"]}
          />
        </div>
        <div className="min-w-[240px] flex-1">
          <Textarea
            label="Reason"
            name="reason"
            rows={2}
            required
            hint="Recorded in the activity log against your account. Required."
            error={state.fieldErrors?.["reason"]}
          />
        </div>
      </div>

      <div>
        <SubmitButton variant="secondary">Adjust pool stock</SubmitButton>
      </div>
    </form>
  );
}
