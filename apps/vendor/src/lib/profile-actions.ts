"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { shopperMessage } from "@rimalis/api-client";
import { ctxFor, requireApprovedVendor, vendor } from "./auth";

/**
 * Storefront profile and payout details.
 *
 * Two actions rather than one form, because they are two different kinds of change:
 * the profile is presentation and can be edited a field at a time, while the payout
 * triple must move as a unit.
 */

export interface ProfileState {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

const profileSchema = z.object({
  storeName: z
    .string()
    .min(2, "Your store name needs at least 2 characters.")
    .max(120, "Keep the store name under 120 characters."),
  description: z.string().max(2000, "Keep the description under 2000 characters.").optional(),
  businessName: z.string().max(200).optional(),
  cacNumber: z.string().max(50).optional(),
});

/**
 * The payout triple.
 *
 * `paystackSettlementBank` is a **bank code** like `"058"`, not a bank name — the seed
 * uses `058`, `044`, `011`, `057`, `070`. A vendor typing "GTBank" here produces a
 * settlement that fails at Paystack rather than at our validation, so the field is
 * constrained to digits and the form says so.
 *
 * Account numbers are ten digits in Nigeria (NUBAN). Checking that here catches the
 * transposition that would otherwise send money to a stranger.
 */
const payoutSchema = z.object({
  paystackSubaccountCode: z
    .string()
    .min(1, "Enter your Paystack subaccount code.")
    .regex(/^ACCT_[A-Za-z0-9]+$/, "A subaccount code looks like ACCT_xxxxxxxxxx."),
  paystackSettlementBank: z
    .string()
    .regex(/^\d{3}$/, "Use the 3-digit bank code, not the bank's name."),
  paystackAccountNumber: z
    .string()
    .regex(/^\d{10}$/, "A Nigerian account number is exactly 10 digits."),
});

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && errors[key] === undefined) errors[key] = issue.message;
  }
  return errors;
}

export async function updateProfile(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const parsed = profileSchema.safeParse({
    storeName: String(formData.get("storeName") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    businessName: String(formData.get("businessName") ?? "").trim() || undefined,
    cacNumber: String(formData.get("cacNumber") ?? "").trim() || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireApprovedVendor("/settings");
  const result = await vendor.updateProfile(ctxFor(session), parsed.data);

  if (!result.ok) return { error: shopperMessage(result.error) };

  // The header renders the store name on every screen, so a rename has to
  // invalidate the layout rather than just this page.
  revalidatePath("/", "layout");
  return { message: "Your store details are saved." };
}

/**
 * Set the Paystack subaccount that receives this vendor's share.
 *
 * ⚠️ **This is the single highest-consequence field in the app.** Until it is set,
 * `payments.service.ts` refuses to build a split and every checkout containing this
 * vendor's items fails with 409 `VENDOR_PAYOUT_NOT_CONFIGURED` — while the storefront
 * still shows their listings as buyable. And once it is set, it decides where money
 * goes.
 *
 * Nothing here validates the details against Paystack; the API does not offer a
 * verification call. So a well-formed but wrong account number is accepted by both
 * sides and discovered only when a settlement lands somewhere unexpected. The form
 * says as much rather than implying a check that does not happen.
 */
export async function updatePayoutInfo(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const parsed = payoutSchema.safeParse({
    paystackSubaccountCode: String(formData.get("paystackSubaccountCode") ?? "").trim(),
    paystackSettlementBank: String(formData.get("paystackSettlementBank") ?? "").trim(),
    paystackAccountNumber: String(formData.get("paystackAccountNumber") ?? "").trim(),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireApprovedVendor("/settings");
  const result = await vendor.updatePayoutInfo(ctxFor(session), parsed.data);

  if (!result.ok) {
    if (result.error.kind === "http" && result.error.status === 409) {
      return {
        error: "That subaccount code is already linked to another store on Rimalis.",
      };
    }
    return { error: shopperMessage(result.error) };
  }

  // The header's warning badge and the dashboard's blocking banner both read this,
  // so clearing it has to invalidate the layout and the dashboard.
  revalidatePath("/", "layout");
  revalidatePath("/");
  return { message: "Payout details saved. Shoppers can now buy from you." };
}
