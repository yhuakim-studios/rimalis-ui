import { cn } from "./cn";

/**
 * A loading placeholder.
 *
 * The design system prefers skeletons over spinners, so every `loading.tsx` in
 * this app is built from these. The reason is not aesthetic: a skeleton in the
 * shape of the real content reserves the space the content will occupy, so the
 * page does not jump when it arrives. A centred spinner reserves nothing and
 * guarantees a layout shift.
 *
 * Which means the rule for using this: **a skeleton must match the real
 * component's box.** A card skeleton that is 40px shorter than the card is worse
 * than no skeleton, because it promises a layout and then breaks it. When the
 * real component's height changes, its skeleton changes with it.
 *
 * `animate-shimmer` is an opacity pulse rather than a translating gradient — one
 * animated property, compositor-only, and it degrades to a static block under
 * `prefers-reduced-motion` (see globals.css) without needing a variant here.
 */

export interface SkeletonProps {
  /** Tailwind sizing/shape classes, e.g. `"h-5 w-32 rounded-pill"`. */
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      // `aria-hidden` on every skeleton: the loading state is announced once, by
      // the region that owns it (`aria-busy`, or a `role="status"` label). A
      // dozen placeholder boxes in the accessibility tree is noise, and a screen
      // reader reading them out is strictly worse than silence.
      aria-hidden
      className={cn("animate-shimmer rounded-input bg-divider", className)}
    />
  );
}

/**
 * A block of text lines, with the last one short.
 *
 * The short last line is the detail that makes a text skeleton read as text
 * rather than as a stack of bars — real paragraphs do not end flush.
 */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
