import type {
  ProductStatus,
  StockPurchaseStatus,
  UserRole,
  VendorStatus,
} from "@rimalis/types";
import type { StatusPresentation } from "@/lib/format";

/**
 * Presentation for the statuses only an admin sees.
 *
 * `lib/format.ts` — copied from the vendor app — already covers `OrderStatus`,
 * `FulfillmentStatus` and `PayoutStatus`. This file adds the four it does not,
 * because the vendor app never renders them: a vendor cannot see another vendor's
 * status, cannot see a pool product's DRAFT state, and has no notion of a user
 * role.
 *
 * Same contract as the functions there: return a `StatusPresentation`, let
 * `badgeTone()` collapse the five semantic tones onto the four the `Badge` has, and
 * never invent a colour here. The design system allows one accent and reserves red
 * for danger, so the restraint is the point — if every status is emphasised, none
 * is.
 *
 * ## The labels are not the enum values
 *
 * Every one of these is renamed, and each rename is a decision:
 *
 * - `AVAILABLE` becomes **"In pool"**. "Available" invites the reading "available
 *   to buy", which is what a shopper does; this status means vendors may take stock
 *   out of it. The distinction is the whole prepaid model.
 * - `UNAVAILABLE` becomes **"Withdrawn"**, because it does not mean "out of stock"
 *   — vendors who already bought units keep selling them. "Unavailable" beside a
 *   non-zero stock figure reads as a bug.
 * - `ABANDONED` becomes **"Not completed"**. The vendor did nothing wrong; they
 *   left a checkout. Accusatory copy on a money screen is worth avoiding.
 */

/**
 * A pool product's lifecycle.
 *
 * `DRAFT` is `warning` — the filled pill — because it is the one state that means
 * work is outstanding: the product exists and no vendor can do anything with it
 * until an admin publishes it.
 */
export function productStatus(
  status: ProductStatus | string,
): StatusPresentation {
  switch (status) {
    case "DRAFT":
      return { label: "Draft", tone: "warning" };
    case "AVAILABLE":
      return { label: "In pool", tone: "success" };
    case "UNAVAILABLE":
      return { label: "Withdrawn", tone: "neutral" };
    default:
      // An unrecognised status from a newer API. Show it rather than hiding the
      // row — a status this build does not know is information, not corruption.
      return { label: status, tone: "neutral" };
  }
}

/**
 * A vendor's standing.
 *
 * `PENDING` is `warning`: it is the approval queue, and it is the only entry here
 * with a person waiting at the other end of it.
 */
export function vendorStatus(status: VendorStatus | string): StatusPresentation {
  switch (status) {
    case "PENDING":
      return { label: "Awaiting review", tone: "warning" };
    case "APPROVED":
      return { label: "Approved", tone: "success" };
    case "SUSPENDED":
      return { label: "Suspended", tone: "danger" };
    case "REJECTED":
      return { label: "Rejected", tone: "neutral" };
    default:
      return { label: status, tone: "neutral" };
  }
}

/**
 * A stock purchase's state.
 *
 * `PENDING` is `warning` rather than neutral for an operational reason, not a
 * cosmetic one: a pending purchase is **holding a reservation** against the
 * platform's pool, so it is actively making stock unavailable to other vendors
 * while it waits. That is the usual explanation for a product that shows units on
 * hand and still cannot be bought.
 */
export function stockPurchaseStatus(
  status: StockPurchaseStatus | string,
): StatusPresentation {
  switch (status) {
    case "PENDING":
      return { label: "Awaiting payment", tone: "warning" };
    case "SUCCESS":
      return { label: "Paid", tone: "success" };
    case "FAILED":
      return { label: "Failed", tone: "danger" };
    case "ABANDONED":
      return { label: "Not completed", tone: "neutral" };
    default:
      return { label: status, tone: "neutral" };
  }
}

/**
 * A user's role.
 *
 * `ADMIN` is `warning` — the filled pill — not because it is a problem but because
 * it is the one value on a user list worth spotting at a glance. An admin scanning
 * for "who can do what I can do" should not have to read every row.
 */
export function userRole(role: UserRole | string): StatusPresentation {
  switch (role) {
    case "ADMIN":
      return { label: "Admin", tone: "warning" };
    case "VENDOR":
      return { label: "Vendor", tone: "info" };
    case "CUSTOMER":
      return { label: "Customer", tone: "neutral" };
    default:
      return { label: role, tone: "neutral" };
  }
}

/**
 * Whether an account can sign in.
 *
 * Rendered only when suspended. An "Active" badge on every row in a list where
 * almost everything is active is noise that makes the one suspended row harder to
 * find, not easier — so callers render this conditionally and the `active` branch
 * exists for the detail screen, where the absence of a badge would be ambiguous.
 */
export function accountState(isActive: boolean): StatusPresentation {
  return isActive
    ? { label: "Active", tone: "neutral" }
    : { label: "Suspended", tone: "danger" };
}

/** Whether the account has confirmed its email address. */
export function verificationState(isVerified: boolean): StatusPresentation {
  return isVerified
    ? { label: "Verified", tone: "neutral" }
    : // The usual explanation for "I registered but cannot sign in", so it is
      // worth surfacing rather than leaving to be inferred.
      { label: "Unverified", tone: "warning" };
}
