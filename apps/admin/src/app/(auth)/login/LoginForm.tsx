"use client";

import { useActionState } from "react";
import { signIn, type FormState } from "@/lib/auth-actions";
import { FormBanner, SubmitButton } from "@/components/forms";
import { Input } from "@/components/primitives";

/**
 * The sign-in form.
 *
 * A Client Component because `useActionState` needs one, and because the error
 * has to render *without* losing what was typed. The action itself runs on the
 * server and the tokens never reach this bundle — see `auth-actions.ts`. That
 * matters more here than on the other two apps: the token this exchange produces
 * is the one that can suspend a vendor and reprice the catalogue.
 */

/** Copy for the three ways `/api/session/refresh` can send someone here. */
const REASONS: Record<string, string> = {
  expired: "Your session timed out. Sign in again to pick up where you left off.",
  // The API destroys every session for an account when it sees a refresh token
  // replayed. Naming that plainly is kinder than "something went wrong": the
  // admin has just been signed out on every device and deserves to know it was a
  // security measure rather than a fault.
  revoked:
    "We signed you out of every device as a precaution. Sign in again — nothing on the platform has changed.",
  unreachable: "We couldn't reach our servers a moment ago. Your details are fine — try again.",
};

export function LoginForm({ next, reason }: { next: string; reason?: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(signIn, {});

  const reasonCopy = reason === undefined ? undefined : REASONS[reason];

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {/*
        The post-login destination travels in the form, not in a closure. A
        hidden field survives the server round trip, and `safeNext()` re-checks it
        on the way out — an open redirect on a login page is the classic phishing
        primitive, so it is validated on both sides rather than trusted because
        this component wrote it.
      */}
      <input type="hidden" name="next" value={next} />

      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}
      {!state.error && reasonCopy && <FormBanner tone="success">{reasonCopy}</FormBanner>}

      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.["email"]}
      />

      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.["password"]}
      />

      <SubmitButton fullWidth size="lg">
        Sign in
      </SubmitButton>

      {/*
        No "create an account" link, and no password reset. Admin accounts are
        made by another admin promoting an existing user (`PATCH /users/:id/role`);
        there is no self-service route into this app, and offering one would
        advertise a door that does not exist.
      */}
      <p className="text-caption text-ink-muted">
        Admin access is granted by another admin. If you have an account and cannot
        get in, ask someone on the team to check your role.
      </p>
    </form>
  );
}
