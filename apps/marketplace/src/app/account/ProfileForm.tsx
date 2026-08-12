"use client";

import { useActionState } from "react";
import type { User } from "@rimalis/types";
import { Input } from "@/components/primitives";
import { FormBanner, SubmitButton } from "@/components/forms";
import { updateProfile } from "@/lib/account-actions";
import type { FormState } from "@/lib/auth-actions";

/**
 * Name and phone.
 *
 * The email address is shown but not editable, because the API has no endpoint
 * for changing it — `PATCH /users/me` accepts `firstName`, `lastName` and
 * `phone` and nothing else. Rendering a disabled email field would suggest the
 * capability exists somewhere; saying where to write instead is honest.
 */

const INITIAL: FormState = {};

export function ProfileForm({ user }: { user: User }) {
  const [state, action] = useActionState(updateProfile, INITIAL);

  return (
    <form action={action} className="flex max-w-xl flex-col gap-6">
      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}
      {state.message && <FormBanner tone="success">{state.message}</FormBanner>}

      <div className="grid gap-6 sm:grid-cols-2">
        <Input
          label="First name"
          name="firstName"
          autoComplete="given-name"
          defaultValue={user.firstName}
          required
          {...(state.fieldErrors?.["firstName"] ? { error: state.fieldErrors["firstName"] } : {})}
        />
        <Input
          label="Last name"
          name="lastName"
          autoComplete="family-name"
          defaultValue={user.lastName}
          required
          {...(state.fieldErrors?.["lastName"] ? { error: state.fieldErrors["lastName"] } : {})}
        />
      </div>

      <Input
        label="Phone number"
        name="phone"
        type="tel"
        autoComplete="tel"
        defaultValue={user.phone ?? ""}
        placeholder="e.g. 0803 123 4567"
        hint="Couriers use this for delivery. Clear it to remove it."
        {...(state.fieldErrors?.["phone"] ? { error: state.fieldErrors["phone"] } : {})}
      />

      <SubmitButton>Save changes</SubmitButton>
    </form>
  );
}
