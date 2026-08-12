"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Input } from "@/components/primitives";
import { FormBanner, SubmitButton } from "@/components/forms";
import { signIn, type FormState } from "@/lib/auth-actions";

/**
 * The sign-in form.
 *
 * ## Why `next` is a hidden field rather than read from the URL here
 *
 * The action needs it, and a Server Action cannot see the URL the form was
 * rendered on — it runs in its own request with no notion of the page's
 * location. Passing it through the form is how the destination survives the
 * round trip. It is re-validated by `safeNext()` on the server side regardless,
 * because a hidden field is a value the shopper can edit.
 *
 * ## `autoComplete` is not filler
 *
 * `email` and `current-password` are what let a password manager offer the right
 * entry. Without them a manager either offers nothing or offers to save a new
 * credential over the existing one, and the shopper blames the site.
 */

const INITIAL: FormState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="next" value={next} />

      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}

      <Input
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        required
        {...(state.fieldErrors?.["email"] ? { error: state.fieldErrors["email"] } : {})}
      />

      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        {...(state.fieldErrors?.["password"] ? { error: state.fieldErrors["password"] } : {})}
      />

      <SubmitButton size="lg" fullWidth>
        Sign in
      </SubmitButton>

      <p className="text-center text-caption text-ink-muted">
        New here?{" "}
        <Link
          href={`/register?next=${encodeURIComponent(next)}`}
          className="font-medium text-ink underline underline-offset-4"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
