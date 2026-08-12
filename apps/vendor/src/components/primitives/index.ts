/**
 * The primitives.
 *
 * ## Why these are in the app and not in `packages/ui`
 *
 * `packages/ui` is still `export {}`, and that is deliberate. The repo's own rule
 * is **extract, don't invent**: a shared component library written before a real
 * screen exists encodes guesses about what will be shared, and the guesses are
 * wrong in ways that are expensive to unpick once three apps import them.
 *
 * This is the first real app. So the primitives live here through Phase 7, and
 * Phase 8 extracts the ones that turned out to be genuinely shared — guided by
 * what the vendor and admin apps actually reach for, not by what looks reusable
 * today. Moving a component later is a mechanical change; un-designing a wrong
 * abstraction that three apps depend on is not.
 */

export { cn } from "./cn";
export {
  Button,
  buttonClasses,
  buttonFocusInset,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from "./Button";
export { ButtonLink, type ButtonLinkProps } from "./ButtonLink";
export { IconButton, type IconButtonProps } from "./IconButton";
export { Card, type CardProps } from "./Card";
export { Badge, type BadgeProps } from "./Badge";
export { Skeleton, SkeletonText, type SkeletonProps } from "./Skeleton";
export {
  Input,
  Select,
  Textarea,
  type InputProps,
  type SelectProps,
  type TextareaProps,
} from "./Field";
/**
 * Copied from the marketplace when the vendor app became the second consumer.
 * A genuine candidate for `packages/ui` — see the note at the top of this file.
 */
export { Pagination, type PaginationProps } from "./Pagination";
