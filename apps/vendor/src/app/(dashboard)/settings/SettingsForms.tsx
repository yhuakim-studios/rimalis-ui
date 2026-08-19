"use client";

import { useActionState } from "react";
import type { VendorProfile } from "@rimalis/types";
import { updatePayoutInfo, updateProfile, type ProfileState } from "@/lib/profile-actions";
import { FormBanner, SubmitButton } from "@/components/forms";
import { Input, Textarea } from "@/components/primitives";

/**
 * The two settings forms.
 *
 * Separate `useActionState` per form, so saving the profile does not clear a payout
 * error and vice versa — one shared state would make each save wipe the other's
 * feedback.
 */

export function ProfileForm({ vendor }: { vendor: VendorProfile }) {
  const [state, formAction] = useActionState<ProfileState, FormData>(updateProfile, {});

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}
      {state.message && <FormBanner tone="success">{state.message}</FormBanner>}

      <Input
        label="Store name"
        name="storeName"
        required
        maxLength={120}
        defaultValue={vendor.storeName}
        hint="What shoppers see on your storefront and beside every listing."
        error={state.fieldErrors?.["storeName"]}
      />

      <Textarea
        label="About your store"
        name="description"
        rows={3}
        maxLength={2000}
        defaultValue={vendor.description ?? ""}
        hint="Shown on your storefront page."
        error={state.fieldErrors?.["description"]}
      />

      <Input
        label="Registered business name"
        name="businessName"
        maxLength={200}
        defaultValue={vendor.businessName ?? ""}
        hint="Optional. Not shown to shoppers."
        error={state.fieldErrors?.["businessName"]}
      />

      <Input
        label="CAC number"
        name="cacNumber"
        maxLength={50}
        defaultValue={vendor.cacNumber ?? ""}
        hint="Optional. Not shown to shoppers."
        error={state.fieldErrors?.["cacNumber"]}
      />

      <SubmitButton>Save store details</SubmitButton>
    </form>
  );
}

/**
 * Bank details.
 *
 * ## Why every field is pre-filled and nothing is masked
 *
 * A vendor checking whether the right account is on file has to be able to read it.
 * Masking the account number would mean the only way to verify it is to overwrite it,
 * which is worse: a re-typed number is a fresh chance to transpose two digits, on the
 * one field where that misroutes money.
 *
 * Nothing here is a secret in the credential sense — a subaccount code and an account
 * number identify a destination rather than authorise a withdrawal, and the page is
 * already behind a session that can change them.
 *
 * ## The three fields submit together
 *
 * `PATCH /vendors/me/payout-info` takes the triple as a unit, and that is right: a
 * subaccount code paired with a leftover account number from a different bank is a
 * misrouted settlement. So there is no per-field save here.
 */
export function PayoutForm({ vendor }: { vendor: VendorProfile }) {
  const [state, formAction] = useActionState<ProfileState, FormData>(updatePayoutInfo, {});
  const configured = vendor.paystackSubaccountCode !== null;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}
      {state.message && <FormBanner tone="success">{state.message}</FormBanner>}

      {!configured && (
        <FormBanner tone="error">
          Until these are filled in, checkout fails for every shopper who tries to buy from you —
          even though your listings look live.
        </FormBanner>
      )}

      <Input
        label="Paystack subaccount code"
        name="paystackSubaccountCode"
        required
        defaultValue={vendor.paystackSubaccountCode ?? ""}
        placeholder="ACCT_xxxxxxxxxx"
        hint="From your Paystack dashboard, under Subaccounts."
        error={state.fieldErrors?.["paystackSubaccountCode"]}
      />

      <Input
        label="Bank code"
        name="paystackSettlementBank"
        required
        inputMode="numeric"
        maxLength={3}
        defaultValue={vendor.paystackSettlementBank ?? ""}
        placeholder="058"
        // The bank CODE, not the name — a vendor typing "GTBank" produces a
        // settlement that fails at Paystack rather than at our validation.
        hint="The 3-digit code, not the bank's name. GTBank is 058, Access is 044, First Bank is 011."
        error={state.fieldErrors?.["paystackSettlementBank"]}
      />

      <Input
        label="Account number"
        name="paystackAccountNumber"
        required
        inputMode="numeric"
        maxLength={10}
        defaultValue={vendor.paystackAccountNumber ?? ""}
        placeholder="0123456789"
        hint="10 digits. Check this carefully — we can't verify it for you, and it decides where your money goes."
        error={state.fieldErrors?.["paystackAccountNumber"]}
      />

      <SubmitButton>{configured ? "Update payout details" : "Save payout details"}</SubmitButton>
    </form>
  );
}
