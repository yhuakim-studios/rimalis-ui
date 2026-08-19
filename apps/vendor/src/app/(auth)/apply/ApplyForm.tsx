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

      <SubmitButton fullWidth size="lg">
        Send application
      </SubmitButton>

      <div className="text-center">
        <SignOutButton />
      </div>
    </form>
  );
}
