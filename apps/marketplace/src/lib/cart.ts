import "server-only";

import { cookies } from "next/headers";
import type { MarketplaceListing, Uuid } from "@rimalis/types";
import type { ApiError } from "@rimalis/api-client";
import { catalogue, publicCtx } from "./api";
import { availabilityOf, imageAlt, primaryImage } from "./listing";
import { ZERO, formatNaira, multiply, parseMoney, sum, type Minor } from "./money";

/**
 * The basket: a cookie holding ids and quantities, and nothing else.
 *
 * ## Why a cookie rather than a database or `localStorage`
 *
 * There is no cart resource on the API — checkout is stateless, and `POST
 * /orders` takes the whole basket in one request. So the only question is where
 * the client keeps it until then.
 *
 * `localStorage` would put it out of reach of every Server Component, which
 * means the cart page, the header count and the checkout summary would all have
 * to be client-rendered and would flash empty on first paint. A cookie is
 * readable during the render that produces the HTML, so the count in the header
 * is correct in the first byte.
 *
 * It also survives sign-in for free, which matters: a shopper who fills a basket
 * and then registers keeps it, because the cookie was never tied to a session.
 *
 * ## What is stored, and what is deliberately NOT
 *
 * Listing ids and quantities. **No prices, no names, no images.** A price copied
 * into a cookie is a price that goes stale the moment a vendor edits a listing,
 * and a shopper who sees a stale total at checkout has been shown a number the
 * API will not honour. So every render re-reads the listings and derives
 * everything from the live response — see `loadCart()`.
 *
 * That also keeps the cookie small. Fifty lines at 39 bytes each is ~2KB, inside
 * the 4KB limit with room to spare, and the cap matches the API's own.
 *
 * ## `httpOnly`, even though it is not a credential
 *
 * Nothing in the browser needs to read it: every mutation is a Server Action and
 * every read is a Server Component. Making it `httpOnly` means an XSS on a
 * product page cannot quietly rewrite what someone is about to buy, and costs
 * nothing because no client code wanted it.
 */

export const CART_COOKIE = "rimalis_cart";

/** Matches the API's own `maxItems` on `POST /orders`. A 51st line is a 400. */
export const MAX_LINES = 50;

/** Per line. Above this a "quantity" is a data-entry accident, not an order. */
export const MAX_QUANTITY = 99;

/** 30 days. Long enough to survive a weekend of thinking about it. */
const CART_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface CartLine {
  /** The LISTING id — `MarketplaceListing.id`, never `product.id`. */
  listingId: Uuid;
  quantity: number;
}

/**
 * `id:qty,id:qty`. Compact, and legible in devtools when something is wrong.
 *
 * Not JSON: JSON in a cookie needs URL-encoding, which turns every `{` and `"`
 * into three characters and roughly doubles the size for no benefit. Not base64
 * either — that would make the one thing this format is good for, reading it
 * during a bug hunt, impossible.
 */
const SEPARATOR = ",";

/**
 * Parses the cookie. Lenient, always — this value is user-editable.
 *
 * A malformed cookie must never throw. It is trivially forgeable, it survives a
 * format change we might make later, and an exception during a header render
 * takes down every page at once. Anything unparseable is dropped line by line,
 * so a single bad entry does not cost the shopper the rest of their basket.
 *
 * Duplicates are **merged**, not kept. The API rejects a duplicated
 * `vendorProductId` outright rather than combining them — silently merging
 * server-side would make an order total disagree with what was on screen — so
 * the merge has to happen here, before the request is built.
 */
export function parseCart(value: string | undefined): CartLine[] {
  if (!value) return [];

  const merged = new Map<string, number>();
  for (const entry of value.split(SEPARATOR)) {
    const [listingId, rawQuantity] = entry.split(":");
    if (!listingId || !rawQuantity) continue;

    const quantity = Number(rawQuantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1) continue;

    const total = (merged.get(listingId) ?? 0) + quantity;
    merged.set(listingId, Math.min(total, MAX_QUANTITY));
  }

  return [...merged.entries()]
    .slice(0, MAX_LINES)
    .map(([listingId, quantity]) => ({ listingId, quantity }));
}

