import type { AuditLogEntry } from "@rimalis/types";

/**
 * Turning an audit row into a sentence a person can read.
 *
 * ## Why a mapping and not just the raw action
 *
 * `vendor.commission_overridden` is precise, greppable and unreadable. The trail's
 * whole value is that someone can scan it six months later and understand what
 * happened, and `<entity>.<past_tense_verb>` in a monospace column is a log file,
 * not an account of events.
 *
 * ## The unknown-action fallback is the important part
 *
 * `action` is a `String` column, NOT a Postgres enum, specifically so the API can
 * add an audited action without a migration. That means this map WILL be
 * incomplete at some point, and the failure mode has to be graceful: an
 * unrecognised action must still render something truthful, not a blank cell or
 * the word "undefined".
 *
 * So `describeAction` derives a readable phrase from the action string itself when
 * it does not recognise it — `refund.issued` becomes "issued a refund for". A new
 * action shipped by the API therefore appears in this UI immediately, imperfectly
 * phrased and completely legible, and adding it to the map below is an improvement
 * rather than a bug fix.
 */

/**
 * The known vocabulary, phrased to follow the actor's name.
 *
 * Each entry completes the sentence "<Actor> …", and ends where the target begins:
 * "Ada Obi suspended the vendor" + " Kano Deals".
 */
const PHRASES: Record<string, string> = {
  "user.suspended": "suspended the account",
  "user.reactivated": "reactivated the account",
  "user.role_changed": "changed the role of",
  "vendor.approved": "approved the vendor",
  "vendor.rejected": "rejected the application from",
  "vendor.suspended": "suspended the vendor",
  "vendor.reinstated": "reinstated the vendor",
  "vendor.commission_overridden": "changed the commission rate for",
  "product.stock_adjusted": "adjusted pool stock for",
  // The one action whose actor is not an admin — the vendor's own user initiates
  // it, and the row is written from the Paystack webhook when the money lands.
  "stock.purchased": "bought stock",
};

/** What the target is, in words, for a row whose target cannot be joined. */
const TARGETS: Record<string, string> = {
  USER: "a user",
  VENDOR: "a vendor",
  PRODUCT: "a product",
  ORDER: "an order",
  STOCK_PURCHASE: "a stock purchase",
};

/**
 * A readable phrase for any action, known or not.
 *
 * The fallback splits on the dot and reverses the halves — `refund.issued` →
 * "issued · refund" → "issued a refund" — because the API's own convention is
 * `<entity>.<past-tense verb>`, so the verb is always the second half. Underscores
 * become spaces (`role_changed` → "role changed").
 */
export function describeAction(action: string): string {
  const known = PHRASES[action];
  if (known !== undefined) return known;

  const [entity, ...rest] = action.split(".");
  const verb = rest.join(" ").replace(/_/g, " ");
  if (verb === "" || entity === undefined) {
    // Not even dotted. Show it verbatim rather than mangling it — a truthful odd
    // string beats a confident wrong sentence.
    return action;
  }
  return `${verb} the ${entity.replace(/_/g, " ")}`;
}

/** The acting person's name, falling back to their email, then to their id. */
export function actorName(entry: AuditLogEntry): string {
  const { actor } = entry;
  const name = `${actor.firstName} ${actor.lastName}`.trim();
  if (name !== "") return name;
  if (actor.email !== "") return actor.email;
  return actor.id.slice(0, 8);
}

/**
 * The whole row as one sentence.
 *
 * Reads the metadata for a name when there is one — `storeName` is written by the
 * vendor actions and turns "suspended the vendor" into "suspended the vendor Kano
 * Deals", which is the difference between an entry you can act on and a UUID you
 * have to look up. Falls back to naming the target type, never to printing the
 * raw id: the id is available on the row itself and a bare UUID mid-sentence reads
 * as a rendering failure.
 */
export function auditSentence(entry: AuditLogEntry): string {
  const subject = targetName(entry);
  const phrase = describeAction(entry.action);
  return subject === undefined
    ? `${actorName(entry)} ${phrase}`
    : `${actorName(entry)} ${phrase} ${subject}`;
}

/**
 * A human label for the row's target, from the metadata, or the target's type.
 *
 * `metadata` is `unknown` by design — its shape varies per action and the API
 * makes no promise about it — so this narrows defensively rather than casting. A
 * metadata blob that changes shape must not throw on a page whose job is to
 * explain what happened.
 */
export function targetName(entry: AuditLogEntry): string | undefined {
  const meta = entry.metadata;
  if (typeof meta === "object" && meta !== null) {
    for (const key of ["storeName", "name", "email", "sku"] as const) {
      const value = (meta as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim() !== "") return value;
    }
  }
  return TARGETS[entry.targetType];
}

/**
 * Where to send someone who clicks the row, or `undefined`.
 *
 * ⚠️ **The target may no longer exist.** `targetType`/`targetId` carry no foreign
 * key precisely so the log outlives what it describes, so any of these links can
 * 404 — which is correct and must not be treated as a bug. The alternative, having
 * the API resolve names, would be five type-keyed lookups per page for rows that
 * are mostly never clicked.
 *
 * `ORDER` and `STOCK_PURCHASE` targets are linkable; `USER`, `VENDOR` and
 * `PRODUCT` too. Anything else returns `undefined` and renders as plain text, which
 * is what an action against a model this app has no screen for should do.
 */
export function targetHref(entry: AuditLogEntry): string | undefined {
  switch (entry.targetType) {
    case "USER":
      return `/users/${entry.targetId}`;
    case "VENDOR":
      return `/vendors/${entry.targetId}`;
    case "PRODUCT":
      return `/products/${entry.targetId}`;
    case "ORDER":
      return `/orders/${entry.targetId}`;
    case "STOCK_PURCHASE":
      return `/stock-purchases/${entry.targetId}`;
    default:
      return undefined;
  }
}
