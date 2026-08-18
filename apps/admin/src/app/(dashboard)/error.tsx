"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/primitives";

/**
 * The boundary for anything the pages under `(dashboard)` throw.
 *
 * ## What lands here, and what deliberately does not
 *
 * `requireAdmin()` **throws** rather than redirecting when the failure is ours — a
 * network error, a timeout, a 5xx, a malformed body. That distinction is the whole
 * reason this file exists: redirecting those to `/not-authorised` would tell a real
 * admin their account had been demoted because the API was mid-deploy, which is
 * the most alarming thing this app could get wrong.
 *
 * What does NOT land here is any authorisation outcome. Those are redirects, and a
 * redirect is not an error — a 401 goes to `/login`, a valid non-admin session goes
 * to `/not-authorised`. If you ever see this component rendering for one of those,
 * something upstream has confused the two.
 *
 * ## Why this does not use `<ErrorState>`
 *
 * `ErrorState` takes an `ApiError` and deliberately has **no retry callback** —
 * its own doc explains why: every one of its callers is a Server Component, and a
 * function cannot cross that boundary. Here the situation is inverted. This file
 * IS a Client Component, `reset` is a real function handed to it by Next, and what
 * arrives is an `Error` rather than an `ApiError`. Forcing it through `ErrorState`
 * would mean fabricating an `ApiError` to satisfy a signature, and dropping the
 * one genuinely useful affordance on the page.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      // Announced when it replaces content the admin was waiting for, rather than
      // sitting silently on screen.
      role="alert"
      className="flex flex-col items-center gap-4 px-6 py-16 text-center md:py-24"
    >
      <div
        className="grid size-16 place-items-center rounded-pill bg-danger-soft text-danger"
        aria-hidden
      >
        <AlertTriangle className="size-7" strokeWidth={1.5} />
      </div>

      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-section text-ink">Something went wrong on our side</h2>
        {/*
          Safe to show: these are our own thrown messages and `ApiError.message`
          from the client, neither of which carries a token or a stack. Next
          replaces it with a digest in production for genuinely unexpected throws,
          which is the behaviour we want anyway.
        */}
        <p className="text-body text-ink-muted">{error.message}</p>
      </div>

      <Button onClick={reset} variant="secondary">
        Try again
      </Button>

      {error.digest && (
        <p className="font-mono text-meta text-ink-subtle">
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
