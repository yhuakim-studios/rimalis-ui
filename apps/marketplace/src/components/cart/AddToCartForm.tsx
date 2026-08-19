"use client";

import { useState, useTransition } from "react";
import { Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/primitives";
import { addToCart } from "@/lib/cart-actions";

/**
 * Quantity + "Add to cart", on the product page.
 *
 * ## Why this does not navigate to the cart
 *
 * Adding an item and being thrown out of the product page is how a shopper who
 * wanted two things ends up buying one. The button confirms in place and the
 * header count updates; the route to the basket is the header, which is where
 * they would look anyway.
 *
 * ## The confirmation is time-boxed, not permanent
 *
 * "Added" reverts to "Add to cart" after a couple of seconds. A button stuck on
 * "Added" reads as disabled, and a shopper who wants a third unit assumes it
 * stopped working.
 *
 * ## The header badge updates from the action, not from a refresh here
 *
 * `addToCart` ends with `revalidatePath("/", "layout")`, and the badge lives in
 * the root layout, so it re-renders on its own. A `router.refresh()` here was
 * tried and removed — it produced a second render for the same result. See the
 * note in `QuantityStepper` for the measurements.
 */

export interface AddToCartFormProps {
  listingId: string;
  /** `0` when out of stock; the button renders disabled and says so. */
  available: number;
  productName: string;
}

export function AddToCartForm({ listingId, available, productName }: AddToCartFormProps) {
  const [pending, startTransition] = useTransition();
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const outOfStock = available <= 0;

  const submit = () => {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await addToCart(listingId, quantity);

      if (!result.ok) {
        setError(result.message ?? "We couldn't add that. Please try again.");
        return;
      }

      // A clamped add still succeeded — `result.message` explains why the
      // basket has fewer units than were asked for. Saying nothing is how a
      // shopper ends up with one of something they wanted three of.
      if (result.message) setMessage(result.message);

      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    });
  };

  if (outOfStock) {
    return (
      <div className="flex flex-col gap-3">
        <Button size="lg" fullWidth disabled>
          Out of stock
        </Button>
        <p className="text-caption text-ink-muted">
          This seller has none left. The same product may be available from another store.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center rounded-pill border border-divider-strong bg-surface">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            aria-label={`Decrease quantity of ${productName}`}
            className="grid size-11 place-items-center rounded-pill text-ink transition-colors duration-150 hover:bg-divider/60 disabled:cursor-not-allowed disabled:text-ink-subtle"
          >
            <Minus className="size-4" strokeWidth={2} />
          </button>
          <span
            className="min-w-10 text-center text-body tabular-nums text-ink"
            aria-live="polite"
            aria-label={`Quantity of ${productName}`}
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(available, q + 1))}
            disabled={quantity >= available}
            aria-label={`Increase quantity of ${productName}`}
            className="grid size-11 place-items-center rounded-pill text-ink transition-colors duration-150 hover:bg-divider/60 disabled:cursor-not-allowed disabled:text-ink-subtle"
          >
            <Plus className="size-4" strokeWidth={2} />
          </button>
        </div>

        <Button
          size="lg"
          loading={pending}
          onClick={submit}
          icon={
            added ? (
              <Check className="size-5" strokeWidth={2} />
            ) : (
              <ShoppingCart className="size-5" strokeWidth={1.75} />
            )
          }
        >
          {added ? "Added to basket" : "Add to cart"}
        </Button>
      </div>

      {/* `role="status"` rather than `alert` — a confirmation should not
          interrupt, and this one is additive information about something that
          already worked. */}
      {message && (
        <p role="status" className="text-caption text-ink-muted">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
