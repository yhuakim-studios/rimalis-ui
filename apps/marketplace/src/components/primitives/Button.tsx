import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

/**
 * The button.
 *
 * Non-negotiables from the design system, all of which are easy to lose one
 * component at a time:
 *
 * - **48px minimum height** (`min-h-12`), not `h-12`. A button whose label wraps
 *   on a narrow phone must grow, not clip — and a fixed height plus wrapped text
 *   is a clipped label, which is worse than a taller button.
 * - `rounded-button` (16px), never the card's 24px or a bare `rounded-lg`.
 * - **The loading state must not change the width.** See `loading` below; this is
 *   the detail most implementations get wrong and it causes a visible layout jump
 *   at the exact moment the shopper is waiting to find out whether their click
 *   worked.
 * - One accent. `primary` is the only filled-brand variant, and there is at most
 *   one primary button per section.
 */

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger";
export type ButtonSize = "md" | "lg";

type Variant = ButtonVariant;
type Size = ButtonSize;

/**
 * Complete class strings per variant, not overrides on a shared base — see the
 * note in `cn.ts`. Each row is independently readable, which is what makes a
 * contrast or focus regression visible in review.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-900 " +
    // The ring would be invisible against the fill, so invert it. See the
    // `[data-focus-inset]` rule in globals.css.
    "disabled:bg-brand-600/40",
  secondary:
    "bg-surface text-ink border border-divider-strong hover:bg-canvas active:bg-divider " +
    "disabled:text-ink-subtle disabled:border-divider",
  tertiary:
    "bg-transparent text-ink hover:bg-divider/60 active:bg-divider " +
    "disabled:text-ink-subtle",
  danger:
    "bg-danger text-white hover:bg-danger/90 active:bg-danger " +
    "disabled:bg-danger/40",
};

const SIZES: Record<Size, string> = {
  // 48px and 56px — the guide's two touch sizes. Both are `min-h`, not `h`.
  md: "min-h-12 px-6 text-body",
  lg: "min-h-14 px-8 text-body",
};

/**
 * The button's visual recipe, without the `<button>`.
 *
 * Exists for **links that must look like buttons** — an `<a>` styled as a CTA,
 * which is the correct markup for anything that navigates. The wrong shapes are
 * a `<Link>` wrapping a `<Button>` (an `<a>` around a `<button>` is invalid HTML
 * and browsers disagree on what it does) and a `<Button onClick={router.push}>`
 * (no middle-click, no open-in-new-tab, no href for a crawler).
 *
 * It is a function rather than a copied class string because a copied string is
 * how the accent colour ends up defined in nine places and drifts in three of
 * them. If a CTA anchor's hover state ever differs from a Button's, this was
 * bypassed.
 *
 * Not for use on an actual `<Button>` — that applies it internally.
 */
export const buttonClasses = (
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  fullWidth = false,
): string =>
  cn(
    "relative inline-flex items-center justify-center gap-2 rounded-button font-medium",
    "transition-colors duration-150 ease-out-soft",
    "disabled:cursor-not-allowed",
    SIZES[size],
    VARIANTS[variant],
    fullWidth && "w-full",
  );

/** `data-focus-inset` belongs on the filled variants, whose ring would otherwise
 * be invisible against their own background. Kept beside `buttonClasses` so a
 * CTA anchor cannot pick up the classes and forget the attribute. */
export const buttonFocusInset = (variant: ButtonVariant): "" | undefined =>
  variant === "primary" || variant === "danger" ? "" : undefined;

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: Variant;
  size?: Size;
  /**
   * Shows a spinner in place of the label.
   *
   * Also sets `disabled` and `aria-busy`. Do NOT pass `disabled` separately to
   * mean "busy": a screen-reader user hearing only "dimmed" learns the button is
   * unavailable, not that their action is in flight.
   */
  loading?: boolean;
  /** Fills the container. For mobile CTAs and dialog footers. */
  fullWidth?: boolean;
  /** A 20px lucide icon before the label. Never the only content — use IconButton. */
  icon?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  icon,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      // `type="button"` by default, not the HTML default of `"submit"`. A button
      // inside a form that submits it by accident is a whole class of bug —
      // including a "Remove item" in a cart that places the order.
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-focus-inset={buttonFocusInset(variant)}
      className={buttonClasses(variant, size, fullWidth)}
      {...rest}
    >
      {/*
        Width stability, which is the whole reason this is not a simple ternary.

        The label stays in the DOM and in flow, holding the button's width, and
        becomes invisible — so the box does not resize when loading flips. The
        spinner is absolutely positioned over it.

        `invisible` rather than `opacity-0`: both hide it visually, but
        `visibility: hidden` also removes it from the accessibility tree, so a
        screen reader does not read a label that is no longer the button's
        meaning. `aria-hidden` on the wrapper covers the same ground for
        implementations that ignore visibility.
      */}
      <span
        className={cn("inline-flex items-center gap-2", loading && "invisible")}
        aria-hidden={loading || undefined}
      >
        {icon}
        {children}
      </span>

      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          {/* The one spinner in the product. Everywhere else uses skeletons — a
              spinner is right only when the wait replaces an action rather than
              content. `aria-hidden` because `aria-busy` above already announces
              the state; both would say it twice. */}
          <Loader2 className="size-5 animate-spin" strokeWidth={1.5} aria-hidden />
        </span>
      )}
    </button>
  );
}
