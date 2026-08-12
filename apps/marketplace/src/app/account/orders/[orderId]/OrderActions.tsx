"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/primitives";
import { cancelOrder, retryPayment } from "@/lib/checkout-actions";

/**
 * Pay, or cancel, from an order page.
 *
 * ## "Pay now" is always an explicit press
 *
 * `POST /payments/initialize` has **no idempotency guard** — every call creates a
 * new Paystack transaction. So nothing here fires on mount, on focus, or as a
 * retry after a failure; a charge attempt is always something a person chose.
 *
 * ## Cancelling confirms, and says what it does
 *
 * It is irreversible from the shopper's side: there is no "un-cancel", and
 * re-placing the order means re-adding everything at whatever price and stock
 * exists then. The second button says "Yes, cancel it" rather than "OK", because
 * a confirm dialog whose buttons could each mean either thing is worse than none.
 */

export function OrderActions({
  orderId,
  payable,
  cancellable,
}: {
  orderId: string;
  payable: boolean;
  cancellable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!payable && !cancellable) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {payable && (
        <Button
          size="lg"
          loading={pending && !confirming}
          onClick={() => startTransition(async () => void (await retryPayment(orderId)))}
        >
          Pay now
        </Button>
      )}

      {cancellable &&
        (confirming ? (
          <>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => startTransition(async () => void (await cancelOrder(orderId)))}
            >
              Yes, cancel it
            </Button>
            <Button variant="tertiary" onClick={() => setConfirming(false)}>
              Keep the order
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Cancel order
          </Button>
        ))}
    </div>
  );
}
