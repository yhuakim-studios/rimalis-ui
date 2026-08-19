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
 * These files are now byte-identical in THREE apps — marketplace, vendor and
 * here. That is the extraction case arriving, not weakening: the evidence the
 * rule was waiting for is exactly "three apps independently reached for the same
 * component and did not need to change it".
 *
 * It is deliberately still not acted on inside the admin build. Extracting into
 * `packages/ui` touches two already-shipped apps and is a separate, reviewable
 * change with its own blast radius; doing it as a side effect of building a third
 * app is how a refactor ends up bundled with a feature and neither gets read
 * properly. Moving a component later is mechanical. Do it on its own.
 *
 * ⚠️ Until then, these are COPIES. A fix here does not reach the other two apps.
 * If you change one, grep the other two — `Badge.tsx` has already drifted once
 * (a doc comment only, so far).
 *
 * ⚠️ KNOWN DIVERGENCE, deliberate: `ButtonLink` here takes a `prefetch` prop that
 * **defaults to `false`**, which the other two copies do not have. Every
 * destination in this app is ADMIN-gated, so Next's prefetch-on-viewport default
 * turns a row of links into a row of authenticated renders that can trigger
 * concurrent session refreshes — which the API treats as token theft. Read the
 * header of ButtonLink.tsx before reconciling the three files.
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
/**
 * The table, and the one component here that does NOT exist in the other two
 * apps — admin lists are matrices where theirs are narratives. See the header of
 * Table.tsx before reaching for a `<ul>` on an admin list screen.
 */
export {
  Table,
  TableShell,
  THead,
  TBody,
  TR,
  TH,
  TD,
  type ColumnPriority,
  type THProps,
  type TDProps,
} from "./Table";
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
