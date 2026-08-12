"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { shopperMessage } from "@rimalis/api-client";
import type { UpdateVendorListingBody } from "@rimalis/types";
import { ctxFor, requireApprovedVendor, vendor } from "./auth";

/**
 * Listing writes: price, stock cap, visibility, removal and restore.
 *
 * ## The `null` trap, which is the whole reason this file is careful
 *
 * `PATCH /vendor/products/:id` treats the three fields differently depending on
 * whether they are **absent** or **`null`**:
 *
 *   omitted        leave it alone
 *   null           CLEAR the override — fall back to the catalogue price / no cap
 *   a number       set it
 *
 * An HTML form submits an untouched empty input as `""`, and the obvious
 * `Number(value) || null` turns that into `null` — which **wipes a price the vendor
 * never touched**. That is a silent repricing of their own catalogue, triggered by
 * saving an unrelated field.
 *
 * So the parsing below is explicit about the three cases and never infers. An empty
 * string is only allowed to mean `null` when the form says the vendor deliberately
 * cleared it, which is what the `clearPrice` / `clearCap` checkboxes are for.
 *
 * ## Prices arrive in naira and go out as numbers
 *
 * `CreateVendorListingBody.vendorPrice` and the update body take a **number in
 * naira** — not kobo, and not a decimal string. That differs from every `Money` on
 * a response, which is a string. The conversion happens here, once.
 *
 * This is also the one place in the app that sends money *to* the API, so the rule in
 * `lib/money.ts` about display-only arithmetic does not apply — but the value must be
 * exactly what the vendor typed, never something computed from a total.
 */

export interface ListingState {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * A price in naira, as typed.
 *
 * `.multipleOf(0.01)` rather than an integer check: the column is `Decimal(12,2)`, so
 * kobo are legal and ₦1,999.99 must be accepted. Three decimals are not.
 */
const priceField = z
  .number()
  .positive("Enter a price above zero.")
  .max(99_999_999, "That price is too large.")
  .multipleOf(0.01, "Use at most two decimal places.");

const capField = z
  .number()
  .int("Use a whole number of units.")
  .min(0, "A cap cannot be negative.")
  .max(1_000_000, "That cap is too large.");

/** Turns a Zod failure into per-field copy. */
function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && errors[key] === undefined) errors[key] = issue.message;
  }
  return errors;
}

/**
 * Reads one numeric field into the three-way shape the API expects.
 *
 * Returns `undefined` for "leave alone", `null` for "clear", or a validated number.
 * See the header — this distinction is the point of the function.
 */
function readNumeric(
  formData: FormData,
  name: string,
  clearName: string,
  schema: z.ZodType<number>,
): { value: number | null | undefined } | { issue: string } {
  if (formData.get(clearName) !== null) return { value: null };

  const raw = String(formData.get(name) ?? "").trim();
  if (raw === "") return { value: undefined };

  const parsed = schema.safeParse(Number(raw));
  if (!parsed.success) {
    return { issue: parsed.error.issues[0]?.message ?? "That value isn't valid." };
  }
  return { value: parsed.data };
}

export async function updateListing(
  _previous: ListingState,
  formData: FormData,
): Promise<ListingState> {
  const listingId = String(formData.get("listingId") ?? "");
  if (!listingId) return { error: "Something was missing from that request." };

  const price = readNumeric(formData, "vendorPrice", "clearPrice", priceField);
  const cap = readNumeric(formData, "stockCap", "clearCap", capField);

  const fieldErrors: Record<string, string> = {};
  if ("issue" in price) fieldErrors["vendorPrice"] = price.issue;
  if ("issue" in cap) fieldErrors["stockCap"] = cap.issue;
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const body: UpdateVendorListingBody = {
    // Spread conditionally so an untouched field is genuinely ABSENT from the JSON
    // rather than present as `undefined` — which some serialisers drop and some send
    // as `null`, and only one of those is harmless here.
    ...("value" in price && price.value !== undefined ? { vendorPrice: price.value } : {}),
    ...("value" in cap && cap.value !== undefined ? { stockCap: cap.value } : {}),
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
