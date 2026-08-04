import type { ElementType, ReactNode } from "react";
import { cn } from "@/components/primitives";

/**
 * The page measure.
 *
 * One component so the max width and the gutters cannot drift between routes — a
 * catalogue at 1320px next to a product page at 1280px reads as a rendering bug
 * even though neither number is wrong.
 *
 * It wraps the `.container-page` utility from globals.css rather than
 * re-declaring the classes, so a route that reaches for the raw class and a route
 * that uses this component still agree.
 */

export interface ContainerProps {
  as?: ElementType;
  /** `shell` is the wider bound, for full-bleed headers and footers. */
  width?: "content" | "shell";
  className?: string;
  children: ReactNode;
}

export function Container({ as: Tag = "div", width = "content", className, children }: ContainerProps) {
  return (
    <Tag
      className={cn(
        "container-page",
        width === "shell" && "max-w-shell",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * Vertical rhythm between page sections: 64px, 96px from `md`.
 *
 * Both are 8-point steps (`py-16`, `py-24`). Having it as a component rather than
 * a remembered pair of classes is what keeps the rhythm consistent across a dozen
 * routes — the alternative is `py-12` appearing on one page because it looked
 * better in isolation.
 */
export function Section({
  as: Tag = "section",
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={cn("py-16 md:py-24", className)}>{children}</Tag>;
}
