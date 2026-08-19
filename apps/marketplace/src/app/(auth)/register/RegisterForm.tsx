"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Input } from "@/components/primitives";
import { FormBanner, SubmitButton } from "@/components/forms";
import { signUp, type FormState } from "@/lib/auth-actions";

/**
 * Registration.
 *
 * ## The password rule is stated up front, not discovered on submit
 *
 * The API requires 8+ characters with a capital and a digit. That rule is in the
 * field's `hint` before anyone types, because the alternative — a red message
 * after a failed submit — makes the shopper compose a password twice. The same
 * rule is enforced in the action and again by the API; three copies, and the
 * hint is the only one anybody sees when things go right.
 *
 * `autoComplete="new-password"` rather than `current-password`: it is what tells
 * a password manager to *generate* one rather than autofill an existing entry.
 */

const INITIAL: FormState = {};

export function RegisterForm({ next }: { next: string }) {
  const [state, action] = useActionState(signUp, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="next" value={next} />

      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}

      <div className="grid gap-6 sm:grid-cols-2">
        <Input
          label="First name"
          name="firstName"
          autoComplete="given-name"
          required
          {...(state.fieldErrors?.["firstName"] ? { error: state.fieldErrors["firstName"] } : {})}
        />
        <Input
          label="Last name"
          name="lastName"
          autoComplete="family-name"
          required
          {...(state.fieldErrors?.["lastName"] ? { error: state.fieldErrors["lastName"] } : {})}
        />
      </div>

      <Input
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        required
        hint="We'll send a verification link here. You'll need it to check out."
        {...(state.fieldErrors?.["email"] ? { error: state.fieldErrors["email"] } : {})}
      />

      <Input
        label="Phone number"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="e.g. 0803 123 4567"
        hint="Optional. Couriers use it for delivery."
        {...(state.fieldErrors?.["phone"] ? { error: state.fieldErrors["phone"] } : {})}
      />

      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters, with one capital letter and one number."
        {...(state.fieldErrors?.["password"] ? { error: state.fieldErrors["password"] } : {})}
      />

      <SubmitButton size="lg" fullWidth>
        Create account
      </SubmitButton>

      <p className="text-center text-caption text-ink-muted">
        Already have an account?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-medium text-ink underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
