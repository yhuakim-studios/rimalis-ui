"use client";

import { useState, useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/components/primitives";
import { setQuantity } from "@/lib/cart-actions";

/**
 * − / value / + for one cart line.
 *
 * ## Optimistic, but only about the number
 *
 * The displayed quantity updates immediately and the server action runs behind
 * it, because a stepper that waits for a round trip before moving feels broken —
 * shoppers press it several times in a row and each press should land.
 *
 * What is NOT optimistic is the price: the line total and the subtotal come from
 * the server render, because `lib/money.ts` keeps all money arithmetic on the
 * server. So the quantity moves at once and the total follows when the action's
 * `revalidatePath` lands.
 *
 * **That gap is not milliseconds.** Measured against the live API, the action
 * takes ~3.5s (it re-reads the listing) and the re-rendered total arrives at
 * ~6s, because the cart page re-reads every line. So the stepper is visibly
 * ahead of the money for several seconds, and `pending` dimming the control is
 * the only thing saying why. If that gap is ever worth closing, the fix is a
 * bulk listing endpoint on the API — not client-side arithmetic.
 *
 * There is deliberately **no `router.refresh()`** here. It was tried: the
 * action's `revalidatePath("/", "layout")` already updates the page and the
 * header badge, and adding a refresh on top only bought a second render — the
 * total arrived at 7.3s instead of 6.2s.
 *
 * If the action clamps the value — someone asked for 5 and there are 2 — the
 * server's number wins on the next render and the local state is reset to it.
 *
 * ## Why the buttons are not `<IconButton>`
 *
 * `IconButton` is 44×44 and pill-shaped, sized for standalone controls in a
 * header. These two are halves of one grouped control and share its border, so
 * they use the group's own shape. They keep the 44px touch target, which is the
 * part that actually matters.
 */

export interface QuantityStepperProps {
  listingId: string;
  quantity: number;
  /** The most the seller can supply. The `+` disables here. */
  max: number;
  /** Announced with the control, so several steppers on a page are distinguishable. */
  productName: string;
}

export function QuantityStepper({
  listingId,
  quantity,
  max,
  productName,
}: QuantityStepperProps) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(quantity);

  // The server is the source of truth. When a re-render arrives with a different
  // quantity — because the action clamped it, or another tab changed it — adopt
  // it rather than keeping a local number that is now a fiction.
  const [lastServerValue, setLastServerValue] = useState(quantity);
  if (quantity !== lastServerValue) {
    setLastServerValue(quantity);
    setValue(quantity);
  }

  const change = (next: number) => {
    if (next < 0 || next > max) return;
    setValue(next);
    startTransition(async () => {
      await setQuantity(listingId, next);
    });
  };


  return (
    <div
      className={cn(
        "inline-flex items-center rounded-pill border border-divider-strong bg-surface",
        pending && "opacity-60",
      )}
      // The whole group is one control as far as assistive tech is concerned, and
      // `aria-busy` says the change is in flight without each button claiming it.
      aria-busy={pending || undefined}
    >
      <button
        type="button"
        onClick={() => change(value - 1)}
        disabled={value <= 1}
        // Naming the product matters on a cart page: "decrease quantity" three
        // times over tells a screen-reader user nothing about which line moved.
        aria-label={`Decrease quantity of ${productName}`}
        className="grid size-11 place-items-center rounded-pill text-ink transition-colors duration-150 hover:bg-divider/60 disabled:cursor-not-allowed disabled:text-ink-subtle"
      >
        <Minus className="size-4" strokeWidth={2} />
      </button>

      {/*
        Text, not an `<input type="number">`. A number input on a cart line is a
        trap: it accepts "2e3" and "-1", its spinners are 12px tall on desktop,
        and on mobile it opens a keypad the shopper then has to dismiss. The
        quantities here are 1–99 and always reachable by tapping.

        `aria-live="polite"` so the new value is announced after a press, which
        is the only feedback a screen-reader user gets that the button worked.
      */}
      <span
        className="min-w-10 text-center text-body tabular-nums text-ink"
        aria-live="polite"
        aria-label={`Quantity of ${productName}`}
      >
        {value}
      </span>

      <button
        type="button"
        onClick={() => change(value + 1)}
        disabled={value >= max}
        aria-label={`Increase quantity of ${productName}`}
        className="grid size-11 place-items-center rounded-pill text-ink transition-colors duration-150 hover:bg-divider/60 disabled:cursor-not-allowed disabled:text-ink-subtle"
      >
        <Plus className="size-4" strokeWidth={2} />
      </button>
    </div>
  );
}
