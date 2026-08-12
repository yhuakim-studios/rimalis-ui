"use client";

import { useActionState, useState } from "react";
import type { VendorListing } from "@rimalis/types";
import { updateListing, type ListingState } from "@/lib/listing-actions";
import { FormBanner, SubmitButton } from "@/components/forms";
import { Button, Input } from "@/components/primitives";

/**
 * Edit one listing's price and stock cap.
 *
 * ## The clear-vs-leave-alone problem, solved in the UI as well as the action
 *
 * The API distinguishes three intents per field: omit (leave alone), `null` (clear the
 * override), or a number. HTML gives a form one way to say "empty", so the intent has
 * to be captured explicitly — which is what the two checkboxes do.
 *
 * Without them, an untouched empty price input submits `""`, the obvious parse turns
 * that into `null`, and **saving a stock cap silently wipes the vendor's price**. The
 * server action guards this too (see its header); this side makes the choice visible
 * rather than merely safe.
 *
 * The checkbox is only rendered when there is something to clear. "Use catalogue
 * price" on a listing that already uses it is a control whose only possible effect is
 * nothing.
 *
 * ## Collapsed by default
 *
 * A vendor with forty listings is scanning, not editing. Two number inputs and two
 * checkboxes per row would make the page unreadable, so the editor opens on demand
 * and the card carries the current figures. `useState` rather than `<details>` because
 * the panel needs to close itself after a successful save.
 */
export function PriceEditor({ listing }: { listing: VendorListing }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ListingState, FormData>(updateListing, {});

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Edit price
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-3" noValidate>
      <input type="hidden" name="listingId" value={listing.id} />

      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}
      {state.message && <FormBanner tone="success">{state.message}</FormBanner>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Input
            label="Your price (₦)"
            name="vendorPrice"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            // `defaultValue`, not `value`: this is an uncontrolled field so the
            // vendor's typing survives a failed submit without a controlled-state
            // round trip.
            defaultValue={listing.vendorPrice ?? ""}
            placeholder={listing.product.basePrice}
            hint={
              listing.vendorPrice === null
                ? "Empty means you follow the catalogue price."
                : "Leave empty to keep your current price."
            }
            error={state.fieldErrors?.["vendorPrice"]}
          />

          {listing.vendorPrice !== null && (
            <label className="flex items-center gap-2 text-meta text-ink-muted">
              <input
                type="checkbox"
                name="clearPrice"
                className="size-4 rounded border-divider-strong accent-brand-600"
              />
              Go back to the catalogue price
            </label>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Input
            label="Stock cap (units)"
            name="stockCap"
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            defaultValue={listing.stockCap ?? ""}
            hint={`Shared pool has ${String(listing.product.stock)}. A cap above that does nothing.`}
            error={state.fieldErrors?.["stockCap"]}
          />

          {listing.stockCap !== null && (
            <label className="flex items-center gap-2 text-meta text-ink-muted">
              <input
                type="checkbox"
                name="clearCap"
                className="size-4 rounded border-divider-strong accent-brand-600"
              />
              Remove the cap
            </label>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <SubmitButton>Save</SubmitButton>
        <Button type="button" variant="tertiary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
