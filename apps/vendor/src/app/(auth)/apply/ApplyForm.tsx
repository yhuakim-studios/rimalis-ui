"use client";

import { useActionState } from "react";
import { applyAsVendor, type FormState } from "@/lib/auth-actions";
import { FormBanner, SubmitButton } from "@/components/forms";
import { Input, Textarea } from "@/components/primitives";
import { SignOutButton } from "@/components/SignOutButton";

/**
 * The application form.
 *
 * Only `storeName` is required, matching the API. That is a product decision
 * worth protecting: demanding a CAC number up front turns away the informal
 * traders who are most of this market, and everything optional here can be filled
 * in from Settings once approved. If a reviewer needs more, the fix is to ask by
 * email, not to gate the form.
 */
export function ApplyForm() {
  const [state, formAction] = useActionState<FormState, FormData>(applyAsVendor, {});

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}

      <Input
        label="Store name"
        name="storeName"
        required
        maxLength={120}
        hint="What shoppers will see. You can change it later."
        error={state.fieldErrors?.["storeName"]}
      />

      <Textarea
        label="What do you sell?"
        name="description"
        rows={3}
        maxLength={2000}
        hint="Optional. A line or two helps whoever reviews your application."
        error={state.fieldErrors?.["description"]}
      />

      <Input
        label="Registered business name"
        name="businessName"
        maxLength={200}
        hint="Optional — only if you trade as a registered company."
        error={state.fieldErrors?.["businessName"]}
      />

      <Input
        label="CAC number"
        name="cacNumber"
        maxLength={50}
        hint="Optional. Not required to start selling."
        error={state.fieldErrors?.["cacNumber"]}
      />

      {/* The only place a referral can be captured. The API attaches the code
          here and nowhere else — miss it and the recruit is permanently
          unattributed, since a reapplication cannot re-point it either.

          `autoCapitalize="characters"` and `spellCheck={false}`: codes are
          uppercase Crockford base32 and get typed on phones, where autocorrect
          turns `7K2QX9` into something else entirely. The API normalises case
          anyway, so this is about the applicant seeing what they meant to type. */}
      <Input
        label="Referral code"
        name="referralCode"
        maxLength={32}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        placeholder="RIM-7K2QX9"
        hint="Optional. If another Rimalis seller invited you, enter their code so they get credit."
        error={state.fieldErrors?.["referralCode"]}
      />

      <SubmitButton fullWidth size="lg">
        Send application
      </SubmitButton>

      <div className="text-center">
        <SignOutButton />
      </div>
    </form>
  );
}
