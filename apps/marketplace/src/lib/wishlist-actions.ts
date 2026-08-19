"use server";

import { revalidatePath } from "next/cache";
import { MAX_SAVED, readWishlist, writeWishlist } from "./wishlist";

/**
 * Saving and unsaving. One toggle, because the heart button is one control.
 *
 * A separate `save` and `unsave` would need the caller to know the current
 * state, and the caller is a button rendered from a server pass that may be a
 * moment stale — which is how a heart ends up un-saving something the shopper
 * has just saved in another tab. The toggle reads the cookie at the moment it
 * writes it, so the cookie is the only source of truth.
 */

export interface WishlistToggleResult {
  saved: boolean;
  message?: string;
}

export async function toggleWishlist(listingId: string): Promise<WishlistToggleResult> {
  const ids = await readWishlist();

  if (ids.includes(listingId)) {
    await writeWishlist(ids.filter((id) => id !== listingId));
    revalidatePath("/", "layout");
    return { saved: false };
  }

  if (ids.length >= MAX_SAVED) {
    return {
      saved: false,
      message: `You can save up to ${MAX_SAVED} items. Remove one to save this.`,
    };
  }

  // Newest first, so the wishlist page reads as a stack rather than as an
  // archive whose most recent addition is at the bottom of a long scroll.
  await writeWishlist([listingId, ...ids]);
  revalidatePath("/", "layout");
  return { saved: true };
}

/** Drops ids whose listing no longer exists — the "tidy up" the wishlist page offers. */
export async function removeFromWishlist(listingIds: string[]): Promise<void> {
  const ids = await readWishlist();
  await writeWishlist(ids.filter((id) => !listingIds.includes(id)));
  revalidatePath("/", "layout");
}
