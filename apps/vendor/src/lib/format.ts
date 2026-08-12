import type { FulfillmentStatus, OrderStatus, PayoutStatus } from "@rimalis/types";

/**
 * Presentation helpers — the words and shapes a vendor reads.
 *
 * Kept out of the components so that the *same* status never gets two different
 * labels in two places. A vendor comparing the pill on a list row with the pill
 * on the detail page and finding different words concludes one of them is wrong,
 * and they are right to.
 */

/**
 * A short relative time — "2m ago", "3d ago".
 *
 * ⚠️ **Rendered on the server, so it is as fresh as the response and no fresher.**
 * A page that stays open for an hour keeps saying "2m ago" until something
 * re-renders it. That is a deliberate trade: the alternative is a client
 * component with a ticking interval on every row, which for a fifty-row order
 * list is fifty timers to avoid a stale word. The design's own "updated 5 mins
 * ago" caption has exactly the same property.
 *
 * Absolute dates are used anywhere the exact moment matters — a payout period, an
 * order's placed-at on its detail page — because "3d ago" is not something you
 * can reconcile a bank statement against.
 */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${String(minutes)}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${String(hours)}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${String(days)}d ago`;

  const months = Math.round(days / 30);
  if (months < 12) return `${String(months)}mo ago`;

  return `${String(Math.round(months / 12))}y ago`;
}

/**
 * An absolute date, for anything reconcilable.
 *
 * `en-NG` with an explicit `Africa/Lagos` timezone. Both halves matter: without
 * the timezone the Worker renders in UTC, and an order placed at 00:30 in Lagos
 * shows as the previous day — which is wrong in a way nobody notices until a
 * vendor disputes a daily total.
 */
export function absoluteDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });
}

/** The same, with the time — for an order's own detail header. */
export function absoluteDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
}

/** A short order reference from a uuid. The full id is never worth showing. */
export const shortRef = (id: string): string => `#${id.slice(0, 8).toUpperCase()}`;

/**
 * How a status renders: its label and its badge tone.
 *
 * The tones are deliberately restrained — the design system allows exactly one
 * accent and reserves red for danger. So a status is `neutral` unless it is
 * genuinely actionable (`warning`, for something the vendor must do) or genuinely
 * bad (`danger`). "Delivered" is a `success`, and success in this palette is a
 * dark tint rather than green, because green is not one of this product's colours.
 */
export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger";

export interface StatusPresentation {
  label: string;
  tone: StatusTone;
}

/**
 * The five semantic tones collapsed onto the four the `Badge` actually has.
 *
 * One place, so no component invents its own mapping. `info` and `neutral` both
 * land on `neutral` deliberately: "Processing" and "Shipped" are states a vendor
 * has already acted on, and giving them their own colour spends emphasis on
 * rows that need none. Only `warning` — the work still to do — gets the filled
 * pill. See the header of `Badge.tsx` on why that is weight and not a new hue.
 */
export function badgeTone(tone: StatusTone): "neutral" | "brand" | "strong" | "danger" {
  switch (tone) {
    case "warning":
      return "strong";
    case "success":
      return "brand";
    case "danger":
      return "danger";
    case "info":
    case "neutral":
      return "neutral";
  }
}

/**
 * The ORDER's rolled-up status.
 *
 * `PENDING` is the one worth reading carefully: it means **unpaid**, not
 * "awaiting your action". A vendor must not pick or ship against it, and the API
 * refuses fulfilment transitions on an order that is not yet `PAID`. Labelling it
 * "Awaiting payment" rather than "Pending" is the whole point — a seller who
 * reads "pending" as "my turn" ships goods they have not been paid for.
 */
export function orderStatus(status: OrderStatus | string): StatusPresentation {
  switch (status) {
    case "PENDING":
      return { label: "Awaiting payment", tone: "neutral" };
    case "PAID":
      return { label: "Ready to pick", tone: "warning" };
    case "PROCESSING":
      return { label: "Processing", tone: "info" };
    case "SHIPPED":
      return { label: "Shipped", tone: "info" };
    case "DELIVERED":
      return { label: "Delivered", tone: "success" };
    case "CANCELLED":
      return { label: "Cancelled", tone: "danger" };
    case "REFUNDED":
      return { label: "Refunded", tone: "danger" };
    default:
      // An unrecognised status from a newer API. Show the raw value rather than
      // inventing a friendly word for something we do not understand.
      return { label: String(status), tone: "neutral" };
  }
}

