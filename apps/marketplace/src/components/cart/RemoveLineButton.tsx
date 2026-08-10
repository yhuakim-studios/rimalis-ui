"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { removeFromCart } from "@/lib/cart-actions";

/**
 * "Remove" on a cart line.
 *
 * ## No confirmation dialog, on purpose
 *
 * Removing a line is cheap to undo — the product is one click away and the page
 * says which store it came from. A confirm step on a destructive-looking but
 * trivially reversible action trains people to dismiss confirmations, which is
 * what makes the ones that matter useless.
 *
 * ## A text label, not just the icon
 *
 * The icon alone would be smaller and tidier and would also be the control most
 * likely to be pressed by accident on a phone. "Remove" beside it costs a few
 * pixels and removes the ambiguity entirely.
 */

export function RemoveLineButton({
  listingId,
  productName,
}: {
  listingId: string;
  productName: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      // No `router.refresh()`: the action's `revalidatePath` is what re-renders
      // the basket and the header badge. See the note in QuantityStepper — a
      // refresh on top measured slower for the same result.
      onClick={() => startTransition(async () => void (await removeFromCart(listingId)))}
      // The visible label is just "Remove"; the accessible name says what from.
      // Several identical "Remove" buttons in a list are unusable by voice or by
      // screen reader without this.
      aria-label={`Remove ${productName} from your basket`}
      className="inline-flex min-h-11 items-center gap-2 text-caption text-ink-muted transition-colors duration-150 ease-out-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
      Remove
    </button>
  );
}
