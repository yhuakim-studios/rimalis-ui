import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * A small status pill.
 *
 * Colour discipline, which is most of what a badge component is for: `neutral`
 * is the default and covers almost everything. `brand` is a positive or settled
 * signal. `danger` is for cancelled and failed, and nothing else.
 *
 * A badge is never the only carrier of a fact. Colour alone fails for colour-blind
 * users and for anyone using a screen reader, so every variant here also carries
 * words; that is why there is no `icon`-only form.
 *
 * ## Why this copy has a fourth tone the marketplace's does not
 *
 * A seller scanning fifty order rows needs to find the ones that need work,
 * and on the storefront that problem does not exist — a shopper's badge is
 * decoration on a fact they can already read.
 *
 * The reference design solves it with an orange/amber palette. This product has
 * **one accent and it is black** (`--color-brand-600`, see theme.css), so
 * borrowing a second hue would break the rule the whole system rests on. `strong`
 * gets the same emphasis out of *weight* instead: a filled dark pill against
 * tinted and outlined ones. That is the design guide's own instruction —
 * hierarchy through contrast and weight, never through more colours — and it
 * survives greyscale, which an amber-versus-green pairing does not.
 *
 * Use it for the ONE state that demands action. Two filled pills in a row is two
 * primary emphases, and then neither is.
 */

type Tone = "neutral" | "brand" | "strong" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-canvas text-ink-muted border border-divider",
  // A tint, not a fill: a filled brand badge competes with the primary button,
  // and the guide allows exactly one primary emphasis per section.
  brand: "bg-brand-50 text-brand-700 border border-brand-100",
  // The exception to the line above, and the reason it is named `strong` rather
  // than after a status: it IS the section's emphasis, so a row carrying one
  // should not also carry a primary button.
  strong: "bg-brand-600 text-white border border-brand-600",
  danger: "bg-danger-soft text-danger border border-danger/20",
};

export interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
}

export function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-3 py-1 text-caption whitespace-nowrap",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
