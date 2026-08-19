"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { shopperMessage } from "@rimalis/api-client";
import { admin, ctxFor, requireAdmin } from "./auth";
import { fieldErrorsOf, type FormState } from "./form-state";

/**
 * Vendor administration: the approval queue, suspension, and commission.
 *
 * ## `requireAdmin()` runs inside every action, not just on the page
 *
 * A Server Action is a POST endpoint the browser can call directly. The page's own
 * guard ran when the page rendered, which may have been fifteen minutes and one
 * role change ago — so an action that trusted it would let a demoted admin keep
 * suspending vendors from a tab they left open. Every write re-checks.
 *
 * The API would refuse anyway (`requireRole("ADMIN")` reads the verified JWT), so
 * this is defence in depth rather than the only gate. It buys a clean redirect
 * instead of an unexplained failure banner.
 *
 * ## Errors are returned, not thrown
 *
 * A throw unmounts the form into `error.tsx` and loses the reason the admin typed.
 * `revalidatePath` on success is what makes the list and the detail screen agree —
 * without it the vendor's status is stale until a hard reload, and an admin who
 * clicks "Suspend" and sees "Approved" clicks again.
 */

const idSchema = z.object({ vendorId: z.uuid("That vendor id is not valid.") });

const reasonSchema = idSchema.extend({
  // Optional to match the API, but capped: the column is unbounded text and a
  // pasted email thread in an audit reason makes the trail unreadable.
  reason: z.string().trim().max(500, "Keep the reason under 500 characters.").optional(),
});

/**
 * The percentage an admin types, converted to the fraction the API stores.
 *
 * Humans say "8%", the column holds `0.08`, and getting the direction wrong by a
 * factor of 100 either hands a vendor the platform's entire margin or charges them
 * eight times over. So the conversion happens in exactly one place.
 *
 * The bounds are deliberate: 0 is allowed (a vendor charged nothing is a real
 * commercial decision) and anything at or above 100% is not — commission cannot
 * exceed the margin it is charged on.
 */
const rateSchema = idSchema.extend({
  percent: z
    .string()
    .trim()
    .min(1, "Enter a percentage, or clear the override.")
    .transform((raw) => Number(raw))
    .refine((n) => Number.isFinite(n), { message: "That is not a number." })
    .refine((n) => n >= 0 && n < 100, {
      message: "Must be between 0 and 99.99 percent.",
    }),
});

/** Both screens that show a vendor, so a status change is never stale on either. */
function revalidateVendor(vendorId: string): void {
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${vendorId}`);
  // The dashboard's approval queue and its vendor counts read the same rows.
  revalidatePath("/");
}

export async function approveVendor(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema.safeParse({ vendorId: formData.get("vendorId") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin("/vendors");
  const result = await admin.approveVendor(ctxFor(session), parsed.data.vendorId);

  if (!result.ok) {
    if (admin.isNotFound(result.error)) return { error: "That vendor no longer exists." };
    return { error: shopperMessage(result.error) };
  }

  revalidateVendor(parsed.data.vendorId);
  return {
    // The re-login caveat belongs here rather than in a doc comment: the vendor's
    // existing access token has no `vendor_id` claim, so `/vendor/*` stays shut
    // for them until it refreshes. Without this line the next message an admin
    // gets is "you approved me and it still says pending".
    message:
      "Approved. They may need to sign out and back in before their dashboard opens.",
  };
}

/**
 * Reject an application.
 *
 * ⚠️ **No reason is sent, because the endpoint accepts no body.** A
 * `rejectVendorSchema` exists on the API but is not wired to the route. Adding a
 * reason field here would silently discard what the admin typed — the exact bug the
 * audit table was created to fix. If a reason is wanted, wire it on the API first.
 */
export async function rejectVendor(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema.safeParse({ vendorId: formData.get("vendorId") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin("/vendors");
  const result = await admin.rejectVendor(ctxFor(session), parsed.data.vendorId);

  if (!result.ok) {
    if (admin.isNotFound(result.error)) return { error: "That vendor no longer exists." };
    return { error: shopperMessage(result.error) };
  }

  revalidateVendor(parsed.data.vendorId);
  return { message: "Application rejected." };
}

export async function suspendVendor(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = reasonSchema.safeParse({
    vendorId: formData.get("vendorId"),
    reason: String(formData.get("reason") ?? "").trim() || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin("/vendors");
  const result = await admin.suspendVendor(ctxFor(session), parsed.data.vendorId, {
    ...(parsed.data.reason !== undefined ? { reason: parsed.data.reason } : {}),
  });

  if (!result.ok) {
    if (admin.isNotFound(result.error)) return { error: "That vendor no longer exists." };
    return { error: shopperMessage(result.error) };
  }

  revalidateVendor(parsed.data.vendorId);
  return {
    // Suspension IS live for vendor routes — `requireVendor` re-reads status from
    // the database on every request — so unlike a user suspension there is no
    // 15-minute token window to warn about here.
    message: "Suspended. Their dashboard locks on their next request.",
  };
}

export async function reinstateVendor(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema.safeParse({ vendorId: formData.get("vendorId") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin("/vendors");
  const result = await admin.reinstateVendor(ctxFor(session), parsed.data.vendorId);

  if (!result.ok) {
    if (admin.isNotFound(result.error)) return { error: "That vendor no longer exists." };
    return { error: shopperMessage(result.error) };
  }

  revalidateVendor(parsed.data.vendorId);
  return { message: "Reinstated. They can trade again." };
}

/**
 * Set the commission override.
 *
 * Percent in, fraction out. Audited as `vendor.commission_overridden` with the
 * before and after — this is the one action that silently changes money on every
 * future order.
 */
export async function setCommissionRate(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = rateSchema.safeParse({
    vendorId: formData.get("vendorId"),
    percent: formData.get("percent"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin("/vendors");
  const result = await admin.setCommissionRate(ctxFor(session), parsed.data.vendorId, {
    // The one conversion. `Number((8 / 100).toFixed(6))` rather than `8 / 100`
    // because 0.07 / 100 in binary float is 0.0007000000000000001, and a rate
    // that renders as "0.07000000000000001%" in the audit metadata is noise that
    // makes a real change look like a bug.
    commissionRateOverride: Number((parsed.data.percent / 100).toFixed(6)),
  });

  if (!result.ok) {
    if (admin.isNotFound(result.error)) return { error: "That vendor no longer exists." };
    return { error: shopperMessage(result.error) };
  }

  revalidateVendor(parsed.data.vendorId);
  return {
    message: `Now charged ${String(parsed.data.percent)}% on margin, for future orders only.`,
  };
}

/**
 * Clear the override and hand the rate back to the referral ladder.
 *
 * A separate action rather than an empty value on the one above, because the two
 * are genuinely different intents and an empty text field is an ambiguous way to
 * express "return to the ladder". `null` here does not mean the platform default —
 * it means the vendor's earned tier decides, which is a different number per vendor.
 */
export async function clearCommissionRate(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema.safeParse({ vendorId: formData.get("vendorId") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin("/vendors");
  const result = await admin.setCommissionRate(ctxFor(session), parsed.data.vendorId, {
    commissionRateOverride: null,
  });

  if (!result.ok) {
    if (admin.isNotFound(result.error)) return { error: "That vendor no longer exists." };
    return { error: shopperMessage(result.error) };
  }

  revalidateVendor(parsed.data.vendorId);
  return { message: "Override cleared. Their referral tier now sets the rate." };
}