export const serialiseCart = (lines: readonly CartLine[]): string =>
  lines
    .slice(0, MAX_LINES)
    .map((line) => `${line.listingId}:${line.quantity}`)
    .join(SEPARATOR);

/** The raw lines from the cookie. No API calls — for the header count. */
export async function readCart(): Promise<CartLine[]> {
  const store = await cookies();
  return parseCart(store.get(CART_COOKIE)?.value);
}

/** Total units, which is what a cart badge should show — not the number of lines. */
export const cartCount = (lines: readonly CartLine[]): number =>
  lines.reduce((total, line) => total + line.quantity, 0);

/** Writes the cookie. Server Actions and route handlers only. */
export async function writeCart(lines: readonly CartLine[]): Promise<void> {
  const store = await cookies();
  const value = serialiseCart(lines);

  if (value === "") {
    store.set(CART_COOKIE, "", { ...cartCookieOptions(), maxAge: 0 });
    return;
  }
  store.set(CART_COOKIE, value, cartCookieOptions());
}

const cartCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: CART_MAX_AGE_SECONDS,
});

// ---------------------------------------------------------------------------
// Live view
// ---------------------------------------------------------------------------

/**
 * One cart line, resolved against the catalogue as it is right now.
 *
 * Every display value here is derived from a fresh API read rather than from the
 * cookie, which is what makes a repriced or sold-out line visible in the cart
 * instead of at the moment of payment.
 */
export interface CartLineView {
  listingId: Uuid;
  quantity: number;
  name: string;
  storeName: string;
  storeSlug: string;
  imageUrl: string | null;
  imageAlt: string;
  /** Formatted unit price, e.g. `"₦37,000.00"`. */
  unitPrice: string;
  /** Formatted line total — unit × quantity. */
  lineTotal: string;
  /**
   * Why this line cannot be ordered as it stands, or `null`.
   *
   * Three separate problems, kept separate because the fix differs: reduce the
   * quantity, remove the line, or nothing the shopper can do. A single
   * "unavailable" flag would let the UI offer the wrong remedy.
   */
  problem:
    | { kind: "out_of_stock" }
    | { kind: "insufficient_stock"; available: number }
    | { kind: "gone" }
    | null;
  /** The ceiling for a quantity stepper. `0` when the line cannot be bought. */
  available: number;
}

export interface CartView {
  lines: CartLineView[];
  /** Formatted sum of the orderable lines. */
  subtotal: string;
  /** Units across all lines. */
  count: number;
  /** True when at least one line has a `problem` — checkout is blocked. */
  hasProblems: boolean;
  /**
   * Set when the catalogue could not be reached at all.
   *
   * Distinct from a per-line `gone`: an empty cart page because the API is down
   * would tell a shopper their basket was lost, and they would not come back to
   * check.
   */
  error: ApiError | null;
}

const EMPTY: CartView = {
  lines: [],
  subtotal: formatNaira(ZERO),
  count: 0,
  hasProblems: false,
  error: null,
};

/**
 * Resolves the cookie into something renderable.
 *
 * One `getListing` per line, in parallel. That is N requests where a bulk
 * endpoint would be one, and it is the honest trade today: the API has no
 * `?ids=` filter, `MAX_LINES` is 50, and the alternative — pulling the whole
 * catalogue and filtering client-side — costs more the moment the catalogue
 * outgrows one page. If a cart endpoint ever appears, this is the only function
 * that changes.
 *
 * A line whose listing 404s is reported as `gone` rather than dropped. A basket
 * that quietly loses an item is a basket the shopper cannot trust; being told
 * "this is no longer available, remove it" is worse-looking and far better.
 */
