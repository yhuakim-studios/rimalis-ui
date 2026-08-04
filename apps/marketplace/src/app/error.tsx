"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { Container } from "@/components/layout";
import { Button, ButtonLink } from "@/components/primitives";

/**
 * The last resort: a page that could not render.
 *
 * Most failures in this app never reach here, by design. The API client returns a
 * `Result` rather than throwing, so a 404 becomes `notFound()`, a timeout becomes
 * an inline `<ErrorState>`, and both keep the rest of the page alive. What reaches
 * this boundary is a genuine bug — a `TypeError` in render, a `parseMoney` throw on
 * a malformed amount — which is exactly what a boundary should be for.
 *
 * ## Why this does not use `<ErrorState>`
 *
 * `<ErrorState>` takes an `ApiError` and asks `shopperMessage()` for its copy.
 * What arrives here is React's `Error`, which has no `kind` and whose `message` is
 * a stack-adjacent string written for a developer. Rendering that to a shopper
 * leaks internals and says nothing useful, so the copy is fixed and the message is
 * not shown.
 *
 * ## `digest` is shown, deliberately
 *
 * In a production build Next replaces the error message with an opaque `digest`
 * and logs the real one server-side. That digest is the only thread connecting
 * "the site broke" to a specific server log line, so it is worth the two lines of
 * quiet type — the same reasoning as `requestId` in `<ErrorState>`.
 *
 * Note this boundary does NOT catch errors in the root layout, which is why the
 * header and footer are absent from what it renders. A layout-level failure needs
 * `global-error.tsx`, and that file deliberately does not exist yet: the root
 * layout does no data fetching, so it has nothing to fail at.
 */

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Container className="py-8 md:py-12">
      <div role="alert" className="flex flex-col items-center gap-4 px-6 py-16 text-center md:py-24">
        <div className="grid size-16 place-items-center rounded-pill bg-danger-soft text-danger" aria-hidden>
          <AlertTriangle className="size-7" strokeWidth={1.5} />
        </div>

        <div className="flex max-w-md flex-col gap-2">
          <h1 className="text-heading text-ink">Something went wrong</h1>
          <p className="text-body text-ink-muted">
            This page didn&rsquo;t load properly. Trying again often fixes it — and if
            it doesn&rsquo;t, the catalogue is still there.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {/* `reset()` re-renders the segment without a full page load, which is
              the right first attempt: it recovers from a transient failure while
              keeping the shopper's scroll position and history. */}
          <Button onClick={reset} icon={<RotateCw className="size-5" strokeWidth={1.5} />}>
            Try again
          </Button>
          <ButtonLink href="/products" variant="secondary">
            Browse products
          </ButtonLink>
        </div>

        {error.digest && (
          <p className="font-mono text-meta text-ink-subtle">Reference: {error.digest}</p>
        )}
      </div>
    </Container>
  );
}
