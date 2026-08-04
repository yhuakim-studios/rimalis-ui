import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

/**
 * An icon-only control.
 *
 * **44×44px minimum, even though the glyph is 20px.** That gap is the entire
 * reason this is a separate component rather than a `Button` variant: an icon
 * button sized to its icon is a 20px tap target, which is roughly half the
 * smallest reliable one, and the failure is invisible on a desktop mouse and
 * constant on a phone.
 *
 * `size-11` is 44px. Do not reduce it to make a header look tighter — reduce the
 * padding around it instead.
 *
 * `label` is required and becomes `aria-label`. An icon-only button without one
 * is announced as "button", which tells a screen-reader user nothing, and TypeScript
 * refusing to compile is a better reminder than a lint rule nobody has installed.
 */

type Variant = "ghost" | "surface";

const VARIANTS: Record<Variant, string> = {
  ghost: "text-ink hover:bg-divider/60 active:bg-divider",
  surface: "bg-surface text-ink border border-divider-strong hover:bg-canvas",
};

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "aria-label"> {
  /** Announced to assistive technology. Required — see the header. */
  label: string;
  variant?: Variant;
  /** A 20px lucide icon. */
  children: ReactNode;
}

export function IconButton({
  label,
  variant = "ghost",
  children,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      // A visible tooltip on hover for sighted mouse users, which `aria-label`
      // alone does not provide. Same string, so the two cannot disagree.
      title={label}
      className={cn(
        "inline-grid size-11 shrink-0 place-items-center rounded-pill",
        "transition-colors duration-150 ease-out-soft",
        "disabled:cursor-not-allowed disabled:text-ink-subtle",
        VARIANTS[variant],
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