export async function loadCart(): Promise<CartView> {
  const lines = await readCart();
  if (lines.length === 0) return EMPTY;

  const ctx = publicCtx();
  const results = await Promise.all(
    lines.map(async (line) => ({
      line,
      result: await catalogue.getListing(ctx, line.listingId),
    })),
  );

  // A transport failure on ANY line means the catalogue is unreachable, not that
  // that one product vanished — see `CartView.error`.
  const transportFailure = results.find(
    ({ result }) => !result.ok && !catalogue.isNotFound(result.error),
  );
  if (transportFailure && !transportFailure.result.ok) {
    return { ...EMPTY, count: cartCount(lines), error: transportFailure.result.error };
  }

  // Line totals in kobo, kept beside the views rather than re-parsed out of the
  // formatted strings. Reading `"₦37,000.00"` back into a number would be
  // circular, and it would break the day a currency or locale changed the
  // grouping characters — a subtotal that is silently wrong is the one failure
  // this whole money module exists to prevent.
  const minorTotals = new Map<Uuid, Minor>();

  const views: CartLineView[] = results.map(({ line, result }) => {
    if (!result.ok) return goneLine(line);

    const listing = result.data;
    const availability = availabilityOf(listing);
    const available = availability.kind === "out_of_stock" ? 0 : availability.available;
    const unit = parseMoney(listing.product.retailPrice);
    const image = primaryImage(listing.product.images);
    const lineTotal = multiply(unit, line.quantity);
    minorTotals.set(line.listingId, lineTotal);

    return {
      listingId: line.listingId,
      quantity: line.quantity,
      name: listing.product.name,
      storeName: listing.vendor.storeName,
      storeSlug: listing.vendor.slug,
      imageUrl: image?.url ?? null,
      imageAlt: imageAlt(image, listing.product.name),
      unitPrice: formatNaira(unit),
      lineTotal: formatNaira(lineTotal),
      problem:
        available === 0
          ? { kind: "out_of_stock" }
          : line.quantity > available
            ? { kind: "insufficient_stock", available }
            : null,
      available,
    };
  });

  // Only orderable lines count toward the subtotal. Including a line that
  // checkout will reject produces a total the shopper never gets charged, and
  // the discrepancy shows up at the worst possible moment.
  const subtotal = sum(
    ...views
      .filter((view) => view.problem === null)
      .map((view) => minorTotals.get(view.listingId) ?? ZERO),
  );

  return {
    lines: views,
    subtotal: formatNaira(subtotal),
    count: cartCount(lines),
    hasProblems: views.some((view) => view.problem !== null),
    error: null,
  };
}

const goneLine = (line: CartLine): CartLineView => ({
  listingId: line.listingId,
  quantity: line.quantity,
  name: "This product is no longer available",
  storeName: "",
  storeSlug: "",
  imageUrl: null,
  imageAlt: "",
  unitPrice: "—",
  lineTotal: "—",
  problem: { kind: "gone" },
  available: 0,
});

/**
 * The order lines to send to `POST /orders`.
 *
 * Built from the LIVE view rather than from the cookie, and it throws if any
 * line has a problem. That is the last gate before a request that decrements
 * stock and takes money: a caller that has not resolved every problem has a bug,
 * and finding out here is much better than a 409 the shopper has to interpret.
 */
export function toOrderItems(view: CartView): { vendorProductId: Uuid; quantity: number }[] {
  if (view.hasProblems) {
    throw new Error("Refusing to build an order from a cart with unresolved problems.");
  }
  return view.lines.map((line) => ({
    vendorProductId: line.listingId,
    quantity: line.quantity,
  }));
}

/** Clamps a requested quantity to what the listing can actually supply. */
export const clampQuantity = (requested: number, listing: MarketplaceListing): number => {
  const availability = availabilityOf(listing);
  const ceiling = availability.kind === "out_of_stock" ? 0 : availability.available;
  return Math.max(0, Math.min(requested, ceiling, MAX_QUANTITY));
};
