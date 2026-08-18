"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { shopperMessage } from "@rimalis/api-client";
import type { StockPurchaseStatus, UpdateVendorListingBody } from "@rimalis/types";
import { ctxFor, requireApprovedVendor, vendor } from "./auth";

/**
 * Listing writes: buying stock, visibility, removal and restore.
 *
 * ## Buying stock is a redirect, not a mutation
 *
 * `buyStock` does not create anything. It opens a Paystack payment and sends the
 * vendor away; the listing is created by the webhook when the money lands. So the
 * success path of that action is a `redirect()`, and the only states it can report
 * back are failures to even start.
 *
 * ## The `null` trap is gone, along with the fields that caused it
 *
 * This file used to be elaborate because `PATCH /vendor/products/:id` distinguished
 * absent from `null` on `vendorPrice` and `stockCap`, and an untouched empty input
 * serialised as `null` would silently wipe a price the vendor had set. Both columns
 * are gone — the admin sets one retail price, and a vendor's ceiling is the stock
 * they bought — so the update body is now `isActive` alone and `readNumeric`,
 * `priceField` and `capField` went with them.
 *
 * ## Quantity goes out as a number
 *
 * The one value this app still sends to the API. It must be exactly what the vendor
 * typed — never derived from a total — because it is multiplied by the cost price to
 * decide what they are charged.
 */

