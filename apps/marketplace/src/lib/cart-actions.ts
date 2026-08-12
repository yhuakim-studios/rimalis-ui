"use server";

import { revalidatePath } from "next/cache";
import {
  MAX_LINES,
  MAX_QUANTITY,
  clampQuantity,
  readCart,
  writeCart,
  type CartLine,
} from "./cart";
import { catalogue, publicCtx } from "./api";

/**
 * Every mutation of the basket. Server Actions, so the cookie can be written.
 *
 * ## Why the quantity is validated against the API and not just clamped
 *
 * `addToCart` re-reads the listing before it writes. That looks like an
 * unnecessary round trip — the product page already knows the stock — but the
 * number the page knows is as old as the page, and the cookie is user-editable
 * besides. Without this check a shopper can hold a tab open through a sell-out,
 * add ten units, and only discover at checkout that the API will honour none of
 * it. Checking here means the cart never contains a quantity that was already
 * impossible when it was added.
 *
 * It does NOT make the cart authoritative: stock can still go while the cart
 * sits. `loadCart()` re-derives every problem on render, and `POST /orders` is
 * the only decision that counts. This just stops the cart from being wrong on
 * arrival.
 *
 * ## Return values, not thrown errors
 *
 * These are called from `useActionState`, and a throw would land in `error.tsx`
 * — losing the page a shopper was mid-way through for something as ordinary as
 * "only two left". The result type carries what the form should say.
 */

export interface CartActionResult {
  ok: boolean;
  /** Shown next to the control that failed. Absent on success. */
  message?: string;
}

const OK: CartActionResult = { ok: true };

/**
 * Adds units of a listing, or increases an existing line.
 *
 * The quantity is the DELTA for an existing line, not its new value — "add 2"
 * twice means four, which is what a shopper who pressed the button twice
 * expects.
 */
export async function addToCart(
  listingId: string,
  quantity: number,
): Promise<CartActionResult> {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return { ok: false, message: "Choose a quantity of at least 1." };
  }

  const result = await catalogue.getListing(publicCtx(), listingId);
  if (!result.ok) {
    return {
      ok: false,
      message: catalogue.isNotFound(result.error)
        ? "That product is no longer available."
        : "We couldn't reach our servers. Please try again.",
    };
  }

  const lines = await readCart();
  const existing = lines.find((line) => line.listingId === listingId);

  if (!existing && lines.length >= MAX_LINES) {
    return {
      ok: false,
      // Naming the limit rather than saying "cart full": a shopper who knows the
      // number can decide what to remove, and the number is the API's, not a
      // stylistic choice we could quietly raise.
      message: `A single order can hold ${MAX_LINES} different products. Remove one to add this.`,
    };
  }

  const requested = (existing?.quantity ?? 0) + quantity;
  const allowed = clampQuantity(requested, result.data);

  if (allowed === 0) {
    return { ok: false, message: "This product is out of stock." };
  }
  if (allowed < requested) {
    // Still a success — the item IS in the basket — but say what happened.
    // Silently adding fewer units than were asked for is how a shopper ends up
    // with one of something they wanted three of and no idea why.
    await persist(lines, listingId, allowed);
    return {
      ok: true,
      message:
        allowed === MAX_QUANTITY
          ? `Added. ${MAX_QUANTITY} is the most of one item you can order.`
          : `Added ${allowed} — that's all the seller has left.`,
    };
  }

  await persist(lines, listingId, allowed);
  return OK;
}

/** Sets a line's quantity outright. `0` removes it, which is what a stepper at 1 does next. */
export async function setQuantity(
  listingId: string,
  quantity: number,
): Promise<CartActionResult> {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    return { ok: false, message: "That quantity isn't valid." };
  }
  if (quantity === 0) return removeFromCart(listingId);

  const result = await catalogue.getListing(publicCtx(), listingId);
  if (!result.ok) {
    return {
      ok: false,
      message: catalogue.isNotFound(result.error)
        ? "That product is no longer available."
        : "We couldn't reach our servers. Please try again.",
    };
  }

  const allowed = clampQuantity(quantity, result.data);
  if (allowed === 0) return { ok: false, message: "This product is out of stock." };

  const lines = await readCart();
  await persist(lines, listingId, allowed);

  return allowed < quantity
    ? { ok: true, message: `Only ${allowed} left — we've set the quantity to that.` }
    : OK;
}

export async function removeFromCart(listingId: string): Promise<CartActionResult> {
  const lines = await readCart();
  await writeCart(lines.filter((line) => line.listingId !== listingId));
  revalidateCartSurfaces();
  return OK;
}

/**
 * Empties the basket.
 *
 * Called after a successful `POST /orders` — the order now owns those items, and
 * leaving them in the cookie invites a second, accidental purchase of the same
 * thing. Deliberately NOT called after `payments.initialize`: the order exists
 * whether or not the shopper completes the charge, so the basket's job is
 * already done at order time.
 */
export async function clearCart(): Promise<void> {
  await writeCart([]);
  revalidateCartSurfaces();
}

async function persist(
  lines: readonly CartLine[],
  listingId: string,
  quantity: number,
): Promise<void> {
  const existing = lines.some((line) => line.listingId === listingId);
  const next = existing
    ? lines.map((line) => (line.listingId === listingId ? { ...line, quantity } : line))
    : [...lines, { listingId, quantity }];

  await writeCart(next);
  revalidateCartSurfaces();
}

/**
 * The header count and the cart page both read the cookie, so both are stale
 * after a write.
 *
 * `revalidatePath("/", "layout")` rather than a list of routes: the count lives
 * in the root layout's header, which every route renders. Naming routes
 * individually means the badge is correct on the cart page and wrong on the
 * product page a shopper just added from — which is exactly the page they are
 * looking at when they press the button.
 */
function revalidateCartSurfaces(): void {
  revalidatePath("/", "layout");
}
