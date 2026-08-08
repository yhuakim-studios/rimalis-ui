"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { type ApiError, shopperMessage } from "@rimalis/api-client";
import { Button } from "@/components/primitives";

/**
 * Something went wrong that was not the shopper's fault.
 *
 * ## The rule this component enforces
 *
 * **A transport failure never borrows a 404's copy.** If Railway is mid-deploy
 * and a product page cannot load, the shopper must be told *we* are having
 * trouble — not that the product does not exist. Someone told a product is gone
 * does not reload; they leave, and they do not come back to check. That single
 * distinction is why `ApiError.kind` exists at all, and `shopperMessage()` in the
 * API client is the one place the mapping lives.
 *
 * So this component never composes its own message from a status code. Pass it
 * the `ApiError` and it asks `shopperMessage()`.
 *
 * ## Why `requestId` is shown
 *
 * The API puts a request id in the body of every 500 and echoes an inbound
 * `x-request-id`. "It said something went wrong" is unactionable; a request id
 * turns a support message into one `grep` against the server logs. It is
 * deliberately quiet typography — useful to the one shopper in a thousand who
 * quotes it, invisible to the rest.
 *
 * ## Inline, not a boundary
 *
 * This renders *in place* of the section that failed, so the rest of the page
 * survives — a failed "related products" strip should not take down the product
 * the shopper is looking at. `error.tsx` is for when the page itself cannot
 * render, and it uses this component underneath.
 */

export interface ErrorStateProps {
  /** The failure. Its `kind` decides the copy — see the header. */
  error: ApiError;
  /**
   * Retry. Renders a button when provided.
   *
   * Omit it for a failure retrying cannot fix (a 400, a 403) — a Try again button
   * that reliably fails again is worse than none, because the shopper concludes
   * the site is broken rather than that they need to do something different.
   */
  onRetry?: () => void;
  /** Names what failed, for an inline error inside a larger page. */
  title?: string;
}

export function ErrorState({ error, onRetry, title }: ErrorStateProps) {
  return (
    <div
      // `role="alert"` so the failure is announced when it replaces content the
      // shopper was waiting for, rather than sitting silently on screen.
      role="alert"
      className="flex flex-col items-center gap-4 px-6 py-16 text-center md:py-24"
    >
      <div className="grid size-16 place-items-center rounded-pill bg-danger-soft text-danger" aria-hidden>
        <AlertTriangle className="size-7" strokeWidth={1.5} />
      </div>

      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-section text-ink">{title ?? "Something went wrong"}</h2>
        <p className="text-body text-ink-muted">{shopperMessage(error)}</p>
      </div>

      {onRetry && (
        <Button variant="secondary" onClick={onRetry} icon={<RotateCw className="size-5" strokeWidth={1.5} />}>
          Try again
        </Button>
      )}

      {error.requestId && (
        // `text-meta` and `ink-subtle`: this is metadata that is redundant for
        // almost everyone, which is exactly what that colour is scoped to. The
        // one shopper who quotes it saves an hour of log archaeology.
        <p className="font-mono text-meta text-ink-subtle">
          Reference: {error.requestId}
        </p>
      )}
    </div>
  );
}
