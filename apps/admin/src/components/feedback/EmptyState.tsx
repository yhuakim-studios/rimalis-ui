import type { ReactNode } from "react";
import { Button, ButtonLink } from "@/components/primitives";

/**
 * A successful response with zero rows.
 *
 * ## The distinction this component defends
 *
 * **An empty result is a success, not an error.** A search for "xyzzy" that
 * matches nothing worked perfectly — the shopper got a correct answer. So an
 * empty catalogue must never render an error boundary, never call `notFound()`,
 * and never say anything that implies a fault.
 *
 * The three states are three different mechanisms and conflating them is the most
 * common failure in this area:
 *
 *   empty      valid response, zero rows  →  this component
 *   not found  404 on a specific resource →  `notFound()` → not-found.tsx
 *   error      network / timeout / 5xx    →  `<ErrorState>` or error.tsx
 *
 * ## The copy rule
 *
 * An empty state must say **why** it is empty and **what to do next**, and the
 * two differ completely depending on whether a filter is active. "No products
 * found" on a filtered catalogue is unhelpful; "No products match these filters"
 * with a Clear filters button is actionable. Callers pass both, which is why
 * `title` and `body` are separate required props rather than one blob.
 */

export interface EmptyStateProps {
  /** A 24–32px lucide icon. Decorative — the title carries the meaning. */
  icon?: ReactNode;
  /** What is empty, in the shopper's terms. Never "No data". */
  title: string;
  /** Why, and what to do about it. */
  body: string;
  /** The one action that resolves this state, if there is one. */
  action?: { label: string; href: string } | { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center md:py-24">
      {icon && (
        <div className="grid size-16 place-items-center rounded-pill bg-canvas text-ink-subtle" aria-hidden>
          {icon}
        </div>
      )}

      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-section text-ink">{title}</h2>
        <p className="text-body text-ink-muted">{body}</p>
      </div>

      {/*
        An `href` action navigates and so must be an anchor; an `onClick` action
        (Clear filters) mutates the current page and so must be a button. Both
        share one class recipe via `buttonClasses`, so they cannot drift apart.
      */}
      {action &&
        ("href" in action ? (
          <ButtonLink href={action.href}>{action.label}</ButtonLink>
        ) : (
          <Button onClick={action.onClick}>{action.label}</Button>
        ))}
    </div>
  );
}