/** One line's own progress — what the vendor actually controls. */
export function fulfillmentStatus(status: FulfillmentStatus | string): StatusPresentation {
  switch (status) {
    case "PENDING":
      return { label: "To pick", tone: "warning" };
    case "PROCESSING":
      return { label: "Packing", tone: "info" };
    case "SHIPPED":
      return { label: "Shipped", tone: "info" };
    case "DELIVERED":
      return { label: "Delivered", tone: "success" };
    default:
      return { label: String(status), tone: "neutral" };
  }
}

/** Settlement status. A `string` fallback because the column is not an enum. */
export function payoutStatus(status: PayoutStatus | string): StatusPresentation {
  switch (status) {
    case "COMPLETED":
      return { label: "Settled", tone: "success" };
    case "PROCESSING":
      return { label: "In transit", tone: "info" };
    case "PENDING":
      return { label: "Queued", tone: "warning" };
    case "FAILED":
      return { label: "Failed", tone: "danger" };
    default:
      return { label: String(status), tone: "neutral" };
  }
}

/**
 * The next fulfilment step for a line, or `null` when there is none.
 *
 * One place, because the button label, the confirmation copy and the request body
 * all have to agree. Fulfilment is forward-only — there is no un-ship — so
 * `DELIVERED` returns `null` and the UI renders no action rather than a disabled
 * button that implies something is possible later.
 */
export function nextFulfillmentStep(
  current: FulfillmentStatus,
): { to: "PROCESSING" | "SHIPPED" | "DELIVERED"; label: string } | null {
  switch (current) {
    case "PENDING":
      return { to: "PROCESSING", label: "Start packing" };
    case "PROCESSING":
      return { to: "SHIPPED", label: "Mark shipped" };
    case "SHIPPED":
      return { to: "DELIVERED", label: "Mark delivered" };
    case "DELIVERED":
      return null;
    default:
      return null;
  }
}

/**
 * Coarse destination, as one line. `null` when the shopper deleted the address.
 *
 * City and state only — that is all the API sends a vendor, on purpose. Country
 * is dropped from the display because it is `NG` on every order in this market
 * and a column that never varies is noise.
 */
export function destination(
  address: { city: string; state: string; country: string } | null,
): string | null {
  if (!address) return null;
  const parts = [address.city, address.state].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/** A monogram for a product with no image. Two letters at most. */
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (first === undefined) return "?";
  const second = words[1];
  if (second === undefined) return first.slice(0, 2).toUpperCase();
  return `${first[0] ?? ""}${second[0] ?? ""}`.toUpperCase();
}

/** `1 item` / `3 items`, so no caller hand-rolls the plural. */
export const pluralise = (count: number, singular: string, plural = `${singular}s`): string =>
  `${String(count)} ${count === 1 ? singular : plural}`;

// ---------------------------------------------------------------------------
// Chart figures
// ---------------------------------------------------------------------------

/**
 * Money at a glance — `₦49.2k`, `₦1.4m`.
 *
 * For axis ticks and stat tiles, where the full `₦1,450,000.00` is both too wide
 * for the slot and more precision than the reader wants. Anything reconcilable —
 * a payout row, an order total — uses `formatMoney` and shows every kobo.
 *
 * Takes kobo (integer minor units) because that is what the money module produces;
 * dividing by 100 here rather than at each call site keeps the conversion in one
 * place. Rounds to one decimal and drops a trailing `.0`, so `₦50k` rather than
 * `₦50.0k`.
 */
export function compactNaira(kobo: number): string {
  const naira = Math.round(kobo / 100);
  if (naira === 0) return "₦0";

  const format = (value: number, suffix: string): string => {
    const rounded = Math.round(value * 10) / 10;
    return `₦${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}${suffix}`;
  };

  const magnitude = Math.abs(naira);
  if (magnitude >= 1_000_000) return format(naira / 1_000_000, "m");
  if (magnitude >= 1_000) return format(naira / 1_000, "k");
  return `₦${String(naira)}`;
}

/**
 * Y-axis ticks: clean round numbers from 0 to at or above `maxKobo`.
 *
 * Snaps the top to 1, 2 or 5 times a power of ten, which is what makes ticks read
 * as `₦0 / ₦25k / ₦50k` rather than `₦0 / ₦23.7k / ₦47.4k`. An axis that has to be
 * decoded is worse than no axis, and the numbers a reader interpolates against have
 * to be ones they can hold in their head.
 *
 * Returns `[]` for an empty week, because an axis of five zeroes is furniture.
 */
export function niceTicks(maxKobo: number, count = 5): number[] {
  if (maxKobo <= 0) return [];

  const rough = maxKobo / (count - 1);
  const power = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / power;
  const step = (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * power;

  const ticks: number[] = [];
  for (let value = 0; value <= maxKobo + step / 2; value += step) ticks.push(value);
  return ticks;
}
