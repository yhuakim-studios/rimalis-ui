"use client";

import { useActionState } from "react";
import { Input } from "@/components/primitives";
import { FormBanner, SubmitButton } from "@/components/forms";
import { resendVerification, type FormState } from "@/lib/auth-actions";

/**
 * "Send me another link."
 *
 * The email is pre-filled for a signed-in shopper and editable regardless — a
 * signed-out visitor arriving from an expired link has no session for us to read
 * it from, and typing it is better than sending them to sign in first.
 *
 * ## The success copy is deliberately non-committal
 *
 * "If that address has an account…". The API answers identically whether or not
 * the address exists, precisely so this endpoint cannot be used to find out who
 * has an account here. Copy that said "sent!" would leak exactly what the API
 * refused to.
 */

const INITIAL: FormState = {};

export function ResendVerificationForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, action] = useActionState(resendVerification, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}
      {state.message && <FormBanner tone="success">{state.message}</FormBanner>}

      <Input
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={defaultEmail}
        required
      />

      <SubmitButton variant="secondary" fullWidth>
        Send a new link
      </SubmitButton>
    </form>
  );
}
