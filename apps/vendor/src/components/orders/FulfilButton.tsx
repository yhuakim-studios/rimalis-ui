"use client";

import { useActionState } from "react";
import type { FulfillmentStatus } from "@rimalis/types";
import { advanceLine, type FulfilState } from "@/lib/order-actions";
import { SubmitButton } from "@/components/forms";
import { nextFulfillmentStep } from "@/lib/format";

/**
 * Advance one line by one step.
 *
 * ## One button, not a status dropdown
 *
 * Fulfilment is a forward-only chain — `PENDING → PROCESSING → SHIPPED →
 * DELIVERED`. A `<select>` would offer backwards and skipping transitions that the
 * API rejects with a 400, so most of its options exist only to fail. A single button
 * labelled with the actual next step ("Start packing", "Mark shipped") can only
 * express something legal, and it says what will happen rather than asking the vendor
 * to know the state machine.
 *
 * `DELIVERED` renders nothing at all rather than a disabled control: there is no
 * un-ship and no step after delivery, and a greyed-out button implies something is
 * possible later.
 *
 * The target status is submitted rather than derived server-side — see the header of
 * `order-actions.ts` for why that makes a stale click recoverable.
 */
export function FulfilButton({
  orderId,
  itemId,
  current,
}: {
  orderId: string;
  itemId: string;
  current: FulfillmentStatus;
}) {
  const [state, formAction] = useActionState<FulfilState, FormData>(advanceLine, {});
  const step = nextFulfillmentStep(current);

  if (!step) return null;

  return (
    <form action={formAction} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="to" value={step.to} />

      <SubmitButton variant="secondary">{step.label}</SubmitButton>

      {/*
        `role="alert"` so the failure is announced. It sits under the button rather
        than in a page-level banner because the vendor's attention is here, and a
        message at the top of a long order is a message nobody sees.
      */}
      {state.error && (
        <p role="alert" className="max-w-[220px] text-right text-meta text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
