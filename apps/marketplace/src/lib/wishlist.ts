import "server-only";

import { cookies } from "next/headers";
import type { MarketplaceListing, Uuid } from "@rimalis/types";
import type { ApiError } from "@rimalis/api-client";
import { catalogue, publicCtx } from "./api";

/**
 * Saved items — a cookie of listing ids, and nothing else.
 *
 * ## Why this is a cookie rather than an account feature
 *
 * The API has no wishlist resource. Building one would mean a schema change, an
 * endpoint, and a migration, and the marketplace already links to `/wishlist`
 * from the header — a link that 404s is a worse answer than a local one.
 *
 * The trade is stated plainly so nobody later assumes otherwise: **a wishlist
 * does not follow the shopper between devices**, because it is not stored
 * anywhere but that browser. If it should, that is an API change, and this
 * module is the only thing that has to move.
 *
 * ## No quantities, no prices
 *
 * A saved item is an intention, not a line item. Prices are re-read on render,
 * for the same reason the cart re-reads them: a price copied into a cookie is a
 * price that lies the moment a vendor edits a listing.
 */

export const WISHLIST_COOKIE = "rimalis_wishlist";

/** Beyond this it is a browsing history, not a shortlist — and the cookie hits 4KB. */
export const MAX_SAVED = 60;

const WISHLIST_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

const SEPARATOR = ",";

/** Lenient, like the cart's — this value is user-editable and must never throw. */
export const parseWishlist = (value: string | undefined): Uuid[] =>
  value
    ? [...new Set(value.split(SEPARATOR).filter((id) => id.length > 0))].slice(0, MAX_SAVED)
    : [];

export async function readWishlist(): Promise<Uuid[]> {
  const store = await cookies();
  return parseWishlist(store.get(WISHLIST_COOKIE)?.value);
}

export async function writeWishlist(ids: readonly Uuid[]): Promise<void> {
  const store = await cookies();
  const value = ids.slice(0, MAX_SAVED).join(SEPARATOR);
  store.set(WISHLIST_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: value === "" ? 0 : WISHLIST_MAX_AGE_SECONDS,
  });
}

export interface WishlistView {
  /** Listings that still exist, newest saved first. */
  items: MarketplaceListing[];
  /**
   * Ids whose listing is gone.
   *
   * Surfaced rather than swept up so the page can offer to clear them. Removing
   * them silently on read would mean a render with a side effect — and a Server
   * Component cannot write a cookie anyway, so the sweep would have to happen on
   * the next action regardless.
   */
  missing: Uuid[];
  error: ApiError | null;
}

export async function loadWishlist(): Promise<WishlistView> {
  const ids = await readWishlist();
  if (ids.length === 0) return { items: [], missing: [], error: null };

  const ctx = publicCtx();
  const results = await Promise.all(ids.map((id) => catalogue.getListing(ctx, id)));

  const transportFailure = results.find(
    (result) => !result.ok && !catalogue.isNotFound(result.error),
  );
  if (transportFailure && !transportFailure.ok) {
    return { items: [], missing: [], error: transportFailure.error };
  }

  const items: MarketplaceListing[] = [];
  const missing: Uuid[] = [];
  results.forEach((result, index) => {
    const id = ids[index];
    if (result.ok) items.push(result.data);
    else if (id !== undefined) missing.push(id);
  });

  return { items, missing, error: null };
}