export interface ListingState {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * How many units to buy.
 *
 * Capped at 1000 to match the API, which caps it as a blast radius rather than a
 * business rule: a fat-fingered 100000 on a ₦300,000 product is a ₦30bn Paystack
 * transaction, and buying twice is a far cheaper failure than that.
 */
const quantityField = z
  .number()
  .int("Buy whole units.")
  .min(1, "Buy at least one unit.")
  .max(1000, "Buy at most 1000 units at a time.");

/**
 * Start a stock purchase and send the vendor to Paystack.
 *
 * ## This does not create a listing
 *
 * It reserves the units out of the pool, opens a PENDING purchase and returns a
 * payment URL. The listing appears when the webhook confirms the charge. So there
 * is nothing to revalidate on the way out — there is no new state yet — and the
 * function does not return on success.
 *
 * ## `redirect()` throws
 *
 * Next implements `redirect()` by throwing a control-flow error that the framework
 * catches. Calling it inside a `try` would have the `catch` swallow the redirect and
 * report it as a failure, so it sits deliberately outside and after all error
 * handling.
 */
export async function buyStock(
  _previous: ListingState,
  formData: FormData,
): Promise<ListingState> {
  const productId = String(formData.get("productId") ?? "");
  if (!productId) return { error: "Something was missing from that request." };

  const raw = String(formData.get("quantity") ?? "").trim();
  if (raw === "") return { fieldErrors: { quantity: "Enter how many units to buy." } };

  const parsed = quantityField.safeParse(Number(raw));
  if (!parsed.success) {
    return {
      fieldErrors: {
        quantity: parsed.error.issues[0]?.message ?? "That quantity isn't valid.",
      },
    };
  }

  const { session } = await requireApprovedVendor("/products/add");
  const result = await vendor.initiateStockPurchase(ctxFor(session), {
    productId,
    quantity: parsed.data,
  });

  if (!result.ok) {
    if (vendor.isInsufficientPoolStock(result.error)) {
      return {
        error:
          "Rimalis doesn't have that many units left — another vendor may have just bought some. Refresh to see what's available and try a smaller quantity.",
      };
    }
    if (vendor.isProductCostNotSet(result.error)) {
      return {
        error:
          "Rimalis hasn't set a vendor price for this product yet, so it can't be bought. It'll become available once they do.",
      };
    }
    if (vendor.isProductNotAvailable(result.error)) {
      return {
        error:
          "Rimalis has withdrawn this product since this page loaded. Refresh to see what's still available.",
      };
    }
    if (result.error.kind === "http" && result.error.status === 404) {
      return { error: "That product no longer exists in the catalogue." };
    }
    return { error: shopperMessage(result.error) };
  }

  // Outside any try/catch — see the header. Nothing below this line runs.
  redirect(result.data.authorizationUrl);
}

/** What the return page's poller needs to know about a purchase. */
export interface PurchaseCheck {
  status: StockPurchaseStatus | null;
  /** The listing the purchase created or topped up. `null` until it succeeds. */
  vendorProductId: string | null;
  /** `true` when we could not ask — not when the answer was "still pending". */
  unreachable: boolean;
}

/**
 * Ask the API where a stock purchase got to. Called on a timer by the return page.
 *
 * ## Reading is the only safe thing to do here
 *
 * This is a `GET`. It must never fall back to `initiateStockPurchase` on a
 * `PENDING`, however tempting a "retry" looks from the UI: that endpoint has no
 * idempotency key, so a second call reserves a second batch out of the pool and
 * opens a second Paystack transaction. A vendor who pays twice has bought twice,
 * and the stock really is theirs.
 *
 * ## `SUCCESS` revalidates, because the listing did not exist a moment ago
 *
 * The webhook creates the `VendorProduct` out of band, so `/products` was
 * rendered and cached before there was anything to show. Without this the vendor
 * follows the success panel's link and lands on a listings page that still does
 * not include what they just bought.
 */
export async function checkStockPurchase(purchaseId: string): Promise<PurchaseCheck> {
  const { session } = await requireApprovedVendor(`/products/purchases/${purchaseId}`);
  const result = await vendor.getStockPurchase(ctxFor(session), purchaseId);

  if (!result.ok) {
    // A 404 here is "no such purchase for you" and is final, not "not yet" — the
    // row is written before Paystack is ever called. Anything else transport-
    // shaped means we could not ask, and the poller stops pestering the API.
    return { status: null, vendorProductId: null, unreachable: true };
  }

  if (result.data.status === "SUCCESS") {
    revalidatePath("/products");
    revalidatePath("/");
  }

  return {
    status: result.data.status,
    vendorProductId: result.data.vendorProductId,
    unreachable: false,
  };
}

/**
 * Switch a listing on or off from the full editor.
 *
 * Down to one field now that price and stock are not the vendor's to set. Kept as a
 * `useActionState` action because the products page still renders it as a form with
 * a saved/failed banner.
 */
export async function updateListing(
  _previous: ListingState,
  formData: FormData,
): Promise<ListingState> {
  const listingId = String(formData.get("listingId") ?? "");
  if (!listingId) return { error: "Something was missing from that request." };

  const body: UpdateVendorListingBody = {
    ...(formData.get("isActive") !== null ? { isActive: formData.get("isActive") === "on" } : {}),
  };

  const { session } = await requireApprovedVendor("/products");
  const result = await vendor.updateListing(ctxFor(session), listingId, body);

  if (!result.ok) {
    if (result.error.kind === "http" && result.error.status === 404) {
      return { error: "That listing no longer exists." };
    }
    return { error: shopperMessage(result.error) };
  }

  revalidatePath("/products");
  return { message: "Saved." };
}

/**
 * Switch a listing on or off, on its own.
 *
 * Separate from `updateListing` so the toggle can be a one-field form. Routing it
 * through the full editor would mean the toggle submitted the price inputs too, and
 * an empty-but-untouched price field is exactly the `null` hazard above.
 */
export async function setListingActive(formData: FormData): Promise<void> {
  const listingId = String(formData.get("listingId") ?? "");
  const isActive = String(formData.get("isActive") ?? "") === "true";
  if (!listingId) return;

  const { session } = await requireApprovedVendor("/products");
  await vendor.updateListing(ctxFor(session), listingId, { isActive });

  revalidatePath("/products");
  revalidatePath("/");
}

/**
 * Soft delete. Reversible via `restore`, which is why the copy says "remove" rather
 * than "delete" and why the removed row stays visible behind a filter.
 *
 * Historical order items are untouched — they carry their own name and price
 * snapshots precisely so that removing a listing never rewrites what somebody
 * already bought.
 */
export async function removeListing(formData: FormData): Promise<void> {
  const listingId = String(formData.get("listingId") ?? "");
  if (!listingId) return;

  const { session } = await requireApprovedVendor("/products");
  await vendor.removeListing(ctxFor(session), listingId);

  revalidatePath("/products");
  revalidatePath("/");
}

/**
 * Undo a removal.
 *
 * ⚠️ Clears `deletedAt` and **does not touch `isActive`** — a listing removed while
 * switched off comes back switched off. That is the honest outcome, but it reads as
 * "restore didn't work" if the vendor only checks whether the row reappeared on the
 * storefront, so the products page labels the two states separately.
 */
export async function restoreListing(formData: FormData): Promise<void> {
  const listingId = String(formData.get("listingId") ?? "");
  if (!listingId) return;

  const { session } = await requireApprovedVendor("/products");
  await vendor.restoreListing(ctxFor(session), listingId);

  revalidatePath("/products");
  revalidatePath("/");
}
