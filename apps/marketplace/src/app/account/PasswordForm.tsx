"use client";

import { useActionState } from "react";
import { Input } from "@/components/primitives";
import { FormBanner, SubmitButton } from "@/components/forms";
import { changePassword, type FormState } from "@/lib/auth-actions";

/**
 * Change password.
 *
 * The current password is required even though the caller is already signed in:
 * an unattended session should not be enough to take an account over. That is
 * the API's rule and it is worth restating in the hint, because a shopper who
 * thinks it is redundant will assume the field is a bug.
 *
 * On success the action redirects to `/login?reason=password-changed` — there is
 * no success state to render here, because by then every session including this
 * one has been destroyed server-side.
 */

const INITIAL: FormState = {};

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, INITIAL);

  return (
    <form action={action} className="flex max-w-xl flex-col gap-6">
      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}

      <Input
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
        {...(state.fieldErrors?.["currentPassword"] ? { error: state.fieldErrors["currentPassword"] } : {})}
      />

      <Input
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters, with one capital letter and one number."
        {...(state.fieldErrors?.["newPassword"] ? { error: state.fieldErrors["newPassword"] } : {})}
      />

      <SubmitButton>Change password</SubmitButton>
    </form>
  );
}
