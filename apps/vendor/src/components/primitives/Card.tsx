import type { ElementType, ReactNode } from "react";
import { cn } from "./cn";

/**
 * A resting surface.
 *
 * Two rules from the design system:
 *
 * - `rounded-card` (24px) and `bg-surface`. The white against the warm `canvas`
 *   is what makes a card read as raised; that is why the page background is not
 *   pure white.
 * - **Never a border AND a shadow.** Pick whichever carries the meaning:
 *   `elevated` for something that sits above the page, `flat` for a grouping
 *   whose edge is structural. Both together is the visual noise the two-shadow
 *   rule exists to prevent, so the two variants are mutually exclusive by
 *   construction rather than by discipline.
 *
 * `as` exists because a card is often semantically an `<article>` or a `<li>`,
 * and wrapping a div in one of those to get the semantics right produces a
 * pointless extra node.
 */

type Tone = "elevated" | "flat";

const TONES: Record<Tone, string> = {
  elevated: "bg-surface shadow-card",
  flat: "bg-surface border border-divider",
};

const PADDING = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
} as const;

export interface CardProps {
  as?: ElementType;
  tone?: Tone;
  /** `none` for a card whose content is edge-to-edge, e.g. a product image. */
  padding?: keyof typeof PADDING;
  /** Adds a hover lift. Only for a card that is entirely a link. */
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}

export function Card({
  as: Tag = "div",
  tone = "elevated",
  padding = "md",
  interactive = false,
  className,
  children,
}: CardProps) {
  return (
    <Tag
      className={cn(
        // `overflow-hidden` so an edge-to-edge image inherits the 24px radius
        // rather than squaring off its corners — the single most common way a
        // rounded card ends up looking broken.
        "relative overflow-hidden rounded-card",
        TONES[tone],
        PADDING[padding],
        interactive &&
          // Transform, not margin or top, so the lift does not reflow the grid.
          "transition-[transform,box-shadow] duration-200 ease-out-soft " +
            "hover:-translate-y-0.5 hover:shadow-raise",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
