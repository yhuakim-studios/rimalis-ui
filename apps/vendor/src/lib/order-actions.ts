"use server";

import { revalidatePath } from "next/cache";
import { shopperMessage } from "@rimalis/api-client";
import type { AdvanceFulfillmentBody } from "@rimalis/types";
import { ctxFor, requireApprovedVendor, vendor } from "./auth";

/**
 * Fulfilment — the only write a vendor makes against an order.
 *
 * ## Why the target status travels from the client
 *
 * The button knows which step it is offering, and the server re-derives nothing. A
 * "next step" computed here from a freshly-read order would silently do something
 * *different* from what the button said if the order moved in between — a vendor
 * clicking "Mark shipped" would get "Start packing" applied. Sending the intended
 * target means a stale click is a 400 `INVALID_TRANSITION` from the API rather than
 * a wrong write, and a rejected click is recoverable where a wrong one is not.
 *
 * ## Why `revalidatePath` and not a returned payload
 *
 * `PATCH .../items/:itemId` returns the whole order, because advancing the last
 * outstanding line rolls the *order's* status up. Rather than thread that response
 * into client state, the path is revalidated and the server re-renders — so the
 * header badge, the line badges and the dashboard's counts all move together. Patching
 * one row in place is how a page ends up showing "Shipped" on every line above an
 * order header that still says "Ready to pick".
 */

export interface FulfilState {
  error?: string;
}

export async function advanceLine(
  _previous: FulfilState,
  formData: FormData,
): Promise<FulfilState> {
  const orderId = String(formData.get("orderId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const to = String(formData.get("to") ?? "");

  if (!orderId || !itemId) return { error: "Something was missing from that request." };
  if (to !== "PROCESSING" && to !== "SHIPPED" && to !== "DELIVERED") {
    return { error: "That isn't a fulfilment step we recognise." };
  }

  const body: AdvanceFulfillmentBody = { fulfillmentStatus: to };

  // Re-checks the session AND the approval on every write. A vendor suspended
  // while this page was open must not still be able to ship — and because
  // `requireVendor` on the API is a live database check, the API would refuse it
  // anyway; this makes the refusal a redirect to the suspended screen instead of
  // an unexplained error under a button.
  const { session } = await requireApprovedVendor(`/orders/${orderId}`);

  const result = await vendor.advanceFulfillment(ctxFor(session), orderId, itemId, body);

  if (!result.ok) {
    const { error } = result;

    if (vendor.isInvalidTransition(error)) {
      return {
        error:
          "This line has already moved on. We've refreshed the order — check where it is now.",
      };
    }
    if (error.kind === "http" && error.status === 404) {
      return { error: "We couldn't find that line on this order any more." };
    }
    return { error: shopperMessage(error) };
  }

  // The detail page for the header and line badges; the list and dashboard because
  // the order's rolled-up status and the outstanding count both change.
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/");

  return {};
}
