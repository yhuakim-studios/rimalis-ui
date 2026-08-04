import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * A small status pill.
 *
 * Colour discipline, which is most of what a badge component is for: `neutral`
 * is the default and covers almost everything. `brand` is reserved for "in
 * stock" — a genuine positive signal at the point of purchase. `danger` is for
 * "out of stock" and nothing else.
 *
 * A badge is never the only carrier of a fact. Colour alone fails for colour-blind
 * shoppers and for anyone using a screen reader, so every variant here also
 * carries words; that is why there is no `icon`-only form.
 */

type Tone = "neutral" | "brand" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-canvas text-ink-muted border border-divider",
  // A tint, not a fill: a filled brand badge competes with the primary button,
  // and the guide allows exactly one primary emphasis per section.
  brand: "bg-brand-50 text-brand-700 border border-brand-100",
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
